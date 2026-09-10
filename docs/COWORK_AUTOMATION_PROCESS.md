# TypeReach Automation — як працює весь процес (для Cowork / оркестратора)

Оновлено: 2026-09-10. Хост: `https://www.typereach.app` (тільки `www`, apex
редіректить і губить `Authorization`). Авторизація: `Authorization: Bearer <AUTOMATION_API_KEY>`.
Повний контракт полів: `docs/AUTOMATION_API.md`. Короткий довідник: `knowledge/API.md`.

---

## 1. Що це і для кого

Один API, два споживачі:

1. **PromoSoundGroup outreach / guest-post батчі** — 10-12 статей за раз за
   таблицею "план закупки/anchors". Cowork формує ТЗ-бриф на кожну статтю
   (тема, формат, анкор, бренд, мова) і подає джоби.
2. **Free-Followers.net blog autopilot** — постить за графіком із
   `content-plan.json`.

З 2026-09-10 бриф Cowork може задавати **формат**: звичайна outreach-стаття,
**лістікл** або **порівняння**. Формат — окреме поле, не треба "вмовляти"
модель через текст.

---

## 2. Життєвий цикл однієї джоби

```
POST /api/automation/generate  (або /batch)
  │
  ├─ 0. Валідація полів → 400 {code:"invalid_request", field, allowed}
  ├─ 1. Резолв гуманізатора по ЖИВОМУ балансу Undetectable.AI
  │     auto → undetectable (якщо баланс ≥ maxWords×1.1) інакше betterwords
  │     undetectable → 422 humanizer_credits_insufficient, якщо балансу нема
  │     betterwords → Undetectable не чіпається
  ├─ 2. Естімейт вартості {min,max} ЗА резолвнутим провайдером
  │     min > maxCostUsd → 422 estimated_cost_exceeds_cap ($0.00)
  ├─ 3. Резервація денного/місячного ліміту → 429 при вичерпанні
  └─ 4. 202 {jobId, position, etaSeconds, estimatedCostUsd, maxCostUsd, humanizer, format}

GET /api/automation/generate/:jobId  (поллінг; кожен poll дренить чергу)
  queued → running → done | error   (running > 10 хв → job_timeout)
```

Усередині `running` (усе під одним бюджетом `maxCostUsd`, кожен платний крок
резервує worst-case до старту):

```
A. Джерела     2 Tavily-пошуки basic ($0.01 кожен, KV-кеш 7 днів → $0.00 повторно)
               classifier малою моделлю; фільтр: форуми/thread/SEO-блоги/відео геть
               ≥1 незалежне джерело (Billboard, MBW, Pew, MIDiA, IFPI, …) або no_independent_sources
B. Драфт       1 виклик текстової моделі (gpt-5.5, reasoning low) з промптом:
               topic (= H1 вербатим) + brief Cowork + директива формату + мова + бренд + анкор
               → JSON articleBlocks → парсинг → cleanText → HTML
C. Repair      sanitize → зайві лінки геть (цілим реченням) → короткі анкори цитат
               → лапки → casing → бренд-токен → один money-анкор → точний anchor href
D. Перевірки   truncated_output | orthography_invalid | below_min_words
               anchor_missing | anchor_misplaced (перші 3 абзаци) | anchor_broken
               ФЕЙЛ → ОДИН retry драфту (B→C→D) з корективами; повторний фейл → error
E. Гуманізація (тільки mode:"human") — РІВНО ОДИН РАЗ, на ПРИЙНЯТОМУ драфті
               probe-резервація всієї суми ($0.0005×слова) до першого submit
               блоки ≥100 символів, по 5 паралельно; h1 ніколи; бренд/анкор/лапки заморожені
               Undetectable → на точній помилці "Insufficient credits" решта блоків → BetterWords
               після: фіналізація HTML → repair (C) → перевірки (D) повторно
               фейл → humanized_draft_rejected (кредити списані один раз, авто-повтору нема)
               0 гуманізованих блоків → humanization_failed (негуманізоване не шипиться як human)
F. Обкладинка  gpt-image-2 1536×864 webp (~$0.05 medium), якщо image:true
G. Результат   done {article:{title,slug,seoTitle,seoDescription,excerpt,contentHtml,cover},
                     meta:{costUsd,wordCount,humanized,humanizationProvider,
                           undetectableWordsUsed,format,language,imageStyle,…}}
```

