# Логіка створення статті (поточний потік)

Опис етапів створення статті: де додаються SEO-ключі, коли вмикається humanizer / Human Mode тощо. **Тільки опис логіки, без змін коду.**

---

## 1. Два режими статті

Стаття може створюватися в **двох режимах**; режим визначається **на бекенді** по структурі топика:

| Режим | Умова визначення | Промпт |
|-------|------------------|--------|
| **Topic Discovery** | У топика є хоча б одне з полів: `shortAngle`, `whyNonGeneric`, або валідний `howAnchorFits` (не порожній і не "N/A") | `buildArticlePrompt()` → `TOPIC_DISCOVERY_ARTICLE_PROMPT_TEMPLATE` |
| **Direct Article** | У топика **немає** цих полів (немає `shortAngle`, `whyNonGeneric`, немає валідного `howAnchorFits`) | `buildDirectArticlePrompt()` → `DIRECT_ARTICLE_PROMPT_TEMPLATE` |

- **Topic Discovery**: топики з кластерів (з брифом: shortAngle, whyNonGeneric, howAnchorFits тощо).
- **Direct Article**: один топик з UI "Direct Article" (title + опційно brief + exact keywords); у запиті топик передається **без** shortAngle/whyNonGeneric/howAnchorFits.

Перевірка в API: `app/api/articles/route.ts` (бл. 186–195).

---

## 2. Загальний потік (з UI до відповіді)

### 2.1 Topic Discovery (статті з кластерів топиків)

1. **UI (page.tsx)**  
   Користувач обирає топики з кластерів і натискає генерацію статтей.

2. **Крок 1: пошук trust sources (Tavily)**  
   - Для **кожного** обраного топика викликається `POST /api/find-links` з query: `topic.title + brief.niche + brief.platform + topic.primaryKeyword + "2024 2025"`.  
   - Результати збираються в один набір `allTrustSources` (унікальні рядки `title|url`).  
   - Якщо після всіх топиків список порожній — генерація не запускається.

3. **Крок 2: запит на статті**  
   - `POST /api/articles` з тілом:  
     - `brief` (Project Basics),  
     - `selectedTopics` (обрані топики з полями title, brief, shortAngle, primaryKeyword тощо),  
     - `keywordList`: масив `selectedTopicsData.map(t => t.primaryKeyword).filter(Boolean)` — тобто **SEO-ключі з топиків** збираються тут і передаються один раз на весь запит.  
   - Також передаються:  
     - `trustSourcesList`,  
     - `writingMode` ("seo" | "human"),  
     - `humanizeOnWrite`: для Human Mode завжди `true`, інакше — значення тоглу "Humanize on write".  
     - `humanizeSettings` (якщо humanize увімкнено).

### 2.2 Direct Article (одна стаття з форми)

1. **UI (page.tsx)**  
   Користувач вводить тему, опційно бриф і "exact keywords" (одне на рядок або через кому).

2. **Крок 1: trust sources (Tavily)**  
   - Один виклик `POST /api/find-links` з query на основі теми (direct article topic).  
   - Отримані джерела — `trustSourcesList`.

3. **Крок 2: запит на статтю**  
   - `POST /api/articles` з одним топиком у `selectedTopics`, **без** shortAngle/whyNonGeneric/howAnchorFits (щоб API визначив Direct Mode).  
   - `keywordList`: якщо є exact keywords — `exactKeywordList`, інакше `[directArticleTopic]`.  
   - `exactKeywordList`: якщо користувач заповнив "exact keywords" — масив цих фраз (обов’язково включити в текст без змін).  
   - `writingMode` і humanize — аналогічно: Human Mode ⇒ `humanizeOnWrite: true`, інакше з тоглу.

---

## 3. API `/api/articles`: що відбувається по кроках

(Усе в `app/api/articles/route.ts`.)

1. **Парсинг тіла**  
   - `keywordList`, `exactKeywordList`, `trustSourcesList`, `writingMode`, `humanizeOnWrite`, `humanizeSettings`.

2. **Тріал-ліміти**  
   - Перевірка, чи можна згенерувати N статтей; при порушенні — 403.

3. **Effective Humanize**  
   - `effectiveHumanizeOnWrite = (writingMode === "human") ? true : (body.humanizeOnWrite || false)`.  
   - Тобто **Human Mode завжди вмикає humanize** незалежно від тоглу "Humanize on write".

