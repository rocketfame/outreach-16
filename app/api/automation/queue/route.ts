import { after } from "next/server";
import { requireAutomationAuth } from "@/lib/automation/auth";
import { getAutomationQueueStatus } from "@/lib/automation/jobStore";
import { drainAutomationQueuePool } from "@/lib/automation/runner";

export const maxDuration = 300;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/automation/queue — shared article/cover queue health. */
export async function GET(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    return json(authError, authError.code === "unauthorized" ? 401 : 500);
  }
  return json({ status: "ok", ...(await getAutomationQueueStatus()) }, 200);
}

/** Internal/public-authenticated kick used when a worker frees a slot. */
export async function POST(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    return json(authError, authError.code === "unauthorized" ? 401 : 500);
  }
  after(() => drainAutomationQueuePool());
  return json({ status: "accepted" }, 202);
}
