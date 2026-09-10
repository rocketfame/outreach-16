# Automation API

## Generate an article

`POST /api/automation/generate` queues one article-generation job. Authenticate
with `Authorization: Bearer <AUTOMATION_API_KEY>`.

### Language fields

| Field | Type | Required | Contract |
|---|---|---:|---|
| `language` | string | No | Defaults to `English`. Accepts a supported full name, an ISO alias, or `custom` / `Other (custom)`. Matching is case-insensitive. |
| `languageCustom` | string \| null | Only for custom | Free-text language name. Required when `language` is `custom` or `Other (custom)`. |

Supported names: `English`, `German`, `Spanish`, `Portuguese`, `French`,
`Italian`, `Polish`, `Ukrainian`, `Russian`.

ISO 639-1 aliases: `en`, `de`, `es`, `pt`, `fr`, `it`, `pl`, `uk`, `ru`.
Common locale variants such as `en-US`, `pt-BR`, and `uk-UA` are also accepted.

The resolved language applies to `contentHtml`, generated `seoTitle`, generated
`seoDescription`, and the body-derived `excerpt`. A caller-provided `topic`
remains the verbatim `title`, so callers should submit the topic in the target
language. `article.slug` is always lowercase ASCII transliteration of the title,
never an English translation, and matches `^[a-z0-9]+(-[a-z0-9]+)*$`.

The completed job echoes the resolved value in `meta.language`. Unsupported
values fail synchronously with HTTP 400 and include `field` and `allowed`.

Native orthography is part of the language contract. Italian uses required
diacritics (`è`, `é`, `à`, `ì`, `ò`, `ù`) rather than apostrophe substitutes;
the same rule applies to Spanish, Portuguese, French, German, and Polish
diacritics. Persistent Italian apostrophe substitutions fail with
`orthography_invalid` instead of being published.

All generated article and SEO text uses the shared BetterWords 2.1.2 editorial
quality guardrails, including both `seo` and `human` modes. The article prompt
remains authoritative for voice and rhythm; STE-inspired constraints apply only
inside genuine procedures, instructions, safety notes, and checklists. For
`mode: "human"`, Undetectable.AI is additionally the primary rewrite provider. An
exact `Insufficient credits` response switches the remaining work in that job to the
BetterWords 2.1.2 quality rewrite through the configured text provider. `meta.humanizationProvider`
reports `undetectable`, `betterwords`, or `mixed`. If neither provider rewrites
any block, the job fails with `humanization_failed`; unhumanized copy is never
reported as a successful human-mode article.

### Humanizer selection, credits, and article formats

| Field | Type | Required | Contract |
|---|---|---:|---|
| `mode` | `"human"` \| `"standard"` | No | Default `human`. |
| `humanizer` | `"auto"` \| `"undetectable"` \| `"betterwords"` | No | Human mode only. Default `auto`. |
| `format` | `"article"` \| `"listicle"` \| `"comparison"` | No | Default `article`. |

**Humanization runs exactly once per job, on the accepted draft.** The draft
is generated first, run through the acceptance checks (`truncated_output`,
`below_min_words`, `anchor_*`, `orthography_invalid`) and the single
corrective retry, and only the draft that passed is humanized. A rejected
draft costs text-model tokens only — never Undetectable.AI credits. If the
humanized body fails the same checks, the job ends with
`humanized_draft_rejected` (credits were spent once; there is no automatic
re-humanization).

The rewrite provider is resolved **at submit time** from the live
Undetectable.AI balance (1 credit = 1 word; a job needs about
`maxWords × 1.1`) and echoed as `humanizer` in the 202 response:

- `auto` — Undetectable.AI when the balance covers the job, otherwise
  BetterWords 2.1.2 through the text provider. Never fails on balance.
- `undetectable` — requires a funded balance; otherwise HTTP 422
  `humanizer_credits_insufficient` (or `humanizer_not_configured`,
  `humanizer_balance_unavailable`) and nothing is queued.
- `betterwords` — never touches Undetectable.AI.

Batch submissions check the balance against the **cumulative** need of the
batch, in order: with `auto`, jobs the balance no longer covers resolve to
`betterwords`; with `undetectable`, the whole batch is rejected.

