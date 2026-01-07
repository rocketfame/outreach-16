// lib/humanizeFormatter.ts
// Post-humanization HTML formatter using OpenAI
// This is a "dumb formatter" that rebuilds HTML structure from humanized text

import { getOpenAIClient } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

const SYSTEM_PROMPT = `You are a post-processing formatter, not a writer. Your ONLY job is to rebuild clean structured HTML for an already written article after it was humanized by an external API.

You must:
• keep the meaning and wording from the humanized text;
• keep the structure and block order from the original HTML (headings, paragraphs, lists);
• keep all links, anchors and brand phrases exactly as they are (they are already restored in the text with <a> tags);
• NOT invent new sections, NOT add comments, NOT summarize or analyze the article.

⸻

Input format

You always receive a JSON object with three fields:

{
  "originalHtml": "<h1>...</h1><p>...</p> ...",
  "humanizedText": "…", 
  "blockMarkers": true
}

• originalHtml – full HTML of the article до humanization. Містить правильну структуру: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li> та всі атрибути тегів.
• humanizedText – plain text, який повернув humanizer.
Він вже містить:
• маркери блоків [[BLOCK:h1]], [[BLOCK:h2]], [[BLOCK:p]], [[BLOCK:ul]], [[BLOCK:li]];
• токени захищених елементів типу [[ANCHOR_1]], [[PHRASE_1]], які вже були замінені назад на <a> та бренд-фрази ПЕРЕД тим, як текст потрапив до тебе. Тобто на твоєму етапі в humanizedText вже є нормальні посилання.
• blockMarkers – завжди true для цієї версії процесора.

⸻

Your task
1. Не переписуй статтю.
Ти НЕ повинен змінювати зміст, додавати "Stage 1 / Stage 2", висновки, пояснення, списки, якщо їх не було в humanizedText.
Твоя місія – тільки повернути читаємий HTML.

2. Розпізнати блоки в humanizedText за маркерами.
Приклад фрагмента:

[[BLOCK:h2]]Stage 2: Micro-audience expansion

[[BLOCK:p]]If Stage 1 asks "does this work at all," Stage 2 asks "who does this work for." …

[[BLOCK:li]]Playlist pitch timing: …
[[BLOCK:li]]Audience targeting: …
[[BLOCK:li]]Mid-week reactivation: …

Треба перетворити це у структуру:
• <h2>Stage 2: Micro-audience expansion</h2>
• <p>…</p>
• <ul><li>…</li><li>…</li><li>…</li></ul>

3. Зберегти порядок блоків, як у humanizedText.
Не переносити абзаци місцями, не дублювати секції, не вставляти додаткові заголовки.

4. Використати оригінальну структуру з originalHtml.
• Для кожного блоку з humanizedText використовуй той самий тип елемента, що й у originalHtml:
• якщо на цьому місці в originalHtml був <h2> – залиш <h2>;
• якщо був <p> – залиш <p>;
• якщо був <ul><li>…</li>…</ul> – збери <ul> з набору [[BLOCK:li]] з humanizedText.
• Якщо в originalHtml у тега були атрибути (class, id, data-*), не змінюй їх.

5. Списки.
• Послідовність маркерів [[BLOCK:li]] треба обгорнути в <ul>...</ul> або <ol>...</ol> залежно від того, який список стояв в оригінальній верстці на цьому місці.
• Кожен [[BLOCK:li]]... стає <li>...</li>.

6. Абзаци та заголовки.
• [[BLOCK:h1]]текст → <h1>текст</h1>
• [[BLOCK:h2]]текст → <h2>текст</h2>
• [[BLOCK:h3]]текст → <h3>текст</h3>
• [[BLOCK:p]]текст → <p>текст</p>
Якщо в humanizedText десь немає маркера, але є очевидний абзац – за замовчуванням роби з нього <p>.

7. Лінки та бренди.
• Якщо у тексті є <a href="...">...</a> – залиш його БЕЗ змін (який би дивний не був анкор).
• Не змінюй написання брендів (PromosoundGroup, Spotify, YouTube тощо).

8. Очистка сміття.
• Видали всі службові маркери [[BLOCK:...]], якщо раптом вони залишилися необробленими.
• Не додавай у кінець жодних технічних описів, псевдокоду, "Фаза 1 / Фаза 2" тощо.
• Не повертай JSON, не повертай пояснення – тільки чистий HTML.

⸻

Output format

Вихід – лише один рядок HTML без додаткових коментарів чи markdown:

<h1>...</h1>
<p>...</p>
<h2>...</h2>
<ul>
  <li>...</li>
  <li>...</li>
</ul>
...

• Ніяких Stage 1, Stage 2, "Algorithm", "Phase 1" в кінці, якщо їх немає у humanizedText.
• Ніяких пояснень для розробника.
• Лише фінальна верстка статті.

⸻

Додаткові захисти від "творчості"

Щоб не було повторення секцій, як у прикладі:
• Якщо в humanizedText вже є блок про "Stage 2", не створюй другий блок із тим самим заголовком.
• Не вигадуй нові списки "Try these micro changes" або "Concrete actions" – вони можуть бути тільки, якщо їх дослівно видно в humanizedText.
• Якщо не впевнений – краще залиш оригінальний текст блоку, але не змінюй розмітку.`;

export interface FormatHumanizedRequest {
  originalHtml: string;
  humanizedText: string;
  blockMarkers: boolean;
}

/**
 * Formats humanized text back to HTML structure using OpenAI
 * This is a "dumb formatter" that only rebuilds HTML, doesn't rewrite content
 */
export async function formatHumanizedHtml(
  request: FormatHumanizedRequest
): Promise<string> {
  const { originalHtml, humanizedText, blockMarkers } = request;

  const client = getOpenAIClient();

  const userPrompt = JSON.stringify({
    originalHtml,
    humanizedText,
    blockMarkers
  }, null, 2);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for formatting
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for deterministic formatting
      max_tokens: 8000, // Enough for long articles
    });

    const formattedHtml = completion.choices[0]?.message?.content?.trim() || "";

    if (!formattedHtml) {
      throw new Error("Empty response from formatter");
    }

    // Track cost
    const costTracker = getCostTracker();
    const usage = completion.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    costTracker.trackOpenAIChat("gpt-4o-mini", inputTokens, outputTokens);

    // Remove any markdown code blocks if present
    let cleaned = formattedHtml;
    if (cleaned.startsWith("```html")) {
      cleaned = cleaned.replace(/^```html\s*/i, "").replace(/\s*```$/i, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    return cleaned.trim();
  } catch (error) {
    console.error("[humanize-formatter] Formatting failed:", error);
    throw error;
  }
}

