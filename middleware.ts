import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractTrialToken, isMasterToken, isTrialToken } from "@/lib/trialLimits";

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "";

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
  // Check for trial token first (allows access without basic auth)
  const trialToken = extractTrialToken(request);
  if (trialToken && (isTrialToken(trialToken) || isMasterToken(trialToken))) {
    // Trial or master token found - allow access without basic auth
    // Add trial token to headers for API routes to use
    const response = NextResponse.next();
    response.headers.set("x-trial-token", trialToken);
    return response;
  }

  // No valid trial token - require basic auth if configured
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!isValidAuth(authHeader)) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all routes except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
