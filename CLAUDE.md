# CLAUDE.md — Project Context for Claude Code

This file gives Claude Code a fast, accurate mental model of the project so any new session is productive immediately. Keep it updated when architecture changes.

## Project overview

**Outreach Articles App** — Next.js 16 (App Router, React 19) web app for planning briefs, discovering topics, generating outlines, and writing outreach articles end-to-end. Deployed on Vercel at `typereach.app`.

Two generation modes:
- **Topic Discovery Mode** — run AI to discover topic clusters, pick topics, generate articles from them.
- **Direct Article Creation Mode** — user provides a topic/brief directly, generates a single article.

Writing modes: `seo` (default) and `human` (editorial with mandatory humanization).

## Tech stack

- Next.js 16.0.8 (App Router), React 19.2.1, TypeScript strict
- Vercel hosting + Vercel KV (Upstash Redis) for persistent trial usage
- OpenAI GPT-5.2 for article generation
- Undetectable.AI Humanization API v2 (submit + polling)
- Tavily for trust-source validation
- Stripe for upgrade checkout
- Plus Jakarta Sans typography, CSS custom properties design system (42 tokens)

## Critical files and their roles

### Access control & security
- **`middleware.ts`** — thin wrapper around `app/proxy.ts`
- **`app/proxy.ts`** — main access gate. Trial token bypass → IP whitelist → maintenance gate → basic auth fallback. Non-master IPs on `/` always see `MaintenanceGate`, never raw 403.
- **`lib/accessConfig.ts`** — reads `MASTER_IPS` env (comma-separated) with hardcoded `FALLBACK_IPS`. Caches per cold start.
- **`app/components/MaintenanceGate.tsx`** — client-side gate. Validates trial tokens via `/api/trial-usage` (no hardcoded token list).
- **`lib/rateLimit.ts`** — in-memory per-IP rate limiter. Categories: `generate` (10/h), `search` (30/min), `read` (60/min), `auth` (5/5min).
- **`next.config.ts`** — security headers: CSP, HSTS, X-Frame-Options, noindex/nofollow X-Robots-Tag, etc.
- **`app/robots.ts`** — returns `Disallow: /` for all user-agents.

### Trial system
- **`lib/trialLimits.ts`** — source of truth for trial limits + usage tracking. Uses Vercel KV with in-memory fallback. `TRIAL_LIMITS`:
  - `MAX_DISCOVERY_ARTICLES: 4` — articles via Topic Discovery mode
  - `MAX_DIRECT_ARTICLES: 8` — articles via Direct Creation mode
  - `MAX_TOPIC_DISCOVERY_RUNS: 4` — Topic Discovery searches
  - `MAX_IMAGES: 10` — AI image generations
  - `MAX_ARTICLES: 12` — total cap (legacy, kept for backward compat)
- `TrialUsage` interface tracks per-mode counts: `discoveryArticlesGenerated`, `directArticlesGenerated`, plus legacy `articlesGenerated` total.
- `canGenerateArticle(token, count, mode)` — checks per-mode limit AND total cap.
- `incrementArticleCount(token, mode)` — bumps both per-mode counter and legacy total.
- **`lib/trialConfig.ts`** — reads `TRIAL_TOKENS` env (comma-separated).
- **`app/api/trial-usage/route.ts`** — returns per-mode usage + limits for UI display.
- **`app/components/TrialUsageDisplay.tsx`** — 4-pill usage widget with Lucide-style icons, expandable details. Shows Topic Search / Discovery Articles / Direct Articles / Images separately. **All UI text in English.**
- **`app/components/TrialLimitReached.tsx`** — modal shown when any limit is exhausted.

### Article generation pipeline
- **`app/api/articles/route.ts`** — main generation endpoint (maxDuration: 300s). Detects mode from first topic (Direct = no `shortAngle`/`whyNonGeneric`/`howAnchorFits`). Rate-limited `generate`. Increments trial count per mode after successful generation.
- **`lib/articlePrompt.ts`** — `buildArticlePrompt` (Discovery) and `buildDirectArticlePrompt` (Direct).
- **`lib/articleStructure.ts`** — structured article format (blocks, tables, trust sources).
- **`lib/textPostProcessing.ts`** — `cleanText`, `fixHtmlTagSpacing`, `removeExcessiveBold`. **Note:** `lightHumanEdit` function still exists here but is no longer imported or used anywhere (dead code — safe to remove).
- **`lib/humanizerClient.ts`** — Undetectable.AI v2 submit + polling.
- **`lib/sectionHumanize.ts`** — section-level humanization during writing.
- **`lib/trustSourceFilter.ts`** + **`lib/sourceClassifier.ts`** — Tavily-validated source handling with LLM classification.

