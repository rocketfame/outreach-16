# ORCHESTRATOR BRIEF — пояснювальна записка для оркестратора

> Це вхідний документ для AI-оркестратора, який керуватиме розробкою проєкту.
> Мета: за 10 хвилин дати повну й точну картину — що це за проєкт, де що лежить
> (локально й на GitHub), як усе шукати, як запускати/перевіряти, і **головне —
> як не зламати продакшн**. Технічні терміни, шляхи і команди — англійською/кодом;
> пояснення — українською.
>
> Станом на: 2026-07 · Канонічне джерело правди по коду — `CLAUDE.md` у корені репо.

---

## 0. Найважливіше за 30 секунд (прочитай перш за все)

1. **Коміт = деплой у прод. Негайно.** У репозиторії стоїть git-hook
   `.git/hooks/post-commit`, який робить `git push` після **кожного** коміту.
   Гілка `main` авто-деплоїться на Vercel (`typereach.app`). **PR-рев'ю, staging,
   preview-гейта — НЕМАЄ.** Будь-який `git commit` на `main` за секунди їде в прод.
2. **Отже золоте правило:** нічого не комітити, поки зміна не пройшла
   `npx tsc --noEmit` і (для генерації/автоматизації) відповідний smoke-тест.
   Ставитись до кожного коміту як до релізу.
3. **Один репозиторій, два локальні шляхи.** `~/typereach` — це **симлінк** на
   `~/Documents/GitHub/outreach-16`. Це та сама тека, не копія. Канонічний шлях —
   `~/Documents/GitHub/outreach-16`.
4. **Є ДРУГИЙ проєкт** — `free-followers-cms` (Railway, блог-автопілот). Локально
   він **не склонований**; клонувати через `gh`/`git` за потреби. Деталі — §9.
5. **Не чіпати security-правила** (rate-limit, access-gate, trial-токени) — §7.

---

## 1. Що це за проєкт

**TypeReach (Outreach Articles App)** — веб-застосунок, який з брифу генерує
outreach-статті: планування брифів → discovery тем → аутлайни → написання статей,
з гуманізацією та hero-зображеннями. Прод: **`typereach.app`**.

Два режими генерації:
- **Topic Discovery Mode** — AI знаходить кластери тем, юзер обирає, генерує статті.
- **Direct Article Creation Mode** — юзер дає тему/бриф напряму, одна стаття.

