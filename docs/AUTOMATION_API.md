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

### Quality and source failures

Before a job becomes `done`, paragraph integrity is checked for missing terminal
punctuation, dangling colons, unbalanced quotes, and sentence fragments that
start with a lowercase letter or bare digit. A failed draft is retried once; a
second failure returns `truncated_output`.

Source-search provider failures return `source_lookup_failed`. This is distinct
from `no_independent_sources`, which means search completed but no live
independent source survived policy and availability checks. Server diagnostics
include outbound-search execution, candidate counts, and a rejection reason for
each discarded URL. If an initially approved independent candidate fails the
live-URL check, the pipeline runs one broader allowlisted recovery search (up
to 20 candidates) before returning `no_independent_sources`; the requirement
for at least one live independent source is not relaxed.

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

### Cover format

Automation cover generation defaults to `coverFormat: "webp"` with 80% output
compression. Set `coverFormat: "png"` for legacy consumers. The returned
`cover.format` always reports the actual encoding.

### Ukrainian example

```bash
curl -X POST https://typereach.app/api/automation/generate \
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
    { "jobId": "gen_...", "position": 1, "etaSeconds": 0 },
    { "jobId": "gen_...", "position": 2, "etaSeconds": 0 }
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
bounded exponential backoff. The text-provider SDK has two bounded retries for
connection failures, 408/409/429, and 5xx responses. Authentication, policy,
and credit errors are not retried.

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
