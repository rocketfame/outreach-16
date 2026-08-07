import { after } from "next/server";
import { requireAutomationAuth } from "@/lib/automation/auth";
import {
  enqueueAutomationJob,
  getAutomationQueueInfo,
  requiresPersistentAutomationJobStore,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import { drainAutomationQueuePool } from "@/lib/automation/runner";
import { AutomationValidationError, validateAutomationRequest } from "@/lib/automation/validate";
import type {
  AutomationErrorResponse,
  AutomationGenerateRequest,
  AutomationJob,
} from "@/lib/automation/types";
import { getTextProviderConfig, validateTextProvider } from "@/lib/textProvider";
import { estimateAutomationRequestCost } from "@/lib/automation/costEstimate";
import { maxJobCostUsd } from "@/lib/automation/budget";
import {
  automationApiKeyId,
  releaseAutomationUsageReservation,
  reserveAutomationUsage,
} from "@/lib/automation/usageStore";

export const maxDuration = 300;

const MAX_BATCH_SIZE = 20;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validationError(error: unknown, index?: number): Response {
  const body: AutomationErrorResponse & { index?: number } = {
    status: "error",
    code: "invalid_request",
    message: error instanceof Error ? error.message : "Invalid automation request.",
  };
  if (index !== undefined) body.index = index;
  if (error instanceof AutomationValidationError) {
    if (error.field) body.field = error.field;
    if (error.allowed) body.allowed = error.allowed;
  }
  return json(body, 400);
}

function billingError(requests: AutomationGenerateRequest[]): Response | null {
  const subscriptionIndex = requests.findIndex((request) => request.billing === "subscription");
  if (subscriptionIndex >= 0) {
    return json({
      status: "error",
      code: "subscription_billing_unavailable",
      index: subscriptionIndex,
      message: "ChatGPT subscription billing cannot fund Automation API calls. No batch jobs were queued.",
    }, 409);
  }
  const provider = getTextProviderConfig();
  const externalIndex = requests.findIndex((request) => request.billing === "external");
  if (externalIndex >= 0 && provider.kind !== "external") {
    return json({
      status: "error",
      code: "external_text_provider_unavailable",
      index: externalIndex,
      message: "billing: \"external\" requires TEXT_API_BASE_URL and TEXT_MODEL. No batch jobs were queued.",
    }, 409);
  }
  const apiIndex = requests.findIndex((request) => request.billing === "api");
  if (apiIndex >= 0 && provider.kind !== "openai") {
    return json({
      status: "error",
      code: "openai_text_provider_unavailable",
      index: apiIndex,
      message: "billing: \"api\" requires the OpenAI text provider. No batch jobs were queued.",
    }, 409);
  }
  return null;
}

/** POST /api/automation/generate/batch — validates the whole batch first. */
export async function POST(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    return json(authError, authError.code === "unauthorized" ? 401 : 500);
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch (error) {
    return validationError(error);
  }
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_BATCH_SIZE) {
    return validationError(new Error(
      `Request body must be a JSON array containing 1-${MAX_BATCH_SIZE} article payloads.`
    ));
  }

  const requests: AutomationGenerateRequest[] = [];
  for (let index = 0; index < input.length; index++) {
    try {
      requests.push(validateAutomationRequest(input[index]));
    } catch (error) {
      return validationError(error, index);
    }
  }
  try {
    validateTextProvider();
  } catch (error) {
    return json({
      status: "error",
      code: "text_provider_not_configured",
      message: error instanceof Error ? error.message : "Text provider is not configured.",
    }, 503);
  }
  const rejectedBilling = billingError(requests);
  if (rejectedBilling) return rejectedBilling;

  const now = Date.now();
  const jobs: AutomationJob[] = requests.map((request) => ({
    id: `gen_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    status: "queued",
    request,
    estimatedCostUsd: estimateAutomationRequestCost(request),
    createdAt: now,
    updatedAt: now,
  }));

  const overCapIndex = jobs.findIndex((job) => (job.estimatedCostUsd || 0) > maxJobCostUsd());
  if (overCapIndex >= 0) {
    return json({
      status: "error",
      code: "estimated_cost_exceeds_cap",
      index: overCapIndex,
      message: `Estimated job cost $${jobs[overCapIndex].estimatedCostUsd!.toFixed(2)} exceeds the $${maxJobCostUsd().toFixed(2)} job cap. No batch jobs were queued.`,
    }, 400);
  }

  const keyId = automationApiKeyId(req);
  const reservedJobIds: string[] = [];
  for (let index = 0; index < jobs.length; index++) {
    const reservation = await reserveAutomationUsage(
      keyId,
      jobs[index].id,
      maxJobCostUsd()
    );
    if (!reservation.ok) {
      await Promise.all(reservedJobIds.map(releaseAutomationUsageReservation));
      return json({
        status: "error",
        code: reservation.code,
        index,
        message: reservation.message.replace("No job was queued.", "No batch jobs were queued."),
      }, 429);
    }
    reservedJobIds.push(jobs[index].id);
  }

  try {
    for (const job of jobs) {
      const backend = await saveAutomationJob(job);
      if (backend === "memory" && requiresPersistentAutomationJobStore()) {
        await Promise.all(reservedJobIds.map(releaseAutomationUsageReservation));
        return json({
          status: "error",
          code: "job_store_not_persistent",
          message: "Automation job store is using in-memory fallback. No batch jobs were queued.",
        }, 503);
      }
    }
    for (const job of jobs) await enqueueAutomationJob(job.id);
  } catch (error) {
    await Promise.all(reservedJobIds.map(releaseAutomationUsageReservation));
    console.error("[automationBatch] Failed to create batch:", error);
    return json({
      status: "error",
      code: "job_schedule_failed",
      message: "Automation batch could not be scheduled.",
    }, 500);
  }

  const placements = await Promise.all(jobs.map(async (job) => ({
    jobId: job.id,
    estimatedCostUsd: job.estimatedCostUsd,
    ...(await getAutomationQueueInfo(job.id)),
  })));
  after(() => drainAutomationQueuePool());
  return json({ status: "queued", jobs: placements }, 202);
}