**Ключова зміна 2026-09-10:** до цього гуманізація сиділа всередині кроку B,
тобто retry у D платив Undetectable двічі, а cost cap міг убити джобу посеред
гуманізації вже після списання кредитів. Тепер відхилений драфт коштує лише
токени моделі, а кредити списуються один раз і лише тоді, коли стаття вже
пройшла перевірки.

---

## 3. Гроші й кредити — що виставляти

| Сценарій | `mode` | `humanizer` | `maxCostUsd` | Очікувана вартість |
|---|---|---|---|---|
| Дешева стаття без гуманізації | `standard` | — | `0.40` (default) | $0.15-0.30 |
| Human, дешево (BetterWords через модель) | `human` | `betterwords` | `0.40` | $0.20-0.35 |
| Human на Undetectable, 1200-1800 слів | `human` | `undetectable` або `auto` | **`1`** | $0.85-1.00 (з них ~$0.6-0.9 кредити) |

- Кредити Undetectable: **1 кредит = 1 слово**. Джоба потребує ≈ `maxWords × 1.1`.
  На 1500-словну статтю йде ~1500-1650 слів. Тариф 20K слів/міс ≈ 12-13 статей.
- Перед батчем на Undetectable: `GET /api/automation/config` →
  `humanizer.undetectableCredits`. Батч звіряється з **кумулятивною** потребою:
  при `auto` джоби, на які балансу вже не вистачає, тихо йдуть у `betterwords`
  (видно в 202 як `humanizer`), при `undetectable` — 422 на весь батч.
- Вартість, яку реально списано, завжди в `costUsd` (і в `done`, і в `error`).
  `meta.undetectableWordsUsed` — скільки слів пішло в Undetectable.
- Ліміти: `DAILY_COST_LIMIT_USD` $5, `MONTHLY_COST_LIMIT_USD` $100 на ключ.

---

## 4. ТЗ-бриф від Cowork → поля запиту

```json
{
  "topic": "7 Ways to Get Real Spotify Followers in 2026",
  "niche": "Music industry",
  "category": "Spotify",
  "format": "listicle",
  "mode": "human",
  "humanizer": "auto",
  "maxCostUsd": 1,
  "language": "en",
  "brand": "PromoSoundGroup",
  "anchor": "buy Spotify followers",
  "anchorUrl": "https://promosoundgroup.net/...",
  "brief": "Аудиторія: indie-артисти 18-30. Обов'язково: Release Radar, Spotify for Artists pitching, playlist outreach. Тон: практичний, без хайпу.",
  "minWords": 1200,
  "maxWords": 1800,
  "image": true,
  "imageQuality": "medium",
  "excludeImageStyles": ["family:neon"]
}
```

Що куди:

- **`topic`** — H1 вербатим. Для лістікла число в topic задає кількість пунктів
  ("7 Ways…" → рівно 7 H2 `1. …`). Для порівняння назви опцій мають бути в topic
  або в brief ("X vs Y", "A, B or C").
- **`format`** — `article` (default, модель сама обирає структуру за brief) /
  `listicle` / `comparison`. Директива додається до brief автоматично, дублювати
  її текстом не треба; brief лишається для змісту (аудиторія, обов'язкові
  пункти, кут, що НЕ писати).
- **`brand`** — лише ім'я (`PromoSoundGroup`), ніколи URL/домен (400). Ім'я
  заморожується перед гуманізатором і відновлюється після.
- **`anchor` + `anchorUrl`** — разом або ніяк. Один money-анкор у перших 3
  абзацах, точний текст, перевіряється.
- **`brief`** ≤ 2000 символів, будь-якою мовою; це "ТЗ" і йде у промпт як є.
- **`language`** — ISO або назва; slug завжди ASCII-транслітерація.

### Що очікувати від форматів

- **article** — narrative guide: H2-секції, списки лише де brief просить, 0-2
  таблиці за потреби.
