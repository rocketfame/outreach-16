import { after } from "next/server";
import { requireAutomationAuth } from "@/lib/automation/auth";
import {
  ensureJobQueued,
  getAutomationJob,
  getAutomationQueueInfo,
  releaseSlotsHeldBy,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import { drainAutomationQueue } from "@/lib/automation/runner";
import type { AutomationErrorResponse, AutomationJob } from "@/lib/automation/types";

// This route can host job execution: polling a queued job drains the queue
// via after(), and the drained job runs inside THIS invocation's budget.
export const maxDuration = 300;

/**
 * A running job lives inside one invocation capped at maxDuration (300s).
 * Anything "running" for twice that is a dead instance — surface it as an
 * error instead of letting callers poll forever.
 */
const RUNNING_STALE_MS = 600 * 1000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    const status = authError.code === "unauthorized" ? 401 : 500;
    return json(authError, status);
  }

  const { jobId } = await context.params;
  const job = await getAutomationJob(jobId);
  if (!job) {
    const body: AutomationErrorResponse = {
      status: "error",
      code: "job_not_found",
      message: "Automation generation job was not found.",
    };
    return json(body, 404);
  }

  if (job.status === "done" && job.kind === "cover" && job.coverResult) {
    return json({
      status: "done",
      jobId: job.id,
      cover: job.coverResult.cover,
      meta: job.coverResult.meta,
      generationId: job.coverResult.generationId,
    }, 200);
  }

  if (job.status === "done" && job.result) {
    return json({
      status: "done",
      jobId: job.id,
      article: job.result.article,
      meta: job.result.meta,
      generationId: job.result.generationId,
    }, 200);
  }

  if (job.status === "error") {
    return json({
      status: "error",
      jobId: job.id,
      code: job.error?.code || "generation_failed",
      message: job.error?.message || "Automation generation failed.",
    }, 200);
  }

  if (job.status === "running") {
    const runningSince = job.startedAt || job.updatedAt;
    if (Date.now() - runningSince > RUNNING_STALE_MS) {
      const failed: AutomationJob = {
        ...job,
        status: "error",
        completedAt: Date.now(),
        error: {
          code: "job_timeout",
          message: "Generation did not complete within the function time budget. Submit the job again.",
        },
      };
      await saveAutomationJob(failed);
      await releaseSlotsHeldBy(job.id);
      after(() => drainAutomationQueue());
      return json({
        status: "error",
        jobId: job.id,
        code: failed.error!.code,
        message: failed.error!.message,
      }, 200);
    }
  }

  if (job.status === "queued") {
    // Self-heal: if an instance died between claiming this job and starting
    // it, the job is queued but sits nowhere — put it back in line.
    await ensureJobQueued(job.id);
    // Every poll is a drain trigger; the claimed job (this one or the queue
    // head) executes in this invocation's after() budget.
    after(() => drainAutomationQueue());
    const { position, etaSeconds } = await getAutomationQueueInfo(job.id);
    return json({
      status: "queued",
      jobId: job.id,
      position,
      etaSeconds,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }, 200);
  }

  return json({
    status: job.status,
    jobId: job.id,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  }, 200);
}
