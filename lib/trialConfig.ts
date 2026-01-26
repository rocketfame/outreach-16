/**
 * Centralized Trial Tokens Configuration
 * 
 * This file provides a centralized way to manage trial tokens.
 * 
 * IMPORTANT:
 * - Trial tokens are stored in environment variable TRIAL_TOKENS (comma-separated)
 * - To add new trial tokens, update TRIAL_TOKENS in .env.local
 * - DO NOT hardcode tokens in code - always use environment variable
 * - This ensures tokens can be updated without code changes
 */

/**
 * Get trial tokens from environment variable
 * Format: TRIAL_TOKENS=token1,token2,token3
 * 
 * @returns Array of valid trial tokens
 */
export function getTrialTokens(): string[] {
  const tokens = process.env.TRIAL_TOKENS || "";
  const parsed = tokens.split(",").map(t => t.trim()).filter(Boolean);
  
  // Log for debugging (helpful for troubleshooting)
  if (process.env.NODE_ENV === "development") {
    console.log("[trialConfig] Loaded trial tokens:", parsed.length);
  }
  
  return parsed;
}

/**
 * Check if a token is a valid trial token
 */
export function isTrialToken(token: string | null): boolean {
  if (!token) return false;
  const trialTokens = getTrialTokens();
  return trialTokens.includes(token);
}

/**
 * Get count of configured trial tokens (for admin/debugging)
 */
export function getTrialTokenCount(): number {
  return getTrialTokens().length;
}