4. **Цикл по кожному топику з `selectedTopics`**  
   Для кожного топика:

   - **Визначення режиму**: `isDirectMode = !topic.shortAngle && !topic.whyNonGeneric && !hasHowAnchorFits`.

   - **Trust sources**  
     - `trustSourcesList` з запиту перетворюється в `rawSources`, потім йде **LLM-класифікація** (`getTrustedSourcesFromTavily`) або fallback `filterAndSelectTrustSources`.  
     - Результат — список `trustedSources` (формат з id, url, title, type), він потім підставляється в промпт (JSON + старий формат "Name|URL").

   - **Побудова промпту**  
     - **Direct**: `buildDirectArticlePrompt({ ..., keywordList, exactKeywordList, trustSourcesList/JSON/specs, writingMode, ... })`.  
     - **Topic Discovery**: збирається `topicBrief` з shortAngle, whyNonGeneric, howAnchorFits тощо, потім `buildArticlePrompt({ ..., keywordList, trustSourcesList/JSON/specs, writingMode, ... })`.  
     - **SEO-ключі в промпті**:  
       - `keywordList` у API береться так: якщо в тілі є непорожній `keywordList` — він, інакше для топика використовується `topic.primaryKeyword` (масив з одним елементом або порожній).  
       - У промпті список підставляється як заміна плейсхолдера `[[KEYWORD_LIST]]` (у білдерах: `params.keywordList.join(", ")`).  
       - Точне місце використання в тексті промпту залежить від шаблону (SEO title, meta, контекст).

   - **Direct-режим — exact keywords**  
     - Якщо передано `exactKeywordList`, у `buildDirectArticlePrompt` формується блок `[[EXACT_KEYWORDS_SECTION]]` з інструкцією обов’язково включити ці фрази в текст **дослівно**. Інакше цей блок порожній.

   - **Writing mode**  
     - У промпт підставляється `[[WRITING_MODE]]` = `writingMode` ("seo" або "human").  
     - У шаблонах описані окремі правила для "seo" (жорстка SEO-структура) та "human" (editorial/founder style, менше шаблонності).

   - **Виклик OpenAI**  
     - Один виклик `openai.chat.completions.create` (system + user з побудованим промптом), модель "gpt-5.2", `response_format: { type: "json_object" }`, max_completion_tokens 8000.

   - **Парсинг відповіді**  
     - JSON → titleTag, metaDescription, articleBlocks (або articleBodyText/articleBodyHtml).  
     - Валідація обов’язкових полів.

   - **Структура статті**  
     - Якщо є `articleBlocks` — `modelBlocksToArticleStructure(...)` → `ArticleStructure`.  
     - Інакше, якщо є articleBodyText — `parsePlainTextToStructure(...)`.  
     - Плейсхолдери [A1], [T1]–[T3] підставляються з brief і trust sources.

   - **Очистка тексту**  
     - У всіх блоках викликається `cleanText(...)` (невидимі символи тощо).

   - **Humanizer (AI Humanize)**  
     - Виконується **тільки якщо** `effectiveHumanizeOnWrite === true`.  
     - Тобто коли увімкнено **Human Mode** або окремо увімкнено "Humanize on write".  
     - Для кожного блоку: списки — humanize по пунктах; таблиці — по комірках/підписах; параграфи — якщо довгі.  
     - Плейсхолдери [A1], [T1]–[T3] захищаються (замінюються на тимчасові токени, після humanize — відновлюються).  
     - Використовуються `humanizeSettings` (model, style, mode); виклик зовнішнього API (sectionHumanize).  
     - Після humanize знову clean по тексту. Результат зберігається в `articleStructure.blocks`, в відповідь додається прапорець `humanizedOnWrite`.

   - **Фінальний HTML і текст**  
     - З блоків генерується HTML, збирається fullArticleText.  
     - Відповідь: topicTitle, titleTag, metaDescription, fullArticleText, articleBodyHtml, humanizedOnWrite.

---

## 4. На якому етапі додаються SEO-ключі

- **Джерело ключів**  
  - **Topic Discovery**: з топиків — `primaryKeyword` по кожному топику → в UI збирається `keywordList = selectedTopicsData.map(t => t.primaryKeyword).filter(Boolean)` і передається в API.  
  - **Direct Article**: у запиті передається `keywordList` (або з exact keywords, або `[directArticleTopic]`) і опційно `exactKeywordList`.

