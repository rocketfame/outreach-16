import { NextRequest, NextResponse } from "next/server";
import { isMasterIP } from "@/lib/accessConfig";
import { getClientIP } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    const clientIP = getClientIP(req);
    const isMaster = isMasterIP(clientIP);

    return NextResponse.json({
      isMaster,
      clientIP,
      hasAccess: isMaster,
    });
  } catch (error) {
    console.error("check-access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
