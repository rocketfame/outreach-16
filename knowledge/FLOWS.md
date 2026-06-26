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
2. API створює async job і повертає `202 { jobId }`
3. Background task генерує одну статтю через existing article pipeline, humanization, Tavily sources, optional 16:9 cover image
4. Orchestrator poll-ить `GET /api/automation/generate/:jobId`
5. Done response повертає body-only `contentHtml` і `cover.base64`; публікація залишається на стороні orchestrator/CMS

## Trial System
- Trial tokens з env TRIAL_TOKENS
- Ліміти: 4 discovery articles, 8 direct articles, 4 topic searches, 10 images, 12 total
- Vercel KV для persistent tracking