- **Де використовуються**  
  - На етапі **побудови промпту** в API: для кожного топика формується `keywordList` (з body або з `topic.primaryKeyword`) і передається в `buildArticlePrompt` / `buildDirectArticlePrompt`.  
  - У промпті список підставляється в плейсхолдер `[[KEYWORD_LIST]]` (значення: `params.keywordList.join(", ")`) у білдерах `buildArticlePrompt` / `buildDirectArticlePrompt`. Якщо в шаблоні промпту немає тексту з `[[KEYWORD_LIST]]`, заміна нічого не змінює в тексті, але `keywordList` у параметрах є.  
  - Точна інструкція для моделі (наприклад, "включити в title/meta або в текст") задається в тексті шаблону в `lib/articlePrompt.ts` (SEO requirements: "includes the main keyword" для title tag тощо).  
  - У Direct-режимі **exact keywords** додаються окремим блоком інструкцій (EXACT_KEYWORDS_SECTION) — вони мають бути в тексті дослівно.

Підсумок: SEO-ключі додаються **до генерації** — на етапі формування промпту (підстановка `[[KEYWORD_LIST]]` і, для Direct, блоку exact keywords). Після генерації окремого кроку "додавання ключів" немає.

---

## 5. Коли вмикається Human Mode / humanizer

- **Human Mode (writingMode === "human")**  
  - Обирається в UI (наприклад, перемикач SEO / Human).  
  - У промпті підставляється `[[WRITING_MODE]]` = "human" → модель пише в editorial/founder стилі (менш шаблонна структура).  
  - Одночасно **humanize при генерації завжди вмикається**: в API `effectiveHumanizeOnWrite = true` при `writingMode === "human"`, незалежно від тоглу "Humanize on write".

- **Humanize on write (без Human Mode)**  
  - Якщо режим "seo", але в UI увімкнено "Humanize on write", тоді `humanizeOnWrite: true` і `effectiveHumanizeOnWrite === true`.  
  - Humanizer запускається після отримання JSON від OpenAI: проход по блокам, виклик AI Humanize API для відповідних фрагментів, захист плейсхолдерів, підстановка назад.

- **Direct Article**  
  - Humanize доступний **тільки через Human Mode** (немає окремого тоглу "Humanize on write" для Direct); тобто humanizer працює тоді, коли обрано Human Mode.

Підсумок:  
- **Human Mode** = стиль промпту "human" + **завжди** humanize після генерації.  
- **Humanize on write** = окремий тогл тільки в Topic Discovery; вмикає той самий пост-обробник humanize після отримання статті з OpenAI.

---

## 6. Коротка схема по етапах

```
UI (Topic Discovery)
  → збір trust sources (Tavily /api/find-links по кожному топику)
  → POST /api/articles (brief, selectedTopics, keywordList з primaryKeyword, trustSourcesList, writingMode, humanizeOnWrite, humanizeSettings)

UI (Direct Article)
  → trust sources (Tavily один раз)
  → POST /api/articles (один топик без shortAngle/…, keywordList, exactKeywordList, trustSourcesList, writingMode, humanizeOnWrite тільки з Human Mode)

API /api/articles (на кожен топик):
  1. Визначити isDirectMode
  2. Класифікація/фільтр trust sources
  3. Побудувати промпт (buildArticlePrompt або buildDirectArticlePrompt)
     → тут підставляються SEO-ключі [[KEYWORD_LIST]] і, для Direct, exact keywords
     → підставляється [[WRITING_MODE]] (seo | human)
  4. OpenAI chat completions (один виклик)
  5. Парсинг JSON → структура блоків
  6. cleanText по блоках
  7. Якщо effectiveHumanizeOnWrite — humanize блоків (AI Humanize API), захист [A1]/[T1–T3]
  8. Збір HTML і fullArticleText → відповідь
```

Файли для деталей:  
- `app/page.tsx` — збір даних, виклики find-links і /api/articles, keywordList/exactKeywordList, writingMode, humanizeOnWrite.  
- `app/api/articles/route.ts` — режим, trust sources, побудова промпту, OpenAI, humanize.  
- `lib/articlePrompt.ts` — шаблони промптів, підстановка KEYWORD_LIST, WRITING_MODE, EXACT_KEYWORDS_SECTION.
