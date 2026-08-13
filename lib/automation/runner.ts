import {
  automationConcurrency,
  claimNextQueuedJob,
  getAutomationJob,
  markJobStarted,
  releaseAutomationSlot,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import { AutomationPipelineError, runAutomationGeneration, runCoverGeneration } from "@/lib/automation/pipeline";
import type { AutomationJob } from "@/lib/automation/types";
import {
  AutomationCostCapError,
  AutomationRetryLimitError,
  runWithAutomationBudget,
} from "@/lib/automation/budget";
import { runWithIsolatedCostTracker } from "@/lib/costTracker";
import { UpstreamNoCreditsError } from "@/lib/textProvider";
import { finalizeAutomationUsage } from "@/lib/automation/usageStore";

/**
 * Start a fresh serverless invocation after a worker frees its slot. This
 * avoids chaining two long generations inside one maxDuration budget.
 * Polling remains the fallback drain trigger if the self-kick is unavailable.
 */
async function triggerNextQueueDrain(): Promise<void> {
  if (process.env.VERCEL !== "1") return;
  const host = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const apiKey = process.env.AUTOMATION_API_KEY;
  if (!host || !apiKey) return;

  try {
    const response = await fetch(`https://${host}/api/automation/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.warn(`[automationRunner] Queue self-kick returned status=${response.status}.`);
    }
  } catch (error) {
    console.warn(
      "[automationRunner] Queue self-kick failed; polling will retry the drain:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Run one job. The caller must already hold execution slot `slot` for it
 * (via claimNextQueuedJob) — the slot is released here in all outcomes.
 */
async function executeAutomationJob(jobId: string, slot: number, job: AutomationJob): Promise<void> {
  let actualCostUsd = 0;
  try {
    const runningJob: AutomationJob = {
      ...job,
      status: "running",
      startedAt: Date.now(),
    };
    await saveAutomationJob(runningJob);

    const budgetRun = await runWithAutomationBudget(
      jobId,
      () => runWithIsolatedCostTracker(async () => {
        if (job.kind === "cover" && job.coverRequest) {
          return { kind: "cover" as const, value: await runCoverGeneration(jobId, job.coverRequest) };
        }
        if (job.request) {
          return { kind: "article" as const, value: await runAutomationGeneration(jobId, job.request) };
        }
        throw new AutomationPipelineError("invalid_job", "Job has no request payload.");
      }),
      // Jobs stored before maxCostUsd existed fall back to the server default.
      { capUsd: job.request?.maxCostUsd }
    );
    actualCostUsd = budgetRun.snapshot.costUsd;
    await finalizeAutomationUsage(jobId, actualCostUsd);
    if (budgetRun.error) throw budgetRun.error;
    if (!budgetRun.value) {
      throw new AutomationPipelineError("generation_failed", "Generation returned no result.");
    }

    if (budgetRun.value.kind === "cover") {
      const coverResult = budgetRun.value.value;
      coverResult.meta.costUsd = actualCostUsd;
      await saveAutomationJob({
        ...runningJob,
        status: "done",
        completedAt: Date.now(),
        costUsd: actualCostUsd,
        coverResult,
      });
    } else {
      const result = budgetRun.value.value;
      result.meta.costUsd = actualCostUsd;
      await saveAutomationJob({
        ...runningJob,
        status: "done",
        completedAt: Date.now(),
        costUsd: actualCostUsd,
        result,
      });
    }
  } catch (error) {
    try {
      await finalizeAutomationUsage(jobId, actualCostUsd);
    } catch (usageError) {
      console.error("[automationRunner] Failed to finalize usage:", usageError);
    }
    const code = error instanceof AutomationPipelineError
      ? error.code
      : error instanceof AutomationCostCapError || error instanceof AutomationRetryLimitError
        ? error.code
        : error instanceof UpstreamNoCreditsError
          ? error.code
          : "generation_failed";
    await saveAutomationJob({
      ...job,
      status: "error",
      completedAt: Date.now(),
      costUsd: actualCostUsd,
      error: {
        code,
        message: error instanceof Error ? error.message : "Automation generation failed.",
      },
    });
  } finally {
    await releaseAutomationSlot(slot, jobId);
    await triggerNextQueueDrain();
  }
}

/**
 * Pull at most ONE job off the FIFO queue and execute it, if a slot is free.
 *
 * Serverless has no standing worker, so the queue is drained opportunistically
 * from request `after()` hooks: every submit (POST) and every poll (GET) is a
 * drain trigger. Callers poll their queued jobs anyway, so the queue keeps
 * moving without a scheduler. One job per invocation — the whole job must fit
 * in this invocation's maxDuration budget, so never start a second one here.
 */
export async function drainAutomationQueue(): Promise<void> {
  // Bounded skip-loop: stale or duplicate queue entries are dropped until a
  // runnable job is found or the queue is empty.
  for (let i = 0; i < 20; i++) {
    const claimed = await claimNextQueuedJob();
    if (!claimed) return;
    const { jobId, slot } = claimed;

    const job = await getAutomationJob(jobId);
    if (!job || job.status !== "queued") {
      await releaseAutomationSlot(slot, jobId);
      continue;
    }

    // Atomic one-shot guard — a job can never execute twice, even if it
    // somehow ended up in the queue more than once.
    if (!(await markJobStarted(jobId))) {
      await releaseAutomationSlot(slot, jobId);
      continue;
    }

    await executeAutomationJob(jobId, slot, job);
    return;
  }
}

/**
 * Fill all configured worker slots from one serverless drain trigger.
 * Slot acquisition remains atomic in the store, so overlapping POST/poll
 * invocations cannot exceed GENERATION_CONCURRENCY or run a job twice.
 */
export async function drainAutomationQueuePool(): Promise<void> {
  const workers = Array.from(
    { length: automationConcurrency() },
    () => drainAutomationQueue()
  );
  const results = await Promise.allSettled(workers);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[automationRunner] Queue worker failed:", result.reason);
    }
  }
}
