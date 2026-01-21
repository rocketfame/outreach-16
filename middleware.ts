import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractTrialToken, isMasterToken, isTrialToken } from "@/lib/trialLimits";

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "";

// Master IP addresses (IPv4 and IPv6)
const MASTER_IPS = [
  "79.168.81.227", // IPv4
  "2001:4860:7:225::fe", // IPv6
];

// Check if maintenance gate is enabled (can be disabled via env)
const isMaintenanceEnabled = () => {
  return process.env.MAINTENANCE_ENABLED !== "false";
};

// Check if IP is master IP
function isMasterIP(ip: string | null): boolean {
  if (!ip) return false;
  return MASTER_IPS.includes(ip);
}

// Get client IP from request
function getClientIP(request: NextRequest): string | null {
  // Try various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  
  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;
  
  return null;
}

function isAuthConfigured() {
  return BASIC_AUTH_USER.length > 0 && BASIC_AUTH_PASS.length > 0;
}

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected"',
    },
  });
}

function isValidAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Basic ")) return false;
  try {
    const base64Credentials = authHeader.slice("Basic ".length);
    const decoded = atob(base64Credentials);
    const [user, pass] = decoded.split(":");
    return user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  // Get client IP
  const clientIP = getClientIP(request);
  const isMasterIPAddress = isMasterIP(clientIP);
  
  // Check for trial token first (allows access without basic auth)
  // Extract trial token directly from URL (more reliable in middleware)
  const trialTokenFromQuery = request.nextUrl.searchParams.get("trial");
  const trialToken = trialTokenFromQuery || request.headers.get("x-trial-token");
  
  // CRITICAL: If trial parameter exists, it MUST be valid
  if (trialToken) {
    const isValidTrial = isTrialToken(trialToken);
    const isValidMaster = isMasterToken(trialToken);
    
    // If token exists but is neither valid trial nor master, return 404
    if (!isValidTrial && !isValidMaster) {
      // Invalid trial token - redirect to 404 page
      const notFoundUrl = new URL("/not-found", request.url);
      return NextResponse.redirect(notFoundUrl);
    }
    
    // Valid trial or master token - allow access
    if (isValidTrial || isValidMaster) {
      const response = NextResponse.next();
      response.headers.set("x-trial-token", trialToken);
      // Mark as bypassing maintenance (both trial and master tokens bypass)
      response.cookies.set("bypass_maintenance", "true");
      return response;
    }
  }
  
  // Check for invalid query parameters (any query param other than valid ones)
  const url = request.nextUrl;
  const validQueryParams = ["trial", "theme"]; // Add other valid params if needed
  const hasInvalidQueryParams = Array.from(url.searchParams.keys()).some(
    key => !validQueryParams.includes(key)
  );
  
  // If there are invalid query params and it's not an API route, return 404
  if (hasInvalidQueryParams && !url.pathname.startsWith("/api/")) {
    return new NextResponse("404: Page Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Check maintenance gate (only for main page, not API routes)
  // Show gate for everyone EXCEPT:
  // 1. Master IP addresses
  // 2. Users with valid trial/master tokens (they already got bypass cookie above)
  if (isMaintenanceEnabled() && request.nextUrl.pathname === "/") {
    // Master IP always bypasses
    if (isMasterIPAddress) {
      const response = NextResponse.next();
      response.cookies.set("is_master_ip", "true");
      response.cookies.set("bypass_maintenance", "true");
      return response;
    }
    
    // Check if user has bypass cookie (from valid trial/master token)
    const bypassCookie = request.cookies.get("bypass_maintenance");
    if (bypassCookie?.value !== "true") {
      // Show maintenance gate for everyone else
      const response = NextResponse.next();
      response.headers.set("x-maintenance-gate", "true");
      return response;
    }
  }

  // Master IP or maintenance disabled - continue normally
  // No valid trial token - require basic auth if configured
  if (!isAuthConfigured()) {
    const response = NextResponse.next();
    // Mark master IP in cookie for client-side check
    if (isMasterIPAddress) {
      response.cookies.set("is_master_ip", "true");
      response.cookies.set("bypass_maintenance", "true");
    }
    return response;
  }

  const authHeader = request.headers.get("authorization");
  if (!isValidAuth(authHeader)) {
    return unauthorizedResponse();
  }

  const response = NextResponse.next();
  // Mark master IP in cookie for client-side check
  if (isMasterIPAddress) {
    response.cookies.set("is_master_ip", "true");
    response.cookies.set("bypass_maintenance", "true");
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Protect all routes except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
