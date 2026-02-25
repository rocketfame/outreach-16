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
  "85.244.18.181", // IPv4 (Lisbon / MEO)
  "2001:8a0:57f9:1300:cd1a:f3a9:aafb:ee3b", // IPv6 (Lisbon / MEO)
  "87.196.74.244", // IPv4 (Lisbon / Google)
  "2001:4860:7:1525::f7", // IPv6 (Lisbon / Google)
  "87.196.74.249", // IPv4
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
