import { requireAutomationAuth } from "@/lib/automation/auth";
import { getAutomationJob } from "@/lib/automation/jobStore";
import type { AutomationErrorResponse } from "@/lib/automation/types";

export const maxDuration = 30;

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

  return json({
    status: job.status,
    jobId: job.id,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  }, 200);
}
