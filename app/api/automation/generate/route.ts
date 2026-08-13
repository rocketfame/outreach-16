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
import type { AutomationErrorResponse, AutomationJob } from "@/lib/automation/types";
import { getTextProviderConfig, validateTextProvider } from "@/lib/textProvider";
import { estimateAutomationRequestCost } from "@/lib/automation/costEstimate";
import {
  automationApiKeyId,
  releaseAutomationUsageReservation,
  reserveAutomationUsage,
} from "@/lib/automation/usageStore";

export const maxDuration = 300;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  const body: AutomationErrorResponse = { status: "error", code, message };
  return json(body, status);
}

export async function POST(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    const status = authError.code === "unauthorized" ? 401 : 500;
    return json(authError, status);
  }

  let request;
  try {
    request = validateAutomationRequest(await req.json());
  } catch (error) {
    const body: AutomationErrorResponse = {
      status: "error",
      code: "invalid_request",
      message: error instanceof Error ? error.message : "Invalid automation request.",
    };
    if (error instanceof AutomationValidationError) {
      if (error.field) body.field = error.field;
      if (error.allowed) body.allowed = error.allowed;
    }
    return json(body, 400);
  }

  // ChatGPT subscriptions cannot pay API usage. Text generation is routed only
  // through the configured external provider and never falls back to OpenAI.
  if (request.billing === "subscription") {
    return errorResponse(
      "subscription_billing_unavailable",
      "ChatGPT subscription billing cannot fund Automation API calls. No job was queued and no provider call was made. Use billing: \"auto\" or \"external\" with a configured text provider.",
      409
    );
  }
  try {
    validateTextProvider();
  } catch (error) {
    return errorResponse(
      "text_provider_not_configured",
      error instanceof Error ? error.message : "Text provider is not configured.",
      503
    );
  }
  const provider = getTextProviderConfig();
  if (request.billing === "external" && provider.kind !== "external") {
    return errorResponse(
      "external_text_provider_unavailable",
      "billing: \"external\" requires TEXT_API_BASE_URL and TEXT_MODEL. No job was queued.",
      409
    );
  }
  if (request.billing === "api" && provider.kind !== "openai") {
    return errorResponse(
      "openai_text_provider_unavailable",
      "billing: \"api\" requires the OpenAI text provider. Remove the TEXT_* override or use billing: \"auto\".",
      409
    );
  }

  const jobId = `gen_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const capUsd = request.maxCostUsd;
  const estimatedCost = estimateAutomationRequestCost(request);
  // Pre-flight: reject BEFORE anything is queued, reserved, or spent. A job
  // whose cheapest plausible run already exceeds the cap would only burn the
  // source stage and then die at the generation reservation.
  if (estimatedCost.min > capUsd) {
    return errorResponse(
      "estimated_cost_exceeds_cap",
      `Estimated job cost $${estimatedCost.min.toFixed(2)}-$${estimatedCost.max.toFixed(2)} exceeds the $${capUsd.toFixed(2)} job cap. ` +
      `Nothing was charged. Raise maxCostUsd (ceiling $1.00), reduce image quality, disable the image, shorten the article, or use standard mode.`,
      422
    );
  }
  const usageReservation = await reserveAutomationUsage(
    automationApiKeyId(req),
    jobId,
    capUsd
  );
  if (!usageReservation.ok) {
    return errorResponse(usageReservation.code, usageReservation.message, 429);
  }
  const now = Date.now();
  const job: AutomationJob = {
    id: jobId,
    status: "queued",
    request,
    estimatedCostUsd: estimatedCost.max,
    estimatedCost,
    createdAt: now,
    updatedAt: now,
  };

  let jobStoreBackend;
  try {
    jobStoreBackend = await saveAutomationJob(job);
  } catch (error) {
    await releaseAutomationUsageReservation(jobId);
    console.error("[automationGenerate] Failed to create job:", error);
    return errorResponse("job_store_unavailable", "Automation job store is unavailable.", 500);
  }

  if (jobStoreBackend === "memory" && requiresPersistentAutomationJobStore()) {
    await releaseAutomationUsageReservation(jobId);
    return errorResponse(
      "job_store_not_persistent",
      "Automation job store is using in-memory fallback. Configure KV_REST_API_URL and KV_REST_API_TOKEN for this Vercel environment.",
      503
    );
  }

  // "queued" is a promise the server keeps: the job goes into a FIFO queue
  // and runs when a slot frees. The queue drains from after() hooks on every
  // submit and every poll (see drainAutomationQueue), never rejects post-hoc.
  try {
    await enqueueAutomationJob(jobId);
    after(() => drainAutomationQueuePool());
  } catch (error) {
    await releaseAutomationUsageReservation(jobId);
    console.error("[automationGenerate] Failed to schedule job:", error);
    return errorResponse("job_schedule_failed", "Automation job could not be scheduled.", 500);
  }

  const { position, etaSeconds } = await getAutomationQueueInfo(jobId);
  return json({
    status: "queued",
    jobId,
    position,
    etaSeconds,
    estimatedCostUsd: estimatedCost,
    maxCostUsd: capUsd,
  }, 202);
}
