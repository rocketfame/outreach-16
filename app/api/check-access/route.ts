import { NextRequest, NextResponse } from "next/server";

// Master IP addresses (must match proxy.ts)
const MASTER_IPS = [
  "79.168.81.227",
  "93.108.241.96",
  "2001:4860:7:225::fe",
];

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

function isMasterIP(ip: string | null): boolean {
  if (!ip) return false;
  return MASTER_IPS.includes(ip);
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
