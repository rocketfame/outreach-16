// lib/sectionHumanize.ts
// Section-level humanization using Undetectable.AI Humanization API v2

import { getHumanizerService } from "@/lib/humanizerClient";

/**
 * Chunks text for humanization if it exceeds 10000 characters
 * Splits by paragraphs (double newlines) to preserve structure
 */
export function chunkTextForHumanization(text: string): string[] {
  if (text.length <= 10000) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk && (currentChunk.length + trimmed.length + 2) > 10000) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Protect [A1], [T1]-[T8] placeholders before humanization.
 * Humanizer may modify these; we replace with stable tokens and restore after.
 */
function createPlaceholderProtection() {
  const placeholderMap: Record<string, string> = {};
  let placeholderIndex = 0;

  const protectPlaceholders = (text: string): string => {
    return text.replace(/\[(A1|T[1-8])\]/g, (match) => {
      const token = `LINKREF${String(placeholderIndex++).padStart(3, "0")}`;
      placeholderMap[token] = match;
      return token;
    });
  };

  const restorePlaceholders = (text: string): string => {
    return Object.entries(placeholderMap).reduce(
      (t, [token, original]) =>
        t.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), original),
      text
    );
  };

  return { protectPlaceholders, restorePlaceholders };
}

const cleanHumanizedText = (text: string): string => {
  // Remove spaced-letter artifacts like "I T H O U G H Y O U K N E W"
  let result = text.replace(/\b([A-Z] ){4,}[A-Z]\b/g, "");

  // Replace forbidden AI-tone words reintroduced by the humanizer
  result = result
    .replace(/\bUltimately,?\s*/gi, "")
    .replace(/\bMoreover,?\s*/gi, "Also, ")
    .replace(/\bFurthermore,?\s*/gi, "Also, ")
    .replace(/\bIn conclusion,?\s*/gi, "")
    .replace(/\bIt'?s worth noting that\s*/gi, "")
    .replace(/\bNotably,?\s*/gi, "");

  const metaPatterns = [
    /please note that this was written by[^.]*\./gi,
    /this (text|content|paragraph|sentence) (has been|was) (rewritten|humanized|paraphrased)[^.]*\./gi,
    /the (following|above) (text|content) (has been|was)[^.]*\./gi,
    /note[:]\s*[^.]*rewritten[^.]*\./gi,
    /\(note:[^)]*\)/gi,
    /\[note:[^\]]*\]/gi,
  ];

  // CRITICAL: Strip humanizer instructions that leaked from our XML prompt
  // Undetectable sometimes echoes the full prompt back; remove all instruction text
  const humanizerInstructionPatterns = [
    /<task>[\s\S]*?<\/task>/gi,
    /<context>[\s\S]*?<\/context>/gi,
    /Rewrite the text inside\s*(<rewrite>)?\s*tags\.?\s*Use\s*(<context>)?\s*only as stylistic reference[^.\n]*/gi,
    /do not rewrite it,?\s*do not include it in your response\.?/gi,
    /Respond with only the rewritten text\.?\s*No explanations\.?\s*No tags\.?\s*No preamble\.?/gi,
    /Never include XML tags,?\s*instructions,?\s*or meta-commentary in your response\.?/gi,
    /Output only the rewritten paragraph text\.?/gi,
    /Use\s+<context>\s+only as stylistic reference[^.\n]*/gi,
    /Respond with only the rewritten text[^.\n]*/gi,
    /No explanations\.?\s*No tags\.?\s*No preamble\.?/gi,
    /Never include XML tags[^.\n]*/gi,
  ];

  let cleaned = result;
  for (const pattern of humanizerInstructionPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove lines that are purely instruction-like (catch variations)
  cleaned = cleaned
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(Rewrite the text|Use\s+<context>|do not rewrite|do not include|Respond with only|No explanations|No tags|No preamble|Never include XML|Output only the rewritten)\s/i.test(
          line.trim()
        )
    )
    .join("\n");

  for (const pattern of metaPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  const brandNormalizations: [RegExp, string][] = [
    [/\bTik\s*Tok\b/gi, "TikTok"],
    [/\bInsta\s*gram\b/gi, "Instagram"],
    [/\bYou\s*Tube\b/gi, "YouTube"],
    [/\byoutube\b/g, "YouTube"],
    [/\bFace\s*book\b/gi, "Facebook"],
    [/\bLinked\s*In\b/gi, "LinkedIn"],
    [/\blinkedin\b/g, "LinkedIn"],
    [/\bPinter\s*est\b/gi, "Pinterest"],
    [/\bSnap\s*chat\b/gi, "Snapchat"],
    [/\bWhat\s*s\s*App\b/gi, "WhatsApp"],
    [/\bwhatsapp\b/g, "WhatsApp"],
    [/\bspotify\b/g, "Spotify"],
    [/\bSound\s*Cloud\b/gi, "SoundCloud"],
    [/\bsoundcloud\b/g, "SoundCloud"],
    [/\bApple\s*music\b/gi, "Apple Music"],
    [/\bpatreon\b/g, "Patreon"],
    [/\bsubstack\b/g, "Substack"],
    [/\btwitch\b/g, "Twitch"],
    [/\bdiscord\b/g, "Discord"],
    [/\breddit\b/g, "Reddit"],
    [/\btwitter\b/g, "Twitter"],
    [/\bgoogle\b/g, "Google"],
    [/\bWord\s*Press\b/gi, "WordPress"],
    [/\bwordpress\b/g, "WordPress"],
    [/\bshopify\b/g, "Shopify"],
    [/\bPay\s*Pal\b/gi, "PayPal"],
    [/\bpaypal\b/g, "PayPal"],
    [/\bChat\s*GPT\b/gi, "ChatGPT"],
    [/\bchatgpt\b/g, "ChatGPT"],
  ];

  for (const [pattern, replacement] of brandNormalizations) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
};

