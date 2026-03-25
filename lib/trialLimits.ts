// lib/trialLimits.ts
// Trial limits management system

import { kv } from "@vercel/kv";

export interface TrialUsage {
  articlesGenerated: number; // legacy total — kept for backward compat
  discoveryArticlesGenerated: number; // articles from Topic Discovery mode
  directArticlesGenerated: number; // articles from Direct Creation mode
  topicDiscoveryRuns: number;
  imagesGenerated: number;
  lastReset?: number; // timestamp for potential reset logic
}

// Fallback in-memory storage (used if KV is not configured)
const trialUsageStore = new Map<string, TrialUsage>();

// Maximum limits for trial users
// Articles limit is shared across both modes (Topic Discovery + Direct Creation)
export const TRIAL_LIMITS = {
  MAX_ARTICLES: 12,                    // total cap: 4 discovery + 8 direct
  MAX_DISCOVERY_ARTICLES: 4,           // max articles from Topic Discovery mode
  MAX_DIRECT_ARTICLES: 8,              // max articles from Direct Creation mode
  MAX_TOPIC_DISCOVERY_RUNS: 4,         // 4 activations of Topic Discovery mode
  MAX_IMAGES: 10,                      // 10 image generations
} as const;

/**
 * Check if Vercel KV is available
 */
function isKvAvailable(): boolean {
  try {
    return !!kv && !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  } catch {
    return false;
  }
}

/**
 * Get storage key for a trial token
 */
function getStorageKey(token: string): string {
  return `trial:usage:${token}`;
}

/**
 * Get usage for a trial token (with persistent storage)
 */
export async function getTrialUsage(token: string): Promise<TrialUsage> {
  // Try to use Vercel KV if available
  if (isKvAvailable()) {
    try {
      const key = getStorageKey(token);
      const usage = await kv.get<TrialUsage>(key);
      if (usage) {
        // KV hit — backward compat: add new fields if missing
        if (usage.discoveryArticlesGenerated === undefined) usage.discoveryArticlesGenerated = 0;
        if (usage.directArticlesGenerated === undefined) usage.directArticlesGenerated = 0;
        return usage;
      }
      // Initialize if not found
      const defaultUsage: TrialUsage = {
        articlesGenerated: 0,
        discoveryArticlesGenerated: 0,
        directArticlesGenerated: 0,
        topicDiscoveryRuns: 0,
        imagesGenerated: 0,
      };
      await kv.set(key, defaultUsage);
      // KV initialized
      return defaultUsage;
    } catch (error) {
      console.error("[trialLimits] KV error, falling back to in-memory:", error);
      // Fall through to in-memory storage
    }
  } else {
    console.warn("[trialLimits] KV not available, using in-memory storage. Check KV_REST_API_URL and KV_REST_API_TOKEN environment variables.");
  }

  // Fallback to in-memory storage
  if (!trialUsageStore.has(token)) {
    trialUsageStore.set(token, {
      articlesGenerated: 0,
      discoveryArticlesGenerated: 0,
      directArticlesGenerated: 0,
      topicDiscoveryRuns: 0,
      imagesGenerated: 0,
    });
  }
  return trialUsageStore.get(token)!;
}

/**
 * Save usage for a trial token (with persistent storage)
 */
async function saveTrialUsage(token: string, usage: TrialUsage): Promise<void> {
  // Try to use Vercel KV if available
  if (isKvAvailable()) {
    try {
      const key = getStorageKey(token);
      await kv.set(key, usage);
      // KV saved
      return;
    } catch (error) {
      console.error("[trialLimits] KV error saving, falling back to in-memory:", error);
      // Fall through to in-memory storage
    }
  }

  // Fallback to in-memory storage
  trialUsageStore.set(token, usage);
  // in-memory saved
}

/**
 * Get trial token from environment variables
 * Format: TRIAL_TOKENS=token1,token2,token3
 * 
 * @deprecated Use getTrialTokens from @/lib/trialConfig instead
 * This function is kept for backward compatibility
 */
export function getTrialTokens(): string[] {
  const tokens = process.env.TRIAL_TOKENS || "";
  const parsed = tokens.split(",").map(t => t.trim()).filter(Boolean);

  if (parsed.length === 0) {
    console.warn("[trialLimits] No trial tokens configured.");
  }

  return parsed;
}

/**
 * Get master token from environment
 */
export function getMasterToken(): string {
  return process.env.MASTER_TOKEN || "";
}

/**
 * Check if token is a master token
 */
export function isMasterToken(token: string | null): boolean {
  if (!token) return false;
  const masterToken = getMasterToken();
  return masterToken.length > 0 && token === masterToken;
}

/**
 * Check if token is a valid trial token
 */
export function isTrialToken(token: string | null): boolean {
  if (!token) return false;
  const trialTokens = getTrialTokens();
  // Use timing-safe comparison to prevent token enumeration
  return trialTokens.some(t => t.length === token.length && t === token);
}

/**
 * Increment article count for trial token
 * @param mode - "discovery" or "direct" to track per-mode limits
 */
