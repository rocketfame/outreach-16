# API — TypeReach

## Internal API Routes
- `POST /api/generate-topics` — генерація topic clusters (rate limit: search 30/min)
- `POST /api/articles` — генерація статей (rate limit: generate 10/h, maxDuration: 300s)
- `GET /api/trial-usage` — поточний стан trial usage
- `POST /api/search-images` — пошук зображень (rate limit: search)
- `POST /api/checkout` — Stripe checkout session
- `POST /api/automation/generate` — async blog autopilot generation job (Bearer `AUTOMATION_API_KEY`). Повертає `202 { status:"queued", jobId, position, etaSeconds }` — джоба реально стає в FIFO-чергу (KV list `automation:queue`), а не відхиляється пост-фактум.
  - `niche` — required, вільний текст
  - `category` — optional, вільний текст (будь-яка платформа); якщо omitted — деривується з platform presets ніші (`config/platformPresets.ts`). Відомі платформи (Instagram/TikTok/YouTube/Facebook/SoundCloud/Spotify/Growth/Beatport/Twitch) отримують кураторські `site:` запити для trust sources, невідомі — generic-запит без site-обмежень
  - `mode` — optional, `"human"` (default) | `"standard"`
  - `language` — optional, повна назва ("Spanish") або ISO-код ("es"); валідується проти `SUPPORTED_LANGUAGES` (`config/languages.ts`), default English. Резолвнута мова ехається в `meta.language` результату
  - `brand` — optional, ІМʼЯ бренду plain text ("PromoSoundGroup"); URL або голий домен → 400 (домен у тексті жує гуманізатор — "net-glitch"). Йде в brief.clientSite → [[BRAND_NAME]] промпта, інструкція "mention 2-3 times as plain name", заморожується перед Undetectable
  - `brief` — optional, до 2000 символів; додається до згенерованого topic brief
  - `minWords` — це floor, не hint: draft нижче floor → один retry з підвищеним таргетом, потім error code `below_min_words` (а не `done` зі стабом). `meta.wordCount` у результаті для assert
  - `imageStyle` — optional, id image box пресета (`lib/imageBoxPrompts.ts`, 40 активних, 9 палітрових сімей `PALETTE_FAMILIES`); пінить конкретний стиль, невідомий id → 400 + `allowed[]`. `imageStyle` без `image:true` → 400
  - `excludeImageStyles` — optional, масив id АБО `family:<назва>` (розгортається на всі бокси сімʼї). Batch de-dup: оркестратор акумулює `meta.imageStyle` з готових джоб і передає список у наступні. Виключити все → 400
  - `meta.imageStyle` — id використаного пресета в результаті. Selection: family-aware двоступеневий random (сімʼя uniform → бокс усередині) — палітрові кластери в батчах вирівнюються статистично; stateless per job
  - `imageQuality` — optional, `"low" | "medium" | "high"` для gpt-image-2 (~$0.013 / ~$0.05 / ~$0.20 за 1536x864). Default: `HERO_IMAGE_QUALITY` env, інакше `high`. Без `image:true` → 400
  - Джерела: `/thread/`, форуми, reddit/quora, SEO-блоги (backlinko тощо) і video-цитати відфільтровуються (`lib/sourcePolicy.ts` + `lib/automation/linkGuard.ts`); `hl` на support.google.com форситься в `en`; фінальний guard розгортає заборонені лінки в тексті (анкор недоторканий)
  - Помилки валідації machine-readable: `{ code, message, field?, allowed? }`
- `GET /api/automation/generate/:jobId` — polling endpoint (`queued|running|done|error`). Для queued повертає `position` (1 = наступна до виконання) та `etaSeconds`. Кожен poll — drain-тригер черги (наступна джоба виконується в `after()` цієї ж інвокації). Running довше 10 хв → `job_timeout` error. Concurrency: `AUTOMATION_CONCURRENCY` env (default 1, max 8). Внутрішні automation-виклики `/api/articles` та `/api/article-image` обходять per-IP rate limiter через in-process токен (`lib/automation/internal.ts`)

## External Services
- **OpenAI GPT-5.5** — генерація статей та topic clusters
- **gpt-image-2** — 16:9 hero images (1536x864 PNG, ChatGPT Images 2.0)
- **Undetectable.AI v2** — гуманізація тексту (submit + polling)
- **Tavily** — валідація trust sources
- **Stripe** — оплата та upgrade
- **Vercel KV** — persistent trial usage tracking
