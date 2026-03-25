// app/api/check-auth/route.ts
// Simple endpoint to check if Basic Auth is configured

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  // Rate limit: 60 req/min per IP
  const ip = getClientIP(request);
  const rl = checkRateLimit(ip, "read");
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.resetIn) } }
    );
  }

  const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
  const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "";

  const isConfigured = BASIC_AUTH_USER.length > 0 && BASIC_AUTH_PASS.length > 0;

  // Don't reveal whether user/pass individually exist — just overall status
  return NextResponse.json({
    basicAuthConfigured: isConfigured,
    message: isConfigured
      ? "Basic Auth is configured. Main Link requires authentication."
      : "Basic Auth is NOT configured. Main Link is open (works as master).",
  });
}
