// app/api/check-auth/route.ts
// Simple endpoint to check if Basic Auth is configured

import { NextResponse } from "next/server";

export async function GET() {
  const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
  const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "";
  
  const isConfigured = BASIC_AUTH_USER.length > 0 && BASIC_AUTH_PASS.length > 0;
  
  return NextResponse.json({
    basicAuthConfigured: isConfigured,
    hasUser: BASIC_AUTH_USER.length > 0,
    hasPass: BASIC_AUTH_PASS.length > 0,
    message: isConfigured 
      ? "Basic Auth is configured. Main Link requires authentication."
      : "Basic Auth is NOT configured. Main Link is open (works as master).",
  });
}
