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
import { validateTextProvider } from "@/lib/textProvider";

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
  const apiIndex = requests.findIndex((request) => request.billing === "api");
  if (apiIndex >= 0) {
    return json({
      status: "error",
      code: "openai_text_billing_disabled",
      index: apiIndex,
      message: "OpenAI API billing is disabled for text generation. No batch jobs were queued.",
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
  const rejectedBilling = billingError(requests);
  if (rejectedBilling) return rejectedBilling;

  try {
    validateTextProvider();
  } catch (error) {
    return json({
      status: "error",
      code: "text_provider_not_configured",
      message: error instanceof Error ? error.message : "Text provider is not configured.",
    }, 503);
  }

  const now = Date.now();
  const jobs: AutomationJob[] = requests.map((request) => ({
    id: `gen_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    status: "queued",
    request,
    createdAt: now,
    updatedAt: now,
  }));

  try {
    for (const job of jobs) {
      const backend = await saveAutomationJob(job);
      if (backend === "memory" && requiresPersistentAutomationJobStore()) {
        return json({
          status: "error",
          code: "job_store_not_persistent",
          message: "Automation job store is using in-memory fallback. No batch jobs were queued.",
        }, 503);
      }
    }
    for (const job of jobs) await enqueueAutomationJob(job.id);
  } catch (error) {
    console.error("[automationBatch] Failed to create batch:", error);
    return json({
      status: "error",
      code: "job_schedule_failed",
      message: "Automation batch could not be scheduled.",
    }, 500);
  }

  const placements = await Promise.all(jobs.map(async (job) => ({
    jobId: job.id,
    ...(await getAutomationQueueInfo(job.id)),
  })));
  after(() => drainAutomationQueuePool());
  return json({ status: "queued", jobs: placements }, 202);
}
