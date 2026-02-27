# Direct Article Creation Mode — Flow, Humanization, Prompts

Документ для передачі агенту: повний опис флоу Direct Article Creation, х'юманізації та промптів.

---

## 1. Флоу Direct Article Creation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ UI (page.tsx)                                                                │
│ • Користувач вводить: Article Topic, опційно Brief, опційно Exact Keywords  │
│ • Project Basics: niche, platform, contentPurpose, clientSite, wordCount    │
│ • Writing Mode: SEO або Human (тільки Human дає humanize)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Крок 1: Tavily — пошук trust sources                                        │
│ • POST /api/find-links                                                       │
│ • Query: directArticleTopic + niche + platform + "2024 2025"                  │
│ • Результат: trustSourcesList (Name|URL)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Крок 2: POST /api/articles                                                   │
│ • selectedTopics: [{ title: articleId, brief, primaryKeyword }]            │
│   БЕЗ shortAngle, whyNonGeneric, howAnchorFits → API визначає Direct Mode    │
│ • keywordList: exactKeywordList або [directArticleTopic]                     │
│ • exactKeywordList: якщо є — фрази дослівно в текст                          │
│ • trustSourcesList, writingMode, humanizeOnWrite, humanizeSettings          │
│ • humanizeOnWrite: тільки true для Human Mode (Direct не має тоглу)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API (articles/route.ts)                                                      │
│ 1. isDirectMode = true (немає shortAngle/whyNonGeneric/howAnchorFits)        │
│ 2. Класифікація trust sources (LLM або filterAndSelectTrustSources)          │
│ 3. buildDirectArticlePrompt() → user prompt                                   │
│ 4. OpenAI chat.completions.create (system + user, gpt-5.2, json_object)     │
│ 5. Парсинг JSON → articleBlocks → modelBlocksToArticleStructure()            │
│ 6. cleanText() по блоках                                                      │
│ 7. Якщо effectiveHumanizeOnWrite → humanize блоків (AIHumanize API)         │
│ 8. blocksToHtml() → інжекція [A1], [T1]–[T3] → фінальний HTML                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Флоу х'юманізації

```
effectiveHumanizeOnWrite = (writingMode === "human") ? true : (body.humanizeOnWrite || false)
```

У Direct Mode humanize увімкнено **тільки** при Human Mode (немає тоглу "Humanize on write").

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Якщо effectiveHumanizeOnWrite === true                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Для кожного блоку articleStructure.blocks:                                   │
│                                                                              │
│ • ul/ol: для кожного item.text (якщо ≥100 символів):                         │
│   - Замінити [A1],[T1],[T2],[T3] на LINKREF000, LINKREF001...                │
│   - humanizeSectionText(protectedText) → AIHumanize API                     │
│   - Відновити плейсхолдери з токенів                                         │
│                                                                              │
│ • table: для caption, headers, rows — аналогічно                             │
│                                                                              │
│ • p, h1–h4: якщо text ≥100 символів — humanizeSectionText()                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ AIHumanize API (lib/sectionHumanize.ts)                                      │
│ • POST https://aihumanize.io/api/v1/rewrite                                  │
│ • Body: { model: "0"|"1"|"2", mail: email, data: text }                     │
│ • model: 0=Quality, 1=Balance, 2=Enhanced                                   │
│ • Обмеження: 100–10000 символів на запит                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. System Prompt

```
You are an expert SEO Content Strategist and outreach content writer, native English speaker (US), with deep experience in social media, music marketing and creator economy. You write SEO-optimized, human-sounding articles that feel like an experienced practitioner, not AI, wrote them.

Target audience: B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms.
${brandNameForSystem ? `Brand to feature: ${brandNameForSystem}` : "No specific brand to feature."}
Goal: Create a useful, non-pushy outreach article that educates, builds trust and naturally promotes the provided link via a contextual anchor.
Language: US English.

CRITICAL — Word count: Your article MUST be between ${wordCountMinSys} and ${wordCountMaxSys} words. Do NOT exceed ${wordCountMaxSys} words. If your draft is longer, shorten it before outputting. This is mandatory.
```

