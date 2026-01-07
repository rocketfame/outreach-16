// lib/humanizeFormatter.ts
// Post-humanization HTML formatter using OpenAI
// This is a "dumb formatter" that rebuilds HTML structure from humanized text

import { getOpenAIClient } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

const SYSTEM_PROMPT = `You are a post-processing engine for humanized SEO articles.

Input:
	•	ORIGINAL_HTML – the original article in valid HTML, with correct structure, headings, lists, anchors and external sources.
	•	HUMANIZED_TEXT – plain text returned from an external humanizer, with the same meaning but without reliable HTML structure.

Your job:
	•	Rebuild a clean HTML article that:
	•	keeps the structure and tags from ORIGINAL_HTML,
	•	uses the sentence wording from HUMANIZED_TEXT where possible,
	•	never loses or changes links, anchors, or external sources.

Hard rules (do not break them):
	1.	Do not invent new content.
	•	No extra stages, no new conclusions, no new bullets, no added examples.
	•	If something is not in ORIGINAL_HTML or HUMANIZED_TEXT, it must not appear in the output.
	2.	Preserve the HTML skeleton from ORIGINAL_HTML.
	•	Keep the same order and count of:
	•	headings <h1>…</h1>, <h2>…</h2>, <h3>…</h3>
	•	paragraphs <p>…</p>
	•	lists <ul> / <ol> / <li>
	•	strong / bold text that already exists.
	•	You MAY split one long paragraph from HUMANIZED_TEXT into several <p> only if ORIGINAL_HTML also had multiple paragraphs in that spot.
	•	Do not create new headings like "Stage 1", "Stage 2" if they were not in ORIGINAL_HTML.
	3.	Anchors and external sources (critical):
	•	Every <a …> tag that exists in ORIGINAL_HTML must appear in the final HTML.
	•	Copy each <a> tag verbatim (same href, same anchor text) from ORIGINAL_HTML into the corresponding place in your rebuilt paragraph.
	•	Do not remove, rename, or re-order external source links (for example links to RouteNote, iMusician, official platform docs, etc.).
	•	If HUMANIZED_TEXT does not contain the anchor words, gently adjust the sentence so that the original anchor phrase can still be inserted without changing meaning.
	4.	Bold and emphasis:
	•	Do not add any new <strong> or <b> tags.
	•	Do not wrap whole paragraphs in <strong>.
	•	Keep only the bold parts that already exist in ORIGINAL_HTML.
	5.	Language and meaning:
	•	Use HUMANIZED_TEXT as the main source of phrasing for each paragraph, but keep the same idea and level of detail as ORIGINAL_HTML.
	•	If HUMANIZED_TEXT is missing a detail that exists in ORIGINAL_HTML and is important for logic (for example a metric list: saves per listener, completion rate, repeat listens, source-of-stream mix), keep that detail from ORIGINAL_HTML.
	•	Never change factual statements about metrics, stages, or examples.
	6.	Technical formatting:
	•	Output must be valid HTML only, no Markdown, no comments, no explanations.
	•	Do not insert strange markers like "Stage-1>>", "Step_2:", "====".
	•	Use only standard HTML tags already present in ORIGINAL_HTML.

Work step by step (internally):
	1.	Parse ORIGINAL_HTML and note the sequence of blocks:
[block_1, block_2, ..., block_n] where each block is a heading, paragraph or list.
	2.	For each textual block, find the corresponding part in HUMANIZED_TEXT with the same meaning and reuse that wording.
	3.	Re-insert all <a> tags from ORIGINAL_HTML inside the rebuilt sentences, in positions that keep the sentence natural.
	4.	Preserve all headings, lists, and original bold fragments.
	5.	Return one final HTML string with the full article.

Final instruction:
	•	Answer with only the final rebuilt HTML article. No prefaces, no comments, no explanations.`;

export interface FormatHumanizedRequest {
  originalHtml: string;
  humanizedText: string;
}

/**
 * Formats humanized text back to HTML structure using OpenAI
 * This is a "dumb formatter" that only rebuilds HTML, doesn't rewrite content
 */
export async function formatHumanizedHtml(
  request: FormatHumanizedRequest
): Promise<string> {
  const { originalHtml, humanizedText } = request;

  const client = getOpenAIClient();

  const userPrompt = JSON.stringify({
    ORIGINAL_HTML: originalHtml,
    HUMANIZED_TEXT: humanizedText
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

