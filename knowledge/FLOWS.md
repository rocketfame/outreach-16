# Робочі процеси — TypeReach

## Topic Discovery Flow
1. Юзер вводить бриф (тема, аудиторія, anchor)
2. AI генерує 5-8 topic clusters
3. Юзер обирає теми
4. Генерація outlines → articles

## Direct Article Creation Flow
1. Юзер вводить тему/бриф напряму
2. AI генерує статтю без попереднього discovery

## Humanization Flow
1. Увесь користувацький текст (topics, outlines, articles, SEO fields, edits) генерується через OpenAI API за замовчуванням або optional external provider зі спільним BetterWords 2.1.2 guardrail. Це працює для UI та API, у `seo` і `human` modes
2. Writing mode "human" → обов'язкова гуманізація через Undetectable.AI v2
3. Submit → polling до завершення
4. Якщо Undetectable повертає точний текст `Insufficient credits` → BetterWords 2.1.2 quality rewrite через активний text provider; job-scoped circuit breaker веде решту блоків цього POST/job одразу у fallback. Інші помилки Undetectable не підміняються

## Hero Image Flow
1. Користувач запускає генерацію hero image для статті
2. API формує prompt через Image Box system або custom reference style
3. gpt-image-2 генерує exact 16:9 canvas 1536x864; Automation default — compressed WebP, ручний UI зберігає PNG

## Blog Autopilot Flow
1. Orchestrator викликає `POST /api/automation/generate` з Bearer `AUTOMATION_API_KEY`
2. API валідує payload і прогноз вартості, атомарно резервує повний job cap проти денного/місячного ліміту ключа, створює job і ставить у FIFO-чергу в KV; повертає `202 { jobId, position, etaSeconds, estimatedCostUsd }`. Вичерпаний budget → 429 до queueing
3. Черга дренується опортуністично: кожен POST і кожен GET-poll — drain-тригер; наступна джоба виконується в `after()` тієї інвокації, яка захопила слот (атомарний SET NX + one-shot started-guard проти подвійного виконання)
4. Job генерує одну статтю через existing article pipeline (мовою з запиту), humanization, Tavily sources, optional 16:9 cover image. Усі платні етапи ділять job-scoped hard cap; кожен call резервує worst-case до старту. Retry також ділить спільний ліміт. Search failure має окремий `source_lookup_failed`; успішний порожній source gate — `no_independent_sources`. Внутрішні виклики обходять per-IP rate limiter (in-process токен)
5. Orchestrator poll-ить `GET /api/automation/generate/:jobId`; queued відповіді містять position/etaSeconds — оркестратор сам вирішує, чекати чи відкласти
6. Перед done проходять integrity/orthography/brand guards. Done response повертає body-only `contentHtml`, `cover.base64`, `meta.language`, фактичний `meta.billingSource`, `meta.textProvider`, `quotaRemaining:null` і `costUsd`. Error response теж завжди містить `costUsd`; публікація залишається на стороні orchestrator/CMS
7. Running-джоба без прогресу 10+ хв → GET повертає `job_timeout` error і звільняє слот (мертвий function instance)

## Trial System
- Trial tokens з env TRIAL_TOKENS
- Ліміти: 4 discovery articles, 8 direct articles, 4 topic searches, 10 images, 12 total
- Vercel KV для persistent tracking
