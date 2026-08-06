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

All generated article and SEO text uses the shared BetterWords 2.1.2
production-writing rules, including both `seo` and `human` modes. For
`mode: "human"`, Undetectable.AI is additionally the primary rewrite provider. An
exact `Insufficient credits` response switches the remaining work in that job to the
OpenAI-backed BetterWords 2.1.2 quality rewrite. `meta.humanizationProvider`
reports `undetectable`, `betterwords`, or `mixed`. If neither provider rewrites
any block, the job fails with `humanization_failed`; unhumanized copy is never
reported as a successful human-mode article.

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