The resolved provider drives the cost estimate: a job resolved to
Undetectable.AI has `estimatedCostUsd.min` at the metered price
(~$0.0005/word), so a `maxCostUsd` that cannot afford the humanization is
rejected up front with `estimated_cost_exceeds_cap` instead of dying
mid-humanization after credits were spent. At runtime the whole
humanization is additionally reserved against the job cap before the first
paid submit. Practical caps: `standard` fits `$0.40`; `human` +
`betterwords` fits `$0.40`; `human` + Undetectable.AI for 1200-1800 words
needs about `$0.85-1.00` — send `maxCostUsd: 1` for those jobs.

`GET /api/automation/config` reports `humanizer.undetectableCredits` (live,
cached 30 s), `humanizer.undetectableConfigured`, the accepted `humanizers`
and `formats`, and the defaults. Check it before a batch that must run on
Undetectable.AI. The done job echoes `meta.humanizationProvider`
(`undetectable` / `betterwords` / `mixed`), `meta.undetectableWordsUsed`,
and `meta.format`.

`format` appends a mandatory structure directive to the topic brief:

- `article` — narrative guide; the model picks the structure from the brief.
- `listicle` — numbered H2 items (`1. ...`); the item count is taken from a
  number in the topic (e.g. "7 ways...") or defaults to 7-10; intro before,
  short wrap-up after; no comparison table.
- `comparison` — head-to-head of the options named in the topic/brief:
  who each option is for, exactly one criteria-by-options table, one H2
  verdict per criterion, a closing "Which to choose" section; no invented
  numbers or rankings.

Everything else the brief needs (angle, audience, mandatory points, which
options to compare) goes into `brief` (≤ 2000 chars).

### Quality and source failures

Before a job becomes `done`, paragraph integrity is checked for missing terminal
punctuation, dangling colons, unbalanced quotes, and sentence fragments that
start with a lowercase letter or bare digit. A failed draft is retried once; a
second failure returns `truncated_output`.

Source-search provider failures return `source_lookup_failed`. This is distinct
from `no_independent_sources`, which means search completed but no live
independent source survived policy and availability checks. Server diagnostics
include outbound-search execution, cache hits, candidate counts, and a
rejection reason for each discarded URL. The source stage runs exactly two
searches: an official-platform query plus an independent-research query pinned
to the curated research/trade-press allowlist (up to 20 candidates), so
independent candidates arrive in the base sweep instead of via extra recovery
searches; the requirement for at least one live independent source is not
relaxed.

API-supplied `brand` values are immutable visible-text tokens. For example,
`PromoSoundGroup` is restored byte-for-byte if a model inserts spaces or changes
capitalization.

Malformed model JSON is retried once with a corrective JSON instruction before
the job can fail with `generation_failed`.

GPT-5 article calls use `reasoning_effort: "low"` and a completion ceiling that
includes explicit headroom for hidden reasoning tokens. If a call returns only
reasoning tokens and no visible content, it is retried once with `minimal`
reasoning and a larger ceiling. Small classification and formatting calls use
`minimal` reasoning so their output budget cannot be consumed by hidden work.

### Billing

`billing` accepts `auto` (default), `external`, `api`, or `subscription`.
`auto` uses the configured external provider when both `TEXT_API_BASE_URL` and
`TEXT_MODEL` exist; otherwise it uses OpenAI API. `api` requires the OpenAI
provider, while `external` requires the `TEXT_*` override. Successful metadata
reports the actual `billingSource` (`openai_api` or `external_text_provider`),
provider label, model, and `quotaRemaining: null`.

`billing: "subscription"` fails synchronously with
`subscription_billing_unavailable` before the job is queued, so it cannot
silently spend API funds. A ChatGPT workspace subscription cannot fund server
API calls. When OpenAI is active, `costUsd` includes tracked text tokens plus
Tavily, Undetectable, and any optional cover image.

### Cost controls

Every article job has one shared hard budget across Tavily search, source
classification, article generation, formatting, BetterWords, Undetectable.AI,
and the optional cover. The per-job cap is the request's `maxCostUsd` when
provided; otherwise `MAX_JOB_COST_USD` (default `$0.40`). The server-side
ceiling is `$1.00` — a larger `maxCostUsd` is rejected as `invalid_request`.
Each paid call reserves its worst-case estimated cost before it starts; if it
cannot fit, the job stops with `cost_cap_exceeded`. The final polling response
includes `costUsd` for both `done` and `error` jobs.

Submission is pre-flighted: `estimatedCostUsd` is an honest `{min, max}`
object where `max` mirrors the runtime worst-case reservations (uncached
prompt, full completion ceiling) and `min` is a realistic cheap run (warm
source cache, warm OpenAI prompt cache). Humanization is priced by the
provider the job **resolved to** (see "Humanizer selection"): Undetectable.AI
at the metered per-word price in both bounds, BetterWords as a text-provider
call. If even `min` exceeds the job cap, POST returns HTTP 422
`estimated_cost_exceeds_cap` before anything is queued, reserved, or spent —
a rejected job costs `$0.00`.

