import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Note: url.parse() deprecation warnings come from dependencies (OpenAI SDK, Next.js, etc.)
  // Our code uses WHATWG URL API (new URL()) which is the correct approach
  // To suppress these warnings, set NODE_OPTIONS=--no-deprecation in your environment
};

export default nextConfig;
