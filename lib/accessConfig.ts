/**
 * Centralized Access Configuration
 *
 * This file contains all access control settings:
 * - Master IP addresses (unlimited access) — from MASTER_IPS env variable
 * - Fallback hardcoded IPs (if env not set)
 * - Trial tokens (limited trial access)
 *
 * IMPORTANT:
 * - Preferred: Set MASTER_IPS env variable as comma-separated list
 * - Fallback: hardcoded FALLBACK_IPS used if env not set
 * - To add new trial tokens, add them to TRIAL_TOKENS in .env.local
 * - DO NOT change the infrastructure/logic, only update these arrays
 */

// Fallback IPs — used ONLY if MASTER_IPS env variable is not set
const FALLBACK_IPS = [
  "79.168.81.227",
  "93.108.241.96",
  "2001:4860:7:225::fe",
  "85.244.18.181",
  "2001:8a0:57f9:1300:cd1a:f3a9:aafb:ee3b",
  "87.196.74.244",
  "2001:4860:7:1525::f7",
  "87.196.74.249",
  "87.196.72.145",
  "87.196.72.65",
];

/**
 * Get master IP list from env or fallback.
 * Env format: MASTER_IPS="79.168.81.227,93.108.241.96,..."
 */
function getMasterIPList(): string[] {
  const envIPs = process.env.MASTER_IPS;
  if (envIPs && envIPs.trim().length > 0) {
    return envIPs.split(",").map(ip => ip.trim()).filter(Boolean);
  }
  return FALLBACK_IPS;
}

// Cache for performance (re-evaluated per cold start)
let _cachedIPs: string[] | null = null;

function getCachedMasterIPs(): string[] {
  if (!_cachedIPs) {
    _cachedIPs = getMasterIPList();
  }
  return _cachedIPs;
}

/**
 * Check if an IP address is a master IP
 */
export function isMasterIP(ip: string | null): boolean {
  if (!ip) return false;
  return getCachedMasterIPs().includes(ip);
}

/**
 * Get all master IPs (for logging/debugging)
 */
export function getMasterIPs(): string[] {
  return getCachedMasterIPs();
}

// Backward compatibility — export as const array
export const MASTER_IPS = getCachedMasterIPs();
