import { NextRequest, NextResponse } from "next/server";
import { isMasterIP } from "@/lib/accessConfig";

function getClientIP(request: NextRequest): string | null {
  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;
  
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const vercelIP = request.headers.get("x-vercel-forwarded-for");
  if (vercelIP) {
    return vercelIP.split(",")[0].trim();
  }
  
  return null;
}

export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req);
  const isMaster = isMasterIP(clientIP);
  
  return NextResponse.json({
    isMaster,
    clientIP,
    hasAccess: isMaster,
  });
}
