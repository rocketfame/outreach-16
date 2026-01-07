// lib/humanizeFormatter.ts
// Post-humanization HTML formatter using OpenAI
// This is a "dumb formatter" that rebuilds HTML structure from humanized text

import { getOpenAIClient } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

const SYSTEM_PROMPT = `Role: You are a post-processor for articles. You receive:
	•	originalHtml – HTML before humanization;
	•	humanizedText – plain-text result from AIHumanize with service markers.

Your task: Build clean, readable HTML, preserving ALL structure, all links and anchors.

⸻

1. Iron rules
	1.	The quantity and order of structural blocks must remain the same as in originalHtml:
	•	the same h1…h4, p, ul/ol + li, quotes, etc.;
	•	do not add new sections, do not remove existing ones, do not merge multiple blocks into one.
	2.	Links and anchors:
	•	do not change any href;
	•	do not replace anchor text that was in <a> in originalHtml (only light grammatical fixes around are allowed, but not inside the tag);
	•	do not add new external links and do not replace existing ones with our service links;
	•	if an anchor token disappeared in humanizedText – restore it from originalHtml in the same place in the paragraph.
	3.	No "monster-headings":
	•	no <h1–h3> should contain a long paragraph with multiple sentences;
	•	if a heading has more than 120 characters or more than one period – split it:
	•	keep only the short heading in <hX>;
	•	move the rest into one or more <p> under this heading.
	4.	No excessive bold text:
	•	do not wrap entire paragraphs in <b>/<strong>;
	•	keep <strong> only where they were in originalHtml.
	5.	No duplicate sections:
	•	if a block with the same heading and very similar text appears twice (for example, "The 7-14 day signal audit…") – keep one version, delete the second;
	•	use originalHtml structure as the reference.

⸻

2. How to work with markers
In humanizedText we add service block markers:
	•	[[BLOCK:h1]], [[BLOCK:h2]], [[BLOCK:h3]], [[BLOCK:p]], [[BLOCK:ul]], [[BLOCK:li]], etc.;
	•	for anchors and fixed phrases – tokens like [[ANCHOR_1]], [[ANCHOR_2]], [[PHRASE_1]].

Your sequence of actions:
	1.	Restore protected chunks:
	•	replace all [[ANCHOR_X]] and [[PHRASE_X]] with their original HTML/text from originalHtml one by one;
	•	ensure token order is preserved; start replacement from the highest indices (to avoid collisions).
	2.	Split humanizedText into blocks by [[BLOCK:...]]:
Get an array of objects:

{ tag: 'h2', text: 'Stage 2: Micro-audience expansion …' }
{ tag: 'p',  text: 'If the early group behaves well …' }
{ tag: 'li', text: 'Hook test: …' }

Discard empty blocks and service noise.

	3.	Align blocks with originalHtml:
	•	parse originalHtml into a sequence of blocks of the same format (tag + innerHTML, including attributes);
	•	go through the original array from left to right;
	•	for each block:
	•	if the type matches (same tag) – take humanized text and insert into innerHTML, preserving original tag attributes;
	•	if humanized blocks are missing or misaligned – use original text as fallback, do not leave "holes".
	4.	Lists:
	•	for <ul>/<ol> preserve the tag itself and its attributes;
	•	for each <li> from originalHtml find the next block tag: 'li' from the humanized array;
	•	if there is none – use the original text of this li.

⸻

3. Quality control before final HTML
Before returning the result:
	1.	Make sure that:
	•	the number of headings h2, h3, lists and list items is not less than in originalHtml;
	•	there is no <h1–h3> that contains obvious day markers ("Days 1-3", "Days 4-7", "Days 8-14") or multiple paragraphs of text – such chunks need to be split into heading + <p>.
	2.	Check links:
	•	all hrefs from originalHtml are present;
	•	there are no new hrefs that were not in the original.
	3.	When detecting a conflict, always prefer the original structure:
	•	better to leave a chunk of text less "humanized" than to break HTML, links or duplicate sections.

The answer must be only valid HTML code without explanations, Markdown or comments.`;

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