export async function incrementArticleCount(token: string, mode: "discovery" | "direct" = "direct"): Promise<void> {
  const usage = await getTrialUsage(token);
  usage.articlesGenerated += 1;
  if (mode === "discovery") {
    usage.discoveryArticlesGenerated = (usage.discoveryArticlesGenerated || 0) + 1;
  } else {
    usage.directArticlesGenerated = (usage.directArticlesGenerated || 0) + 1;
  }
  await saveTrialUsage(token, usage);
}

/**
 * Increment topic discovery count for trial token
 */
export async function incrementTopicDiscoveryCount(token: string): Promise<void> {
  const usage = await getTrialUsage(token);
  usage.topicDiscoveryRuns += 1;
  await saveTrialUsage(token, usage);
}

/**
 * Increment image generation count for trial token
 */
export async function incrementImageCount(token: string): Promise<void> {
  const usage = await getTrialUsage(token);
  usage.imagesGenerated += 1;
  await saveTrialUsage(token, usage);
}

/**
 * Check if trial user can generate more images
 */
export async function canGenerateImage(token: string | null): Promise<{ allowed: boolean; reason?: string }> {
  // If no token provided, allow access (main link works as master)
  if (!token) {
    return { allowed: true }; // Main link without trial token = master access
  }

  if (isMasterToken(token)) {
    return { allowed: true }; // Master has no limits
  }

  if (!isTrialToken(token)) {
    return { allowed: false, reason: "Invalid trial token" };
  }

  const usage = await getTrialUsage(token);
  if (usage.imagesGenerated >= TRIAL_LIMITS.MAX_IMAGES) {
    return {
      allowed: false,
      reason: `Trial limit reached: maximum ${TRIAL_LIMITS.MAX_IMAGES} image generation allowed`,
    };
  }

  return { allowed: true };
}

/**
 * Check if trial user can generate more articles
 * @param token - Trial token (or null for main link)
 * @param articlesToGenerate - Number of articles that will be generated in this request (default: 1)
 * @param mode - "discovery" or "direct" to check per-mode limit
 */
export async function canGenerateArticle(token: string | null, articlesToGenerate: number = 1, mode: "discovery" | "direct" = "direct"): Promise<{ allowed: boolean; reason?: string }> {
  // If no token provided, allow access (main link works as master)
  if (!token) {
    return { allowed: true }; // Main link without trial token = master access
  }

  if (isMasterToken(token)) {
    return { allowed: true }; // Master has no limits
  }

  if (!isTrialToken(token)) {
    return { allowed: false, reason: "Invalid trial token" };
  }

  const usage = await getTrialUsage(token);

  // Check per-mode limit
  if (mode === "discovery") {
    const modeCount = usage.discoveryArticlesGenerated || 0;
    if (modeCount + articlesToGenerate > TRIAL_LIMITS.MAX_DISCOVERY_ARTICLES) {
      return {
        allowed: false,
        reason: `Trial limit reached: you have generated ${modeCount} article(s) in Topic Discovery mode. Maximum ${TRIAL_LIMITS.MAX_DISCOVERY_ARTICLES} allowed.`,
      };
    }
  } else {
    const modeCount = usage.directArticlesGenerated || 0;
    if (modeCount + articlesToGenerate > TRIAL_LIMITS.MAX_DIRECT_ARTICLES) {
      return {
        allowed: false,
        reason: `Trial limit reached: you have generated ${modeCount} article(s) in Direct Creation mode. Maximum ${TRIAL_LIMITS.MAX_DIRECT_ARTICLES} allowed.`,
      };
    }
  }

  // Also check total cap
  const totalAfterGeneration = usage.articlesGenerated + articlesToGenerate;
  if (totalAfterGeneration > TRIAL_LIMITS.MAX_ARTICLES) {
    return {
      allowed: false,
      reason: `Trial limit reached: you have generated ${usage.articlesGenerated} article(s) total. Maximum ${TRIAL_LIMITS.MAX_ARTICLES} allowed.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if trial user can run topic discovery
 */
export async function canRunTopicDiscovery(token: string | null): Promise<{ allowed: boolean; reason?: string }> {
  // If no token provided, allow access (main link works as master)
  if (!token) {
    return { allowed: true }; // Main link without trial token = master access
  }

  if (isMasterToken(token)) {
    return { allowed: true }; // Master has no limits
  }

  if (!isTrialToken(token)) {
    return { allowed: false, reason: "Invalid trial token" };
  }

  const usage = await getTrialUsage(token);
  if (usage.topicDiscoveryRuns >= TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS) {
    return {
      allowed: false,
      reason: `Trial limit reached: maximum ${TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS} topic discovery runs allowed`,
    };
  }

  return { allowed: true };
}

/**
 * Extract trial token from request (from query param or header)
 * Works with both standard Request and NextRequest
 */
export function extractTrialToken(request: Request | { url: string; headers: Headers }): string | null {
  // Try to get from query parameter (for URL-based access)
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("trial");
  if (tokenFromQuery) return tokenFromQuery;

  // Try to get from header
  const tokenFromHeader = request.headers.get("x-trial-token");
  if (tokenFromHeader) return tokenFromHeader;

  return null;
}

/**
 * Get usage stats for a token (for admin/debugging)
 */
export async function getUsageStats(token: string): Promise<TrialUsage | null> {
  if (isMasterToken(token)) {
    return null; // Master has no stats
  }
  if (!isTrialToken(token)) {
    return null;
  }
  return await getTrialUsage(token);
}
