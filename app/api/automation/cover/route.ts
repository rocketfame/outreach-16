import { after } from "next/server";
import { requireAutomationAuth } from "@/lib/automation/auth";
import {
  enqueueAutomationJob,
  getAutomationQueueInfo,
  requiresPersistentAutomationJobStore,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import { drainAutomationQueue } from "@/lib/automation/runner";
import { AutomationValidationError, validateCoverRequest } from "@/lib/automation/validate";
import type { AutomationErrorResponse, AutomationJob } from "@/lib/automation/types";

// Cover jobs share the article queue and its execution model: a queued job
// runs inside a drain trigger's after() budget. One image is fast (~1 min),
// but a full article job may run in the same invocation ahead of it.
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

/**
 * POST /api/automation/cover — cover-only generation (~$0.05 at medium
 * quality, no article text). Async: 202 + jobId; poll the shared endpoint
 * GET /api/automation/generate/:jobId. Shares the FIFO queue with article
 * jobs, so a batch and a cover regeneration can never collide.
 */
export async function POST(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    const status = authError.code === "unauthorized" ? 401 : 500;
    return json(authError, status);
  }

  let coverRequest;
  try {
    coverRequest = validateCoverRequest(await req.json());
  } catch (error) {
    const body: AutomationErrorResponse = {
      status: "error",
      code: "invalid_request",
      message: error instanceof Error ? error.message : "Invalid cover request.",
    };
    if (error instanceof AutomationValidationError) {
      if (error.field) body.field = error.field;
      if (error.allowed) body.allowed = error.allowed;
    }
    return json(body, 400);
  }

  const jobId = `cov_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  const job: AutomationJob = {
    id: jobId,
    status: "queued",
    kind: "cover",
    coverRequest,
    createdAt: now,
    updatedAt: now,
  };

  let jobStoreBackend;
  try {
    jobStoreBackend = await saveAutomationJob(job);
  } catch (error) {
    console.error("[automationCover] Failed to create job:", error);
    return errorResponse("job_store_unavailable", "Automation job store is unavailable.", 500);
  }

  if (jobStoreBackend === "memory" && requiresPersistentAutomationJobStore()) {
    return errorResponse(
      "job_store_not_persistent",
      "Automation job store is using in-memory fallback. Configure KV_REST_API_URL and KV_REST_API_TOKEN for this Vercel environment.",
      503
    );
  }

  try {
    await enqueueAutomationJob(jobId);
    after(() => drainAutomationQueue());
  } catch (error) {
    console.error("[automationCover] Failed to schedule job:", error);
    return errorResponse("job_schedule_failed", "Automation job could not be scheduled.", 500);
  }

  const { position, etaSeconds } = await getAutomationQueueInfo(jobId);
  return json({ status: "queued", jobId, position, etaSeconds }, 202);
}
