import {
  claimNextQueuedJob,
  getAutomationJob,
  markJobStarted,
  releaseAutomationSlot,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import { runAutomationGeneration } from "@/lib/automation/pipeline";
import type { AutomationJob } from "@/lib/automation/types";

/**
 * Run one job. The caller must already hold execution slot `slot` for it
 * (via claimNextQueuedJob) — the slot is released here in all outcomes.
 */
async function executeAutomationJob(jobId: string, slot: number, job: AutomationJob): Promise<void> {
  try {
    const runningJob: AutomationJob = {
      ...job,
      status: "running",
      startedAt: Date.now(),
    };
    await saveAutomationJob(runningJob);

    const result = await runAutomationGeneration(jobId, job.request);
    await saveAutomationJob({
      ...runningJob,
      status: "done",
      completedAt: Date.now(),
      result,
    });
  } catch (error) {
    await saveAutomationJob({
      ...job,
      status: "error",
      completedAt: Date.now(),
      error: {
        code: "generation_failed",
        message: error instanceof Error ? error.message : "Automation generation failed.",
      },
    });
  } finally {
    await releaseAutomationSlot(slot, jobId);
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
