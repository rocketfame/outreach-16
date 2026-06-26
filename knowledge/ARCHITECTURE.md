# Архітектура — TypeReach

## Стек
- Next.js 16.2.6 (App Router), React 19.2.1, TypeScript strict
- Vercel hosting + Vercel KV (Upstash Redis)
- OpenAI GPT-5.5, gpt-image-2, Undetectable.AI, Tavily, Stripe

## Access Control Layer
1. middleware.ts → app/proxy.ts
2. Trial token bypass → IP whitelist → Maintenance gate → Basic auth fallback
3. Non-master IPs завжди бачать MaintenanceGate

## Generation Pipeline
1. Brief → Topic Discovery (або Direct) → Outline → Article
2. Rate limiting per IP per category
3. Trial usage tracking (per-mode + total cap)
4. Humanization (optional, via Undetectable.AI)
5. Hero image generation via gpt-image-2 as exact 16:9 PNG (1536x864)
6. Async blog autopilot API wraps one direct article generation job at a time; publishing is external

## Design System
- Plus Jakarta Sans (weight 500)
- 42 CSS custom properties tokens
- Warm dark mode #0B0B0F
- globals.css — 5500+ рядків, 32 секції

## Security
- Tokens/IPs тільки з env, ніколи hardcoded
- CSP headers, noindex/nofollow
- httpOnly secure cookies
