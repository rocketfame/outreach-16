// lib/trialLimits.ts
// Trial limits management system

import { kv } from "@vercel/kv";

export interface TrialUsage {
  articlesGenerated: number;
  topicDiscoveryRuns: number;
  imagesGenerated: number;
  lastReset?: number; // timestamp for potential reset logic
}

// Fallback in-memory storage (used if KV is not configured)
const trialUsageStore = new Map<string, TrialUsage>();

// Maximum limits for trial users
export const TRIAL_LIMITS = {
  MAX_ARTICLES: 2,
  MAX_TOPIC_DISCOVERY_RUNS: 2,
  MAX_IMAGES: 1,
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
        console.log("[trialLimits] Using KV storage for token:", token.substring(0, 10) + "...");
        return usage;
      }
      // Initialize if not found
      const defaultUsage: TrialUsage = {
        articlesGenerated: 0,
        topicDiscoveryRuns: 0,
        imagesGenerated: 0,
      };
      await kv.set(key, defaultUsage);
      console.log("[trialLimits] Initialized KV storage for token:", token.substring(0, 10) + "...");
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
      console.log("[trialLimits] Saved to KV storage for token:", token.substring(0, 10) + "...", usage);
      return;
    } catch (error) {
      console.error("[trialLimits] KV error saving, falling back to in-memory:", error);
      // Fall through to in-memory storage
    }
  }

  // Fallback to in-memory storage
  trialUsageStore.set(token, usage);
  console.log("[trialLimits] Saved to in-memory storage for token:", token.substring(0, 10) + "...", usage);
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
  
  // Always log to help debug token issues
  console.log("[trialLimits] TRIAL_TOKENS env:", process.env.TRIAL_TOKENS ? "SET" : "NOT SET");
  if (process.env.TRIAL_TOKENS) {
    console.log("[trialLimits] TRIAL_TOKENS raw length:", process.env.TRIAL_TOKENS.length);
    console.log("[trialLimits] TRIAL_TOKENS first 50 chars:", process.env.TRIAL_TOKENS.substring(0, 50));
  }
  console.log("[trialLimits] Parsed tokens count:", parsed.length);
  if (parsed.length > 0) {
    console.log("[trialLimits] First token:", parsed[0]);
    console.log("[trialLimits] Last token:", parsed[parsed.length - 1]);
    console.log("[trialLimits] All tokens:", parsed);
  } else {
    console.warn("[trialLimits] No trial tokens parsed! Check TRIAL_TOKENS environment variable.");
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
  const isValid = trialTokens.includes(token);
  
  // Always log in production to help debug token issues
  console.log("[trialLimits] Checking token:", token);
  console.log("[trialLimits] Token length:", token.length);
  console.log("[trialLimits] Available tokens count:", trialTokens.length);
  console.log("[trialLimits] Is valid:", isValid);
  
  if (!isValid) {
    if (trialTokens.length > 0) {
      console.log("[trialLimits] Token does not match. First available token:", trialTokens[0]);
      console.log("[trialLimits] First token length:", trialTokens[0]?.length);
      console.log("[trialLimits] Token exact match with first?", token === trialTokens[0]);
      // Check if token exists in array (case-sensitive)
      const foundIndex = trialTokens.findIndex(t => t === token);
      console.log("[trialLimits] Token found at index:", foundIndex);
    } else {
      console.warn("[trialLimits] No trial tokens configured! TRIAL_TOKENS env variable is empty or not set.");
    }
  }
  
  return isValid;
}

/**
 * Increment article count for trial token
 */
export async function incrementArticleCount(token: string): Promise<void> {
  const usage = await getTrialUsage(token);
  usage.articlesGenerated += 1;
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
 */
export async function canGenerateArticle(token: string | null, articlesToGenerate: number = 1): Promise<{ allowed: boolean; reason?: string }> {
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
  const totalAfterGeneration = usage.articlesGenerated + articlesToGenerate;
  
  if (totalAfterGeneration > TRIAL_LIMITS.MAX_ARTICLES) {
    return {
      allowed: false,
      reason: `Trial limit reached: you have generated ${usage.articlesGenerated} article(s), and trying to generate ${articlesToGenerate} more. Maximum ${TRIAL_LIMITS.MAX_ARTICLES} articles allowed.`,
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
  console.log("[extractTrialToken] Token from query:", tokenFromQuery);
  
  if (tokenFromQuery) {
    console.log("[extractTrialToken] Returning token from query:", tokenFromQuery);
    return tokenFromQuery;
  }

  // Try to get from header
  const tokenFromHeader = request.headers.get("x-trial-token");
  console.log("[extractTrialToken] Token from header:", tokenFromHeader);
  if (tokenFromHeader) {
    console.log("[extractTrialToken] Returning token from header:", tokenFromHeader);
    return tokenFromHeader;
  }

  console.log("[extractTrialToken] No token found");
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
