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
1. Стаття генерується через GPT-5.5
2. Writing mode "human" → обов'язкова гуманізація через Undetectable.AI v2
3. Submit → polling до завершення

## Hero Image Flow
1. Користувач запускає генерацію hero image для статті
2. API формує prompt через Image Box system або custom reference style
3. gpt-image-2 генерує exact 16:9 PNG canvas: 1536x864

## Blog Autopilot Flow
1. Orchestrator викликає `POST /api/automation/generate` з Bearer `AUTOMATION_API_KEY`
2. API валідує (category вільний текст / деривація з ніші, mode default human, language проти supported list), створює job і ставить у FIFO-чергу в KV; повертає `202 { jobId, position, etaSeconds }`
3. Черга дренується опортуністично: кожен POST і кожен GET-poll — drain-тригер; наступна джоба виконується в `after()` тієї інвокації, яка захопила слот (атомарний SET NX + one-shot started-guard проти подвійного виконання)
4. Job генерує одну статтю через existing article pipeline (мовою з запиту), humanization, Tavily sources, optional 16:9 cover image. Внутрішні виклики обходять per-IP rate limiter (in-process токен)
5. Orchestrator poll-ить `GET /api/automation/generate/:jobId`; queued відповіді містять position/etaSeconds — оркестратор сам вирішує, чекати чи відкласти
6. Done response повертає body-only `contentHtml`, `cover.base64` і `meta.language` (echo резолвнутої мови); публікація залишається на стороні orchestrator/CMS
7. Running-джоба без прогресу 10+ хв → GET повертає `job_timeout` error і звільняє слот (мертвий function instance)

## Trial System
- Trial tokens з env TRIAL_TOKENS
- Ліміти: 4 discovery articles, 8 direct articles, 4 topic searches, 10 images, 12 total
- Vercel KV для persistent tracking
