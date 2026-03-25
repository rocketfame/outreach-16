/**
 * In-memory rate limiter for API routes.
 * Works on Vercel serverless (per-instance) — provides basic protection.
 * For production-grade rate limiting, consider Vercel KV or Upstash Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/** Default rate limit configs per route category */
export const RATE_LIMITS = {
  /** Expensive operations: article generation, image generation */
  generate: { limit: 10, windowSeconds: 3600 } as RateLimitConfig, // 10/hour
  /** Medium cost: topic search, link search */
  search: { limit: 30, windowSeconds: 60 } as RateLimitConfig, // 30/min
  /** Cheap reads: trial-usage, check-auth, check-access */
  read: { limit: 60, windowSeconds: 60 } as RateLimitConfig, // 60/min
  /** Auth attempts */
  auth: { limit: 5, windowSeconds: 300 } as RateLimitConfig, // 5 per 5 min
} as const;

/**
 * Check if a request should be rate limited.
 * @param identifier - IP address or token
 * @param category - Route category for limit config
 * @returns { limited: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  identifier: string,
  category: keyof typeof RATE_LIMITS
): { limited: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMITS[category];
  const key = `${category}:${identifier}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { limited: false, remaining: config.limit - 1, resetIn: config.windowSeconds };
  }

  entry.count++;

  if (entry.count > config.limit) {
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, remaining: 0, resetIn };
  }

  return {
    limited: false,
    remaining: config.limit - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Extract client IP from request headers (Vercel-compatible).
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