The trust-source stage runs at most TWO Tavily searches per job at basic
depth (`$0.01` each, ≤ `$0.02` per job) and caches results in KV for 7 days
keyed by query — batch reruns of the same niche/topic pay `$0.00` for
sources. OpenAI cached prompt tokens are metered at the cached-input rate, so
repeat generations settle far below the reservation.

`GET /api/automation/config` (same bearer auth) returns the live limits and
stage pricing: default/ceiling cost caps, daily/monthly budgets, per-stage
prices (search, text input/output per 1M tokens, humanization per word, image
by quality), word-count bounds, supported languages, required fields, and
defaults. Everything it reports comes from the same functions the runtime
enforces with.

`MAX_RETRIES_PER_JOB` defaults to `1`. A retry is allowed only when both the
retry count and remaining job budget permit it. Hidden OpenAI SDK retries are
disabled so all retries pass through this guard.

`DAILY_COST_LIMIT_USD` defaults to `$5.00` and
`MONTHLY_COST_LIMIT_USD` defaults to `$100.00`, per automation bearer key. An
article reserves the full job cap before queueing. If either budget is
exhausted, POST returns HTTP 429 (`daily_budget_exceeded` or
`monthly_budget_exceeded`) and creates no job. The immediate 202 response
includes `estimatedCostUsd`.

`GET /api/automation/usage` returns today/month spend and reservations,
monthly spend and reservations, remaining budgets, and the seven-day average
cost. OpenAI credit exhaustion is surfaced as `upstream_no_credits`.

### Cover format

Automation cover generation defaults to `coverFormat: "webp"` with 80% output
compression. Set `coverFormat: "png"` for legacy consumers. The returned
`cover.format` always reports the actual encoding.

### Ukrainian example

```bash
curl -X POST https://www.typereach.app/api/automation/generate \
  -H "Authorization: Bearer $AUTOMATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Як набрати перших 1000 підписників",
    "niche": "Music industry",
    "category": "Spotify",
    "language": "uk",
    "billing": "auto",
    "image": false
  }'
```

The immediate success response is `202 { "status": "queued", "jobId": ... }`.
Poll `GET /api/automation/generate/:jobId` until `done` or `error`.

## Queue and batch operations

The shared article/cover worker pool runs up to `GENERATION_CONCURRENCY` jobs
at once (default `3`, maximum `8`). `AUTOMATION_CONCURRENCY` remains a legacy
alias. `GENERATION_AVG_JOB_SECONDS` controls ETA estimates and defaults to 480.
Queue positions include active jobs; `etaSeconds` is zero for jobs that fit in
currently available worker slots.

`POST /api/automation/generate/batch` accepts a JSON array of 1-20 normal
article payloads. It validates the full array before queueing and returns:

```json
{
  "status": "queued",
  "jobs": [
    { "jobId": "gen_...", "position": 1, "etaSeconds": 0, "estimatedCostUsd": { "min": 0.09, "max": 0.31 }, "maxCostUsd": 0.4 },
    { "jobId": "gen_...", "position": 2, "etaSeconds": 0, "estimatedCostUsd": { "min": 0.09, "max": 0.31 }, "maxCostUsd": 0.4 }
  ]
}
```

`DELETE /api/automation/generate/:jobId` cancels only a job that is still
physically queued. It returns `409 job_already_claimed` if a worker already
claimed the job, because provider work may have started.

`GET /api/automation/queue` returns `queueDepth`, `activeWorkers`, configured
`concurrency`, `availableWorkers`, and `averageJobSeconds`.
When a worker finishes, it sends an authenticated self-kick to this route so a
fresh serverless invocation fills the newly available slot. Polling is the
fallback drain trigger if that request cannot be delivered.

All queue endpoints require the same `Authorization: Bearer
<AUTOMATION_API_KEY>` header. Tavily 429 and 5xx responses are retried with
bounded exponential backoff. Text-provider retries are application-controlled
by `MAX_RETRIES_PER_JOB`; authentication, policy, and credit errors are not
retried.

### Custom-language example

```json
{
  "topic": "Com créixer a Spotify",
  "niche": "Music industry",
  "category": "Spotify",
  "language": "custom",
  "languageCustom": "Catalan"
}
```