- **listicle** — intro (1-2 абзаци) → N нумерованих H2 (`1. …`), під кожним
  2-4 абзаци (що / чому / як застосувати) → короткий wrap-up H2. Без вкладених
  списків і без таблиці порівняння.
- **comparison** — абзац "для кого яка опція" → рівно одна таблиця
  (критерії × опції) → H2-вердикт на кожен критерій → H2 "Which to choose" з
  рекомендацією на кожен use case. Без вигаданих цифр/цін/рейтингів: чого нема
  в джерелах — пояснюється механізм.

---

## 5. Коди помилок, які треба обробляти

| Код | Коли | Що робити |
|---|---|---|
| `invalid_request` (400) | поле не пройшло валідацію; є `field`, `allowed` | виправити payload |
| `humanizer_credits_insufficient` (422) | `humanizer:"undetectable"`, балансу нема | поповнити / `auto` / `betterwords` |
| `humanizer_not_configured`, `humanizer_balance_unavailable` (422) | ключа нема / Undetectable не відповів | `auto` або `betterwords`, повторити пізніше |
| `estimated_cost_exceeds_cap` (422) | навіть `min` > `maxCostUsd`, $0.00 | підняти cap (до $1), `betterwords`, коротша стаття, без картинки |
| `daily_budget_exceeded`, `monthly_budget_exceeded` (429) | ліміт ключа | чекати / підняти env |
| `truncated_output`, `below_min_words`, `anchor_*`, `orthography_invalid` | драфт не пройшов після retry | змінити topic/brief (конкретніша ніша), знизити `minWords` |
| `humanized_draft_rejected` | гуманізований текст зламав перевірки | повторна джоба = нові кредити; або `betterwords` для цієї теми |
| `humanization_failed` | 0 блоків гуманізовано | перевірити ключ/баланс; `betterwords` |
| `cost_cap_exceeded` | рантайм упёрся в cap (тепер має бути рідко) | подивитись `costUsd`, підняти cap |
| `no_independent_sources`, `source_lookup_failed` | джерел нема / Tavily впав | конкретніша ніша або повтор |
| `job_timeout` | running > 10 хв | повторити джобу |

---

## 6. Рекомендований цикл для батчу (Cowork)

1. `GET /api/automation/config` → перевірити `humanizer.undetectableCredits`,
   `cost.defaultMaxCostUsd`, `request.formats`.
2. Скласти payload'и з ТЗ (розділ 4). Для Undetectable-джоб — `maxCostUsd: 1`.
3. `POST /generate/batch` (≤20). У відповіді для кожної джоби подивитись
   `humanizer` (чи не впало в `betterwords`) та `estimatedCostUsd`.
4. Поллінг `GET /generate/:jobId` за `etaSeconds`; `excludeImageStyles`
   акумулювати з `meta.imageStyle` готових джоб.
5. У `done` перевірити: `meta.humanized === true`, `meta.humanizationProvider`,
   `meta.wordCount ≥ minWords`, `meta.format`, анкор у `contentHtml`.
6. Не запускати батчі в go-days Free-Followers (звіритись із content-plan.json).

---

## 7. Вибіркова гуманізація (з 2026-09-10)

Два синхронні ендпоінти для циклу «драфт → детект → гуманізувати лише
позначене → детект» (контракт у `docs/AUTOMATION_API.md` § Text operations):

- `POST /api/automation/detect` — `blocks[]` → `score`/`flagged` на блок.
  0.1 кредита Undetectable за слово (2 700 слів ≈ 270 кредитів ≈ $0.13).
  Блоки < 50 слів позначаються `unreliable`, групуйте короткі абзаци по секціях.
- `POST /api/automation/humanize` — лише позначені `blocks[]` + `brand`,
  `anchor`, `humanizer`, `maxCostUsd` → переписані блоки в тому ж порядку,
  `meta.undetectableWordsUsed`, `costUsd`.

Рекомендований цикл на статтю: generate `mode:"standard"` (нуль кредитів) →
редактура → detect → humanize flagged (`humanizer:"auto"`, `maxCostUsd: 1`) →
detect повторно (один раунд). Бюджет на 2 700 слів при ~30 % позначених:
≈ 1 350 кредитів (~$0.66) замість 2 700 при повній гуманізації.

