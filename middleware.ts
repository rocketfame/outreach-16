import { proxy } from "@/app/proxy";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    /*
     * Protect all routes except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
