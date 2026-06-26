# API — TypeReach

## Internal API Routes
- `POST /api/generate-topics` — генерація topic clusters (rate limit: search 30/min)
- `POST /api/articles` — генерація статей (rate limit: generate 10/h, maxDuration: 300s)
- `GET /api/trial-usage` — поточний стан trial usage
- `POST /api/search-images` — пошук зображень (rate limit: search)
- `POST /api/checkout` — Stripe checkout session
- `POST /api/automation/generate` — async blog autopilot generation job (Bearer `AUTOMATION_API_KEY`, returns `202 { jobId }`)
- `GET /api/automation/generate/:jobId` — polling endpoint for automation jobs (`queued|running|done|error`)

## External Services
- **OpenAI GPT-5.5** — генерація статей та topic clusters
- **gpt-image-2** — 16:9 hero images (1536x864 PNG, ChatGPT Images 2.0)
- **Undetectable.AI v2** — гуманізація тексту (submit + polling)
- **Tavily** — валідація trust sources
- **Stripe** — оплата та upgrade
- **Vercel KV** — persistent trial usage tracking