/**
 * Humanizes a single section of plain text using Undetectable.AI Humanization API v2.
 * On failure: returns original text and logs error (no flow crash).
 * Placeholders [A1], [T1]-[T8] are protected before sending and restored after.
 *
 * @param text Plain text section to humanize
 * @param model Legacy model: 0=Quality, 1=Balanced, 2=More Human
 * @param _registeredEmail Deprecated (Undetectable does not use email); kept for API compatibility
 * @param frozenPhrases Not used by Undetectable; kept for API compatibility
 * @param style Optional style hint (for logging)
 * @param mode Optional mode (for logging)
 * @param _previousBlockText Deprecated — context sending removed (doubled credit cost with Undetectable)
 */
export async function humanizeSectionText(
  text: string,
  model: number,
  _registeredEmail: string,
  frozenPhrases: string[] = [],
  style?: string,
  mode?: "Basic" | "Autopilot",
  _previousBlockText?: string
): Promise<{ humanizedText: string; wordsUsed: number }> {
  if (!text || text.trim().length === 0) {
    return { humanizedText: text, wordsUsed: 0 };
  }

  if (text.length < 100) {
    return { humanizedText: text, wordsUsed: 0 };
  }

  const apiKey = process.env.UNDETECTABLE_HUMANIZER_API_KEY;
  if (!apiKey) {
    console.error("[humanizeSectionText] UNDETECTABLE_HUMANIZER_API_KEY not configured");
    return { humanizedText: text, wordsUsed: 0 };
  }

  // Undetectable is a text rewriter, NOT a contextual AI.
  // Sending previousBlockText as context doubles credit usage (every block is paid for twice)
  // and causes duplication bugs when the delimiter is lost. Each block is humanized independently.

  try {
    const { protectPlaceholders, restorePlaceholders } = createPlaceholderProtection();
    const humanizer = getHumanizerService();

    if (text.length > 10000) {
      const chunks = chunkTextForHumanization(text);
      let totalWordsUsed = 0;
      const humanizedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const protectedData = protectPlaceholders(chunks[i]);
        const result = await humanizer.humanize(protectedData, { model, style, mode });
        let rewrittenPart = restorePlaceholders(result.text);
        rewrittenPart = cleanHumanizedText(rewrittenPart);
        humanizedChunks.push(rewrittenPart);
        totalWordsUsed += result.wordsUsed;
      }

      return {
        humanizedText: humanizedChunks.join("\n\n"),
        wordsUsed: totalWordsUsed,
      };
    }

    const protectedData = protectPlaceholders(text);
    const result = await humanizer.humanize(protectedData, { model, style, mode });
    let humanizedText = restorePlaceholders(result.text);
    humanizedText = cleanHumanizedText(humanizedText);

    return {
      humanizedText,
      wordsUsed: result.wordsUsed,
    };
  } catch (error) {
    console.error(
      "[humanizeSectionText] Humanization failed, falling back to original text:",
      error
    );
    return { humanizedText: text, wordsUsed: 0 };
  }
}
