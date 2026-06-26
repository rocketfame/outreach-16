import { after } from "next/server";
import { requireAutomationAuth } from "@/lib/automation/auth";
import { acquireAutomationSlot, releaseAutomationSlot, saveAutomationJob } from "@/lib/automation/jobStore";
import { runAutomationGeneration, validateAutomationRequest } from "@/lib/automation/pipeline";
import type { AutomationErrorResponse, AutomationJob } from "@/lib/automation/types";

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

async function executeAutomationJob(jobId: string, job: AutomationJob): Promise<void> {
  const acquired = await acquireAutomationSlot(jobId);
  if (!acquired) {
    await saveAutomationJob({
      ...job,
      status: "error",
      completedAt: Date.now(),
      error: {
        code: "concurrency_limit",
        message: "Another automation generation is already running. Retry later.",
      },
    });
    return;
  }

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
    await releaseAutomationSlot(jobId);
  }
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
    return errorResponse(
      "invalid_request",
      error instanceof Error ? error.message : "Invalid automation request.",
      400
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

  await saveAutomationJob(job);
  after(() => executeAutomationJob(jobId, job));

  return json({ status: "queued", jobId }, 202);
}