Режими письма: `seo` (дефолт) і `human` (редакційний з обов'язковою гуманізацією).

**Стек:** Next.js 16 (App Router), React 19, TypeScript strict, OpenAI GPT-5.5
(текст) + gpt-image-2 (hero), Undetectable.AI v2 (гуманізація), Tavily (trust-джерела),
Stripe (апгрейд), Vercel + Vercel KV (Upstash Redis для trial-usage).

---

## 2. Де що лежить: локально vs GitHub

| Що | Де |
|---|---|
| GitHub репо (єдине джерело) | `github.com/rocketfame/outreach-16`, гілка **тільки `main`** |
| Локальний канонічний шлях | `/Users/serhiosider/Documents/GitHub/outreach-16` |
| Симлінк-аліас | `/Users/serhiosider/typereach` → той самий каталог |
| Git-юзер | `rocketfame` (креденшали збережені; `gh` CLI окремо не залогінений — для GitHub API робити `gh auth login` за потреби) |
| Хостинг | Vercel, auto-deploy на push у `main` |
| Персистентний стан | Vercel KV (trial-usage); решта — localStorage у браузері |
| Пам'ять сесій Claude | `/Users/serhiosider/.claude/projects/-Users-serhiosider-Documents-GitHub-outreach-16/memory/` (+ `MEMORY.md` індекс) |
| Заплановані скіли/автопілоти | `/Users/serhiosider/Documents/Claude/Scheduled/` (`daily-outreach-pipeline`, `daily-outreach-report`, `free-followers-blog-autopilot`) |

---

## 3. Дерево проєкту (структура коду)

```
outreach-16/
├── CLAUDE.md                  # ★ джерело правди: архітектура + правила. Читати першим.
├── ORCHESTRATOR_BRIEF.md      # (цей файл)
├── middleware.ts              # тонка обгортка над app/proxy.ts
├── next.config.ts             # security headers (CSP/HSTS/noindex), webpack, images
├── package.json               # scripts: dev/build/start/lint/docs:pdf
├── app/
│   ├── proxy.ts               # ★ головний access-gate (trial→IP→maintenance→basic auth)
│   ├── page.tsx               # ★ головний UI-shell (~7000 рядків): режими, генерація, експорт
│   ├── layout.tsx             # шрифти, robots noindex/nofollow
│   ├── robots.ts              # Disallow: /
│   ├── globals.css            # ~5500 рядків, 32 секції (шукати за роздільниками ════)
│   ├── not-found.tsx
│   ├── components/            # MaintenanceGate, TrialUsageDisplay, TrialLimitReached, UpgradeModal, ...
│   ├── hooks/
│   │   └── usePersistentAppState.ts  # ★ типи Brief/Topic/GeneratedArticle + localStorage-стан
│   └── api/                   # усі бекенд-роути (див. §4.2)
├── lib/                       # вся бізнес-логіка (див. §4)
│   └── automation/            # in-process пайплайн автоматизації (auth, jobStore, pipeline, runner, ...)
├── config/                    # languages.ts, platformPresets.ts
├── scripts/                   # *.test.ts smoke-тести (через npx tsx) + утиліти
├── knowledge/                 # ★ ARCHITECTURE.md, API.md, FLOWS.md, ERRORS.md
├── docs/                      # AGENT_HANDOFF.md/.html/.pdf, DIRECT_ARTICLE_FLOW..., ...
└── *.md                       # тематична документація (див. §10)
```

★ = файли, які оркестратор має розуміти в першу чергу.

---

## 4. Карта коду за шарами

### 4.1 Access control & security
- `middleware.ts` → `app/proxy.ts` — головний гейт: trial-токен bypass → IP-allowlist
  → maintenance-gate → basic-auth fallback. Non-master IP на `/` **завжди** бачить
  `MaintenanceGate`, ніколи сирий 403.
- `lib/accessConfig.ts` — читає `MASTER_IPS` (env, comma-separated) з `FALLBACK_IPS`.
- `app/components/MaintenanceGate.tsx` — клієнтський гейт, валідує trial-токени через
  `/api/trial-usage` (жодного хардкоду токенів на клієнті).
- `lib/rateLimit.ts` — per-IP rate limiter. Категорії: `generate` (10/h), `search`
  (30/min), `read` (60/min), `auth` (5/5min).
- `next.config.ts` — CSP, HSTS, X-Frame-Options, noindex/nofollow.

### 4.2 API-роути (`app/api/**/route.ts`)
Генерація/пошук: `articles`, `generate`, `generate-topics`, `search-images`,
`article-image`, `analyze-image-style`, `edit-article`, `humanize`, `find-links`.
Automation: `automation/generate`, `automation/generate/[jobId]`, `automation/cover`.
Доступ/біллінг/сервіс: `check-access`, `check-auth`, `trial-usage`, `cost-tracker`,
`stripe/create-checkout`, `stripe/webhook`, `test-tavily`.
> **Правило:** кожен роут генерації/пошуку МУСИТЬ викликати
> `checkRateLimit(getClientIP(req), category)`. Єдиний виняток — внутрішні виклики
> автопайплайна через `isInternalAutomationCall()` (§7).

### 4.3 Trial-система
`lib/trialLimits.ts` (джерело правди лімітів + Vercel KV), `lib/trialConfig.ts`
(`TRIAL_TOKENS` env), `/api/trial-usage`, `TrialUsageDisplay.tsx`. Ліміти: discovery
articles 4, direct articles 8, discovery runs 4, images 10, загальний cap 12.

### 4.4 Пайплайн генерації статей
`app/api/articles/route.ts` (maxDuration 300s; визначає режим за першою темою) →
`lib/articlePrompt.ts` (`buildArticlePrompt` / `buildDirectArticlePrompt`) →
`lib/articleStructure.ts` (структура блоків, таблиці, trust-джерела, `blocksToHtml`) →
`lib/textPostProcessing.ts` (`cleanText`, `fixHtmlTagSpacing`, `removeExcessiveBold`) →
`lib/humanizerClient.ts` + `lib/sectionHumanize.ts` + `humanizeFormatter/Protection/Repair` →
`lib/trustSourceFilter.ts` + `lib/sourceClassifier.ts` + `lib/sourcePolicy.ts`.

### 4.5 Автоматизація (in-process)
`lib/automation/`: `runner.ts`, `pipeline.ts` (генерує + `sanitizeAutomationHtml`),
`jobStore.ts` (FIFO-черга), `auth.ts` (`AUTOMATION_API_KEY`), `internal.ts`
(`isInternalAutomationCall`, per-process токен), `linkGuard.ts`, `validate.ts`,
`types.ts`. Викликається зовні через `AUTOMATION_API_KEY`, троттлиться чергою.

### 4.6 Publisher Sheet (нове, ця сесія)
`lib/publisherSheet.ts` — `buildPublisherSheet()` збирає handoff-документ (SEO Title,
Meta, slug, H1, H2/H3, featured image, alt, точний анкор, target URL + boilerplate-вимоги
`PUBLISHER_REQUIREMENTS`). Вбудований у **ручні** експорти («Copy text») у `app/page.tsx`,
**ніколи** не потрапляє в тіло статті / автопайплайн.

### 4.7 Design system
`app/globals.css` (CSS custom properties, ~42 токени, Plus Jakarta Sans, warm dark
`#0B0B0F`), `lib/designTokens.ts`.

---

## 5. Як запускати, перевіряти, тестувати

```bash
npm run dev            # локальний dev-сервер (localhost:3000)
npx tsc --noEmit       # ★ ГОЛОВНА перевірка типів (обов'язково перед комітом)
npm run lint           # eslint
npx tsx scripts/<name>.test.ts   # smoke-тести (automation, cover, defects, queue, outreach-spec, imagebox)
git log --oneline -15
```

- **`next build` у пісочниці може падати** через FUSE `EPERM unlink .next/BUILD_ID` —
  тому для локальної перевірки використовуй `npx tsc --noEmit`. Реальні білди — на Vercel.
- Тест-раннера (jest/vitest) у `package.json` немає — smoke-тести це самостійні
  `tsx`-скрипти в `scripts/`. Запускати ті, що стосуються зміненої зони.
- Локальний тест автоматизації: `AUTOMATION_API_KEY=localtest npm run dev`, далі
  `curl` на `/api/automation/generate` з `Authorization: Bearer localtest`.

---

## 6. Deploy flow — КРИТИЧНО

```
git commit  ──►  .git/hooks/post-commit  ──►  git push origin main  ──►  Vercel build+deploy  ──►  typereach.app
   (будь-який)        (авто, завжди)              (авто)                    (авто, ~кілька хв)        (прод)
```

- **Немає PR. Немає staging. Немає ручного approve.** Коміт на `main` = реліз.
- Історично коміти часто мають повідомлення `"1"` (терсно) — це ок для цього репо,
  але **вміст коміту завжди має бути перевірений**.
- Зміни env-змінних на Vercel вимагають **redeploy**, щоб застосуватись.
- **Як безпечно робити ризиковану роботу без деплою:** працюй на **локальній гілці
  без upstream** — `post-commit` пропускає push, якщо upstream не заданий
  (`git checkout -b wip/xxx` і НЕ роби `push -u`). Зливай у `main` лише після
  повної перевірки. На `main` не форс-пушити ніколи.

---

## 7. Правила та запобіжники (do-not-break)

**Security (не ламати ніколи):**
- Trial-токени читаються ТІЛЬКИ з `TRIAL_TOKENS` env — не хардкодити на клієнті.
- `MASTER_IPS` з env + `FALLBACK_IPS` — не логувати повний список.
- Cookies лише через `COOKIE_OPTIONS` (`app/proxy.ts`): httpOnly, secure у prod, sameSite strict.
- Кожен generation/search роут МУСИТЬ викликати `checkRateLimit`. Єдиний
  санкціонований bypass — внутрішні виклики автопайплайна через
  `isInternalAutomationCall()` (`lib/automation/internal.ts`, per-process
  непідробний токен). **Не «чинити» цей bypass назад.**
- Non-master IP на `/` мусить бачити `MaintenanceGate`, ніколи сирий 403.
- Жодних `console.log` токенів, ключів, IP, PII.

**Стиль/архітектура:**
- Весь UI-текст — **англійською** (продукт англомовний). У чаті Claude відповідає українською.
- TypeScript strict — без `any`, крім неминучого.
- React 19 / Next 16: server components за замовчуванням, `"use client"` лише де треба.
- Один `<h1>` на статтю (інваріант у `articleStructure.ts` — не додавати другий H1).

**Видалене — не повертати:** Light Human Edit, хардкод trial-токенів у `MaintenanceGate.tsx`,
поле `lightHumanEditEnabled` у стані.

**Робочі преференції юзера (з пам'яті):**
- Завжди найпотужніша модель Claude для розробки; найновіші OpenAI-моделі в проді
  (текст — latest GPT, зображення — latest gpt-image). Проактивно пропонувати міграцію.
- Ніколи не пропонувати `/exit` чи рестарт сесії — юзер береже контекст.

---

## 8. Env-змінні (назви, без значень)

Обов'язкові: `OPENAI_API_KEY`, `TAVILY_API_KEY`, `UNDETECTABLE_HUMANIZER_API_KEY`,
`MASTER_IPS`, `TRIAL_TOKENS`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`.
Біллінг: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
Автоматизація: `AUTOMATION_API_KEY`, `AUTOMATION_CONCURRENCY`.
Опційні/тюнінг: `MASTER_TOKEN`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`,
`HERO_IMAGE_QUALITY` (low/medium/high), `MAINTENANCE_ENABLED`,
`NEXT_PUBLIC_MAINTENANCE_ENABLED`, `DEBUG_ANCHORS`, `UNDETECTABLE_HUMANIZER_*`
(BASE_URL/MODEL/READABILITY/PURPOSE/STRENGTH).
> Джерело: `.env.example` + `grep process.env` по `lib/` та `app/`.

---

## 9. Другий проєкт: free-followers-cms (Railway)

- **Репо:** `github.com/rocketfame/free-followers-cms`, гілка `main`.
- **Стек:** Payload CMS + Next.js. Код у `src/**`, контент — `automation/content-plan.json`.
- **Хостинг:** Railway (production), домен `free-followers.net` (+ `/admin`).
- **Локально НЕ склонований** — клонувати через `git clone` за потреби (креденшали є).
- **Блог-автопілот:** скіл `~/Documents/Claude/Scheduled/free-followers-blog-autopilot/SKILL.md`.
  При кожній публікації комітить `automation/content-plan.json`.
- **Deploy-нюанс (виправлено):** у `railway.json` додано
  `watchPatterns: ["**", "!automation/**"]`, щоб контент-коміти автопілота НЕ
  тригерили редеплой CMS (раніше це слало фальшиві «Deploy Crashed» листи).
- Автопайплайн публікує тіло як є (`sanitizeAutomationHtml` вирізає всі `<h1>`,
  заголовок дає CMS) — тому Publisher Sheet і UI-обгортки сюди не застосовні.

---

## 10. Існуюча документація (де копати глибше)

- **`CLAUDE.md`** — ★ архітектура + правила, джерело правди. Завжди читати першим.
- **`knowledge/`** — `ARCHITECTURE.md`, `API.md`, `FLOWS.md`, `ERRORS.md`
  (ERRORS.md — реальні витягнуті уроки, зокрема quota-vs-deploy діагностика).
- **`docs/AGENT_HANDOFF.md`** — попередній handoff для агентів.
- **`TECHNICAL_SPECIFICATION.md`**, **`PRODUCTION_DEPLOY.md`**, **`CONFIGURATION.md`**.
- Тематичні: `TRIAL_SETUP.md`, `MAINTENANCE_GATE.md`, `HUMANIZATION.md`(+`_ANALYSIS`),
  `GPT_5.2_MIGRATION.md`, `VERCEL_KV_SETUP.md`, `VERCEL_LOGS_GUIDE.md`, `STRIPE_SETUP.md`,
  `IMAGE_GENERATION_FEATURE.md`, `TOPIC_META_PREVIEW_TZ.md`, `README_ACCESS_CONFIG.md`.

---

## 11. Робочий процес для оркестратора (безпечний цикл змін)

1. **Зрозумій контекст:** прочитай `CLAUDE.md` + релевантні `knowledge/*`.
2. **Локалізуй** зону зміни (grep/пошук за файлами з §3–§4). Роби **хірургічні**
   правки, тримай стиль сусіднього коду.
3. **Перевір типи:** `npx tsc --noEmit` — має бути exit 0.
4. **Прогони smoke-тест** зміненої зони (automation/generation/cover тощо).
5. **Пам'ятай: коміт = прод.** Не комітити, поки кроки 3–4 не зелені. Для
   ризикованого — гілка без upstream (§6), злиття в `main` лише після перевірки.
6. **Не чіпай** security-інваріанти §7.
7. **Онови документацію**, якщо змінив архітектуру (`CLAUDE.md` / `knowledge/`).

## 12. Pre-commit чеклист (роздрукуй у голові перед кожним комітом)

- [ ] `npx tsc --noEmit` = 0 помилок.
- [ ] Відповідний `scripts/*.test.ts` зелений (якщо зачепив generation/automation).
- [ ] Не порушено жодне security-правило §7 (rate-limit, gate, токени, логи).
- [ ] UI-текст англійською; без `any`; один H1 на статтю.
- [ ] Зміна доречна для негайного деплою в прод (бо коміт → push → Vercel).
- [ ] Якщо потрібні нові env — вони додані на Vercel + зроблено redeploy.

---

_Кінець записки. Якщо щось у цьому документі суперечить `CLAUDE.md` — правий `CLAUDE.md`;
онови цей файл відповідно._
