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
import { validateTextProvider } from "@/lib/textProvider";

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
  if (request.billing === "api") {
    return errorResponse(
      "openai_text_billing_disabled",
      "OpenAI API billing is disabled for text generation. No job was queued. Use billing: \"auto\" or \"external\".",
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

  const jobId = `gen_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  const job: AutomationJob = {
    id: jobId,
    status: "queued",
    request,
    createdAt: now,
    updatedAt: now,
  };

  let jobStoreBackend;
  try {
    jobStoreBackend = await saveAutomationJob(job);
  } catch (error) {
    console.error("[automationGenerate] Failed to create job:", error);
    return errorResponse("job_store_unavailable", "Automation job store is unavailable.", 500);
  }

  if (jobStoreBackend === "memory" && requiresPersistentAutomationJobStore()) {
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
    console.error("[automationGenerate] Failed to schedule job:", error);
    return errorResponse("job_schedule_failed", "Automation job could not be scheduled.", 500);
  }

  const { position, etaSeconds } = await getAutomationQueueInfo(jobId);
  return json({ status: "queued", jobId, position, etaSeconds }, 202);
}
