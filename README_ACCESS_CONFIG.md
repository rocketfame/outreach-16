# Access Configuration Guide

## Overview

This document explains how to manage access control settings (IP addresses and trial tokens) without modifying the core infrastructure.

## Master IP Addresses

### Location
All master IP addresses are centralized in `lib/accessConfig.ts`

### How to Add a New IP Address

1. Open `lib/accessConfig.ts`
2. Add the new IP to the `MASTER_IPS` array:

```typescript
export const MASTER_IPS = [
  "79.168.81.227", // IPv4
  "93.108.241.96", // IPv4
  "2001:4860:7:225::fe", // IPv6
  "NEW_IP_ADDRESS_HERE", // Add your new IP here
] as const;
```

3. Save the file and deploy

### What Master IPs Can Do
- Unlimited access to all routes (including `/` and `/api/*`)
- Bypass maintenance gate
- Bypass basic auth (if configured)
- No trial limits

## Trial Tokens

### Location
Trial tokens are stored in environment variable `TRIAL_TOKENS` in `.env.local`

### How to Add New Trial Tokens

1. Open `.env.local`
2. Find the `TRIAL_TOKENS` line
3. Add new tokens separated by commas (no spaces):

```env
TRIAL_TOKENS=trial-09w33n-3143-bpckc2,trial-hu3cv3-5439-4v0sfz,trial-NEW-TOKEN-HERE
```

4. Save the file
5. **IMPORTANT**: Also update the hardcoded list in `app/components/MaintenanceGate.tsx` (lines 26-37) for client-side validation
6. Deploy to Vercel and update environment variables in Vercel Dashboard

### Trial Token Limits
- **Topic Discovery**: 2 runs
- **Articles**: 2 articles
- **Images**: 1 image

### Trial Token Usage
Trial tokens allow access via URL parameter:
- `https://yourdomain.com/?trial=trial-09w33n-3143-bpckc2`

## Important Notes

### ⚠️ DO NOT:
- Change the infrastructure/logic in `app/proxy.ts` (only update IP list)
- Hardcode trial tokens in code (always use environment variable)
- Remove existing IPs or tokens without checking usage first
- Modify the access checking functions (only update arrays)

### ✅ DO:
- Add new IPs to `lib/accessConfig.ts` when needed
- Add new trial tokens to `TRIAL_TOKENS` environment variable
- Update `MaintenanceGate.tsx` hardcoded list when adding trial tokens
- Test changes in development before deploying
- Keep this documentation updated

## Files Involved

### IP Configuration
- `lib/accessConfig.ts` - Centralized IP management
- `app/proxy.ts` - Uses `isMasterIP()` from accessConfig
- `app/api/check-access/route.ts` - Uses `isMasterIP()` from accessConfig

### Trial Token Configuration
- `.env.local` - Environment variable `TRIAL_TOKENS`
- `lib/trialLimits.ts` - Token validation (reads from env)
- `lib/trialConfig.ts` - Centralized token management
- `app/components/MaintenanceGate.tsx` - Client-side token list (lines 26-37)

## Troubleshooting

### IP Not Working
1. Check server logs for `[proxy] IP Detection` to see detected IP
2. Verify IP is in `MASTER_IPS` array in `lib/accessConfig.ts`
3. Check cookie `is_master_ip` in browser DevTools
4. Verify IP format (no extra spaces, correct IPv4/IPv6 format)

### Trial Token Not Working
1. Check `TRIAL_TOKENS` environment variable is set
2. Verify token is in the comma-separated list (no spaces)
3. Check token is in `MaintenanceGate.tsx` hardcoded list
4. Verify token format matches existing tokens
5. Check server logs for token validation

## Current Configuration

### Master IPs (as of latest update)
- `79.168.81.227` (IPv4)
- `93.108.241.96` (IPv4)
- `2001:4860:7:225::fe` (IPv6)
- `85.244.18.181` (IPv4, Lisbon / MEO)
- `2001:8a0:57f9:1300:cd1a:f3a9:aafb:ee3b` (IPv6, Lisbon / MEO)
- `87.196.74.244` (IPv4, Lisbon / Google)
- `2001:4860:7:1525::f7` (IPv6, Lisbon / Google)
- `87.196.74.249` (IPv4)

### Trial Tokens Count
Check `.env.local` for current count and list.
