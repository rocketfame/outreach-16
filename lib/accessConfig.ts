/**
 * Centralized Access Configuration
 * 
 * This file contains all access control settings:
 * - Master IP addresses (unlimited access)
 * - Trial tokens (limited trial access)
 * 
 * IMPORTANT: 
 * - To add new IP addresses, add them to MASTER_IPS array
 * - To add new trial tokens, add them to TRIAL_TOKENS array in .env.local
 * - DO NOT change the infrastructure/logic, only update these arrays
 */

// Master IP addresses with unlimited access
// Add new IPs here when needed
export const MASTER_IPS = [
  "79.168.81.227", // IPv4
  "93.108.241.96", // IPv4
  "2001:4860:7:225::fe", // IPv6
] as const;

/**
 * Check if an IP address is a master IP
 */
export function isMasterIP(ip: string | null): boolean {
  if (!ip) return false;
  return MASTER_IPS.includes(ip as any);
}

/**
 * Get all master IPs (for logging/debugging)
 */
export function getMasterIPs(): readonly string[] {
  return MASTER_IPS;
}