---

## 4. User Prompt — Placeholders

| Placeholder | Джерело |
|-------------|---------|
| `[[TOPIC_TITLE]]` | topic.title (directArticleTopic) |
| `[[TOPIC_BRIEF]]` | directArticleBrief або directArticleTopic |
| `[[WRITING_MODE]]` | "seo" або "human" |
| `[[WORD_COUNT]]`, `[[WORD_COUNT_MIN]]`, `[[WORD_COUNT_MAX]]` | brief.wordCount (80%–120%) |
| `[[NICHE]]` | brief.niche |
| `[[MAIN_PLATFORM]]` | brief.platform |
| `[[CONTENT_PURPOSE]]` | brief.contentPurpose |
| `[[BRAND_NAME]]` | домен з clientSite або "NONE" |
| `[[ANCHOR_TEXT]]`, `[[ANCHOR_URL]]` | brief.anchorText, brief.anchorUrl |
| `[[TRUST_SOURCES_LIST]]` | trust sources (JSON або Name|URL) |
| `[[EXACT_KEYWORDS_SECTION]]` | блок exact keywords (якщо є) |
| `[[LANGUAGE]]` | brief.language |
| `[[TARGET_AUDIENCE]]` | фіксований текст |

---

## 5. User Prompt — Direct Article Template (початок)

Шаблон: `DIRECT_ARTICLE_PROMPT_TEMPLATE` в `lib/articlePrompt.ts` (рядки 1159–1868).

Якщо `contentPurpose === "Blog"` — використовується `BLOG_ARTICLE_PROMPT_TEMPLATE`.

```
You are an experienced SEO and editorial writer with 10+ years of practice across different industries.
Your job in Direct Article Creation is simple:
take a prepared topic brief and generate a clean, human article that:
	1.	strictly matches the topic [[TOPIC_TITLE]] and description [[TOPIC_BRIEF]],
	2.	respects the project context,
	3.	follows the chosen content purpose [[CONTENT_PURPOSE]],
	4.	always chooses the correct structural format (list or guide) according to the rules below.

WRITING MODE LOGIC

WritingMode can be:
- "seo" → use the existing strict SEO article behavior (headings, subheadings, lists, strong structure).
- "human" → write in Human Mode (editorial / founder-style) as described below.

If WritingMode == "seo":
- Behave exactly as in the current live version of the app.
- Do NOT change tone, structure rules, or article templates.

If WritingMode == "human":
You are writing like a real human editor, strategist, or founder, not like an SEO template.

Core principles:
- Content must stay accurate, useful, and on-topic.
- SEO is allowed but secondary: focus on voice and flow first, structure second.

STRUCTURE (HUMAN MODE)
- Use one H1 for the title.
- Use a small number of H2s (2–5), only when they genuinely help the flow.
- Avoid rigid patterns where every H2 has the same internal layout.
- Paragraph length should vary: some 1–2 sentence paragraphs, some longer.
- Lists are allowed, but use them rarely and irregularly. Prefer narrative text over big bullet checklists.
- Do NOT force a classic 'Intro → 3 sections → Conclusion' skeleton. Let the article breathe.

STYLE & VOICE (HUMAN MODE)
- Mix long, flowing sentences with very short ones.
- Allow light subjectivity and opinions (e.g. 'I keep seeing…', 'Honestly…', 'What usually happens is…').
- It's okay to leave some thoughts slightly open-ended instead of explaining everything step by step.
- Avoid ultra-formal, neutral tone. Sound like a smart peer explaining their view, not a tutorial.

Current WritingMode: [[WRITING_MODE]]

CRITICAL REQUIREMENTS - READ CAREFULLY:
	1.	WORD COUNT REQUIREMENT (MANDATORY – MAX 20% ERROR):
• Target length: [[WORD_COUNT]] words. Accepted range: [[WORD_COUNT_MIN]]–[[WORD_COUNT_MAX]] words (80%–120% of target). You MUST stay within this range.
• HARD MAX: Do NOT exceed [[WORD_COUNT_MAX]] words. If your draft is longer, you MUST shorten it (trim paragraphs or lists) before outputting.
	2.	TOPIC BRIEF REQUIREMENT (MANDATORY):
• You MUST follow the article brief ([[TOPIC_BRIEF]]) EXACTLY as provided.
• The brief contains specific requirements, structure, angles, and key points that MUST be addressed.
• Do NOT ignore or deviate from the brief - it is the foundation of the article.
• All major points mentioned in the brief MUST be present in the text.

[[EXACT_KEYWORDS_SECTION]]

================================
PROJECT CONTEXT

• Niche / theme: [[NICHE]]
• Main platform / service focus: [[MAIN_PLATFORM]]
• Content purpose (tone / POV): [[CONTENT_PURPOSE]]
• Client / brand name (may be empty): [[BRAND_NAME]]
• Topic title: [[TOPIC_TITLE]]
• Topic description / detailed brief: [[TOPIC_BRIEF]]
• Language: [[LANGUAGE]]
• Target word count: [[WORD_COUNT]] words. Accepted range: [[WORD_COUNT_MIN]]–[[WORD_COUNT_MAX]] words.
• Anchor text: [[ANCHOR_TEXT]]
• URL: [[ANCHOR_URL]]
• Trusted external sources: [[TRUST_SOURCES_LIST]]
```

