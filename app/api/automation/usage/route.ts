import { requireAutomationAuth } from "@/lib/automation/auth";
import {
  automationApiKeyId,
  getAutomationUsage,
} from "@/lib/automation/usageStore";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/automation/usage — cost and remaining budget for this bearer key. */
export async function GET(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    return json(authError, authError.code === "unauthorized" ? 401 : 500);
  }

  return json({
    status: "ok",
    ...(await getAutomationUsage(automationApiKeyId(req))),
  }, 200);
}
