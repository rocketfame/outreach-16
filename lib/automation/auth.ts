import type { AutomationErrorResponse } from "@/lib/automation/types";

export function requireAutomationAuth(req: Request): AutomationErrorResponse | null {
  const configuredKey = process.env.AUTOMATION_API_KEY?.trim();
  if (!configuredKey) {
    return {
      status: "error",
      code: "automation_key_not_configured",
      message: "AUTOMATION_API_KEY is not configured.",
    };
  }

  const header = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  const provided = header.startsWith(prefix) ? header.slice(prefix.length).trim() : "";

  if (!provided || provided !== configuredKey) {
    return {
      status: "error",
      code: "unauthorized",
      message: "Missing or invalid automation API key.",
    };
  }

  return null;
}