---

## 6. User Prompt — Основні секції шаблону

- **0. BRAND PRESENCE LOGIC** — як обробляти порожній/валідний BRAND_NAME
- **1. CONTENT PURPOSE & BRAND VOICE** — Blog, Guest post, Educational guide, Partner blog, News Hook, Other
- **2. CHOOSING FORMAT: LIST OR GUIDE** — правила вибору формату
- **3. STRUCTURE FOR LIST / DIRECTORY TOPICS** — intro, main list, external sources, brand, conclusion
- **4. STRUCTURE FOR ADVICE / GUIDE TOPICS** — intro, main body, brand integration, conclusion
- **5. COMMERCIAL BRANDED LINK LOGIC** — [A1], коли використовувати, формат
- **6. EXTERNAL SOURCES & REFERENCES** — [T1], [T2], [T3], anchor rules
- **6.5. OUTREACH-SPECIFIC REQUIREMENTS** — для Guest post / outreach
- **7. HUMAN-WRITTEN STYLE AND ANTI-AI-SIGNATURE RULES** — perplexity, burstiness, pattern breaking
- **8. SEO META AND OUTPUT FORMAT** — JSON з titleTag, metaDescription, articleBlocks

**Output format:**
```json
{
  "titleTag": "…",
  "metaDescription": "…",
  "articleBlocks": [
    { "type": "h1", "text": "..." },
    { "type": "p", "text": "..." },
    { "type": "h2", "text": "..." }
  ]
}
```

MANDATORY: Total word count of all text in articleBlocks MUST be ≤ [[WORD_COUNT_MAX]].

---

## 7. Файли в проєкті

| Файл | Призначення |
|------|-------------|
| `app/page.tsx` | UI, generateDirectArticle(), виклики find-links і /api/articles |
| `app/api/articles/route.ts` | Визначення Direct Mode, humanize, виклик OpenAI |
| `lib/articlePrompt.ts` | DIRECT_ARTICLE_PROMPT_TEMPLATE, buildDirectArticlePrompt() |
| `lib/sectionHumanize.ts` | humanizeSectionText(), виклик AIHumanize API |

---

## 8. Визначення режиму в API

```javascript
const hasHowAnchorFits = topic.howAnchorFits && 
  topic.howAnchorFits.trim() && 
  !topic.howAnchorFits.includes("N/A");
const isDirectMode = !topic.shortAngle && 
  !topic.whyNonGeneric && 
  !hasHowAnchorFits;
```

Якщо `isDirectMode === true` → використовується `buildDirectArticlePrompt()`.
