// lib/undetectableCredits.ts
// Live Undetectable.AI credit balance (1 credit = 1 word). Used by the
// automation API pre-flight so a human-mode job is never queued against a
// humanizer that cannot pay for it.

export interface UndetectableCredits {
  credits: number;
  baseCredits: number;
  boostCredits: number;
  checkedAt: number;
}

const CACHE_TTL_MS = 30_000;
let cache: UndetectableCredits | null = null;

export function isUndetectableConfigured(): boolean {
  return !!process.env.UNDETECTABLE_HUMANIZER_API_KEY;
}

/**
 * Current balance, or null when the key is missing or the balance endpoint
 * is unreachable. Cached for 30s — a batch submit of 20 jobs must not fire
 * 20 balance lookups.
 */
export async function getUndetectableCredits(options?: { fresh?: boolean }): Promise<UndetectableCredits | null> {
  const apiKey = process.env.UNDETECTABLE_HUMANIZER_API_KEY;
  if (!apiKey) return null;
  if (!options?.fresh && cache && Date.now() - cache.checkedAt < CACHE_TTL_MS) return cache;

  const baseUrl = process.env.UNDETECTABLE_HUMANIZER_BASE_URL || "https://humanize.undetectable.ai";
  try {
    const res = await fetch(`${baseUrl}/check-user-credits`, {
      method: "GET",
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn(`[undetectable-credits] Balance lookup failed with status ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { credits?: number; base_credits?: number; boost_credits?: number };
    const credits = Number(json.credits ?? 0);
    if (!Number.isFinite(credits)) return null;
    cache = {
      credits,
      baseCredits: Number(json.base_credits ?? 0) || 0,
      boostCredits: Number(json.boost_credits ?? 0) || 0,
      checkedAt: Date.now(),
    };
    return cache;
  } catch (error) {
    console.warn("[undetectable-credits] Balance lookup error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
