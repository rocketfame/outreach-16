import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";
import type { TrustedSource } from "@/lib/tavilyClient";

/**
 * KV cache for automation Tavily lookups. Outreach batches and acceptance
 * reruns hit the same niche/topic queries repeatedly — a cache hit makes the
 * whole source stage cost $0.00 instead of paying Tavily again.
 */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const memoryCache = new Map<string, { expiresAt: number; sources: TrustedSource[] }>();

function isKvAvailable(): boolean {
  try {
    return !!kv && !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  } catch {
    return false;
  }
}

export function sourceCacheKey(query: string, depth: string, includeDomains: string[] = []): string {
  const fingerprint = [query.trim().toLowerCase(), depth, [...includeDomains].sort().join(",")].join("|");
  return `automation:sources:v1:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`;
}

export async function getCachedSources(key: string): Promise<TrustedSource[] | null> {
  if (isKvAvailable()) {
    try {
      const cached = await kv.get<TrustedSource[]>(key);
      if (Array.isArray(cached)) return cached;
    } catch (error) {
      console.warn("[automationSourceCache] KV read failed; treating as miss:", error);
    }
    return null;
  }
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.sources;
}

export async function setCachedSources(key: string, sources: TrustedSource[]): Promise<void> {
  // Empty result sets are not cached: a transient Tavily hiccup must not
  // suppress sources for a whole week.
  if (sources.length === 0) return;
  if (isKvAvailable()) {
    try {
      await kv.set(key, sources, { ex: CACHE_TTL_SECONDS });
    } catch (error) {
      console.warn("[automationSourceCache] KV write failed; continuing uncached:", error);
    }
    return;
  }
  memoryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000, sources });
}