### Topic discovery
- **`lib/topicPrompt.ts`** — topic cluster generation prompts
- **`lib/topicBrowsing.ts`** — topic browsing logic
- **`app/api/generate-topics/route.ts`** — rate-limited `search`
- **`app/api/search-images/route.ts`** — image search, rate-limited `search`

### State management
- **`app/hooks/usePersistentAppState.ts`** — localStorage-backed app state. Stores briefs, articles (discovery + direct), selected topics, mode, writingMode, theme. **Note:** `lightHumanEditEnabled` field was removed.
- **`app/page.tsx`** — main UI shell, orchestrates modes, calls generation APIs.

### Design system
- **`app/globals.css`** — 5500+ lines, 32 numbered sections (search `════` dividers). CSS custom properties for colors, radius, shadows, spacing. Plus Jakarta Sans base weight 500. Warm dark mode `#0B0B0F`.
- **`lib/designTokens.ts`** — design token exports.
- **`app/layout.tsx`** — font loading (`Plus_Jakarta_Sans` + `JetBrains_Mono`), robots metadata (noindex/nofollow).

## Environment variables

Required on Vercel (and `.env.local` for dev):
- `OPENAI_API_KEY` — GPT-5.2
- `UNDETECTABLE_AI_API_KEY` — humanization
- `TAVILY_API_KEY` — trust sources
- `MASTER_IPS` — comma-separated IP allowlist (no spaces). Falls back to `FALLBACK_IPS` in `lib/accessConfig.ts` if unset.
- `TRIAL_TOKENS` — comma-separated trial tokens for bypass access
- `MASTER_TOKEN` — single master bypass token (optional)
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — Vercel KV for trial persistence
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — checkout
- `BASIC_AUTH_USER` + `BASIC_AUTH_PASS` — optional fallback auth
- `MAINTENANCE_ENABLED` — set to `false` to disable maintenance gate (defaults to enabled)
- `NEXT_PUBLIC_MAINTENANCE_ENABLED` — client mirror of the above

## Conventions and gotchas

### Language
- **All UI strings must be in English** — the user is Ukrainian but the product is English-only. Claude responds in Ukrainian in chat but writes English in code.

### Code style
- TypeScript strict mode — no `any` unless unavoidable
- React 19 / Next 16 App Router patterns — server components by default, `"use client"` only when needed
- Inline styles are acceptable for one-off components; design tokens via CSS custom properties are preferred
- No `console.log` of tokens, API keys, IPs, or any PII — previous sessions audited and scrubbed these

### Security rules (do not break these)
- Trial tokens read from `TRIAL_TOKENS` env ONLY — never hardcode tokens on the client
- Master IPs read from `MASTER_IPS` env with fallback — never log the full list
- Cookies set via `COOKIE_OPTIONS` constant in `app/proxy.ts` (httpOnly, secure in prod, sameSite strict)
- Every API route that does generation or search MUST call `checkRateLimit(getClientIP(req), category)`
- Non-master IPs on `/` must see `MaintenanceGate`, never raw 403

### Build / deploy
- `next build` may fail inside restricted sandboxes with FUSE `EPERM unlink .next/BUILD_ID` — use `npx tsc --noEmit` for type checking instead. Real builds happen on Vercel.
- Vercel auto-deploys on push to `main`
- Env changes on Vercel require a redeploy to take effect

### Git
- Branch: `main` (auto-deploys)
- Never force-push to main
- Commit messages in this repo have been terse (`"1"`) — the user is okay with that, but prefer descriptive messages going forward

## Deprecated / removed features

These are fully removed — do not reintroduce:
- **Light Human Edit** — was a separate post-processing pass. Removed in favor of Undetectable.AI humanization. The `lightHumanEdit` function in `lib/textPostProcessing.ts` is dead code kept only to avoid a larger diff.
- **Hardcoded trial token list in `MaintenanceGate.tsx`** — replaced with server-side validation via `/api/trial-usage`.
- **`lightHumanEditEnabled` field in persisted state** — removed from `usePersistentAppState.ts`.

## Quick-start commands

```bash
npm run dev          # local dev server
npx tsc --noEmit     # type check (use this instead of next build in sandboxes)
npm run lint         # eslint
git log --oneline -10
```

## Related docs in repo

- `README.md`, `PRODUCTION_DEPLOY.md`, `CONFIGURATION.md` — setup
- `TRIAL_SETUP.md`, `MAINTENANCE_GATE.md` — access system
- `HUMANIZATION.md`, `HUMANIZATION_ANALYSIS.md` — humanization pipeline
- `GPT_5.2_MIGRATION.md` — model migration notes
- `VERCEL_KV_SETUP.md`, `VERCEL_LOGS_GUIDE.md` — Vercel operations
- `STRIPE_SETUP.md` — checkout flow
- `TECHNICAL_SPECIFICATION.md` — deeper architecture
