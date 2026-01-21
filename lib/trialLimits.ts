// lib/trialLimits.ts
// Trial limits management system

export interface TrialUsage {
  articlesGenerated: number;
  topicDiscoveryRuns: number;
  lastReset?: number; // timestamp for potential reset logic
}

// In-memory storage for trial usage (for production, consider using Vercel KV or similar)
const trialUsageStore = new Map<string, TrialUsage>();

// Maximum limits for trial users
export const TRIAL_LIMITS = {
  MAX_ARTICLES: 2,
  MAX_TOPIC_DISCOVERY_RUNS: 2,
} as const;

/**
 * Get trial token from environment variables
 * Format: TRIAL_TOKENS=token1,token2,token3
 */
export function getTrialTokens(): string[] {
  const tokens = process.env.TRIAL_TOKENS || "";
  return tokens.split(",").map(t => t.trim()).filter(Boolean);
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
  return trialTokens.includes(token);
}

/**
 * Get usage for a trial token
 */
export function getTrialUsage(token: string): TrialUsage {
  if (!trialUsageStore.has(token)) {
    trialUsageStore.set(token, {
      articlesGenerated: 0,
      topicDiscoveryRuns: 0,
    });
  }
  return trialUsageStore.get(token)!;
}

/**
 * Increment article count for trial token
 */
export function incrementArticleCount(token: string): void {
  const usage = getTrialUsage(token);
  usage.articlesGenerated += 1;
  trialUsageStore.set(token, usage);
}

/**
 * Increment topic discovery count for trial token
 */
export function incrementTopicDiscoveryCount(token: string): void {
  const usage = getTrialUsage(token);
  usage.topicDiscoveryRuns += 1;
  trialUsageStore.set(token, usage);
}

/**
 * Check if trial user can generate more articles
 */
export function canGenerateArticle(token: string | null): { allowed: boolean; reason?: string } {
  if (!token) {
    return { allowed: false, reason: "No trial token provided" };
  }

  if (isMasterToken(token)) {
    return { allowed: true }; // Master has no limits
  }

  if (!isTrialToken(token)) {
    return { allowed: false, reason: "Invalid trial token" };
  }

  const usage = getTrialUsage(token);
  if (usage.articlesGenerated >= TRIAL_LIMITS.MAX_ARTICLES) {
    return {
      allowed: false,
      reason: `Trial limit reached: maximum ${TRIAL_LIMITS.MAX_ARTICLES} articles allowed`,
    };
  }

  return { allowed: true };
}

/**
 * Check if trial user can run topic discovery
 */
export function canRunTopicDiscovery(token: string | null): { allowed: boolean; reason?: string } {
  if (!token) {
    return { allowed: false, reason: "No trial token provided" };
  }

  if (isMasterToken(token)) {
    return { allowed: true }; // Master has no limits
  }

  if (!isTrialToken(token)) {
    return { allowed: false, reason: "Invalid trial token" };
  }

  const usage = getTrialUsage(token);
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
 */
export function extractTrialToken(request: Request): string | null {
  // Try to get from query parameter (for URL-based access)
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("trial");
  
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  // Try to get from header
  const tokenFromHeader = request.headers.get("x-trial-token");
  if (tokenFromHeader) {
    return tokenFromHeader;
  }

  return null;
}

/**
 * Get usage stats for a token (for admin/debugging)
 */
export function getUsageStats(token: string): TrialUsage | null {
  if (isMasterToken(token)) {
    return null; // Master has no stats
  }
  if (!isTrialToken(token)) {
    return null;
  }
  return getTrialUsage(token);
}
