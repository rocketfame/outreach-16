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
OpenAI-backed BetterWords 2.1.2 quality rewrite. `meta.humanizationProvider`
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
each discarded URL.

API-supplied `brand` values are immutable visible-text tokens. For example,
`PromoSoundGroup` is restored byte-for-byte if a model inserts spaces or changes
capitalization.

Malformed model JSON is retried once with a corrective JSON instruction before
the job can fail with `generation_failed`.

### Billing

`billing` accepts `auto` (default), `api`, or `subscription`. At present,
TypeReach calls the OpenAI API directly and has no workspace subscription-quota
provider. Therefore `auto` and `api` use API billing; successful result metadata
reports `billingSource: "api"` and `quotaRemaining: null`.

`billing: "subscription"` fails synchronously with
`subscription_billing_unavailable` before the job is queued, so it cannot
silently spend API funds. A ChatGPT workspace subscription cannot fund OpenAI
API calls; implementing subscription billing requires a separate TypeReach
quota ledger and provider contract. `costUsd` is an upstream usage estimate, not
a TypeReach subscription charge. Upstream providers charge work already
performed even when a later TypeReach quality gate rejects the result.

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
