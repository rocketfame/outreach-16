export type ContentIntegrityIssue = {
  blockIndex: number;
  code: "missing_terminal_punctuation" | "dangling_colon" | "unbalanced_quotes" | "invalid_sentence_start";
  message: string;
};

function decodeHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/** Conservative final guard: reject obvious fragments; never repair facts silently. */
export function findContentIntegrityIssues(html: string): ContentIntegrityIssue[] {
  const blocks: Array<{ tag: string; text: string; end: number }> = [];
  const blockPattern = /<(p|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(html)) !== null) {
    const text = decodeHtmlText(match[2]);
    if (text) blocks.push({ tag: match[1].toLowerCase(), text, end: blockPattern.lastIndex });
  }

  const issues: ContentIntegrityIssue[] = [];
  blocks.forEach((block, blockIndex) => {
    const text = block.text;
    const nextBlockExists = /<(?:p|ul|ol|table|blockquote|h[2-6])\b/i.test(html.slice(block.end));

    if (text.endsWith(":") && !nextBlockExists) {
      issues.push({
        blockIndex,
        code: "dangling_colon",
        message: `Paragraph ${blockIndex + 1} ends with a colon but has no continuation block.`,
      });
    } else if (!/[.!?…:]["'»”’\])}]*$/u.test(text)) {
      issues.push({
        blockIndex,
        code: "missing_terminal_punctuation",
        message: `Paragraph ${blockIndex + 1} ends without terminal punctuation.`,
      });
    }

    const straightQuotes = countMatches(text, /"/g);
    const leftCurly = countMatches(text, /“/g);
    const rightCurly = countMatches(text, /”/g);
    const leftGuillemets = countMatches(text, /«/g);
    const rightGuillemets = countMatches(text, /»/g);
    if (straightQuotes % 2 !== 0 || leftCurly !== rightCurly || leftGuillemets !== rightGuillemets) {
      issues.push({
        blockIndex,
        code: "unbalanced_quotes",
        message: `Paragraph ${blockIndex + 1} contains unbalanced quotation marks.`,
      });
    }

    const starts = [text.match(/^["'«“(\[]*([\p{L}\p{N}])/u)?.[1]];
    // Require a 4+ letter word before the boundary so common abbreviations
    // (e.g., U.S., etc., "ad es.") do not become false truncation signals.
    for (const sentence of text.matchAll(/[\p{L}]{4,}[.!?]["'»”’\])}]*\s+["'«“(\[]*([\p{L}\p{N}])/gu)) {
      starts.push(sentence[1]);
    }
    if (starts.some((char) => !!char && (/^\p{Ll}$/u.test(char) || /^\p{N}$/u.test(char)))) {
      issues.push({
        blockIndex,
        code: "invalid_sentence_start",
        message: `Paragraph ${blockIndex + 1} contains a sentence that starts with a lowercase letter or bare digit.`,
      });
    }
  });

  return issues;
}

/** Keep an API-supplied brand name byte-for-byte in visible text nodes. */
export function restoreBrandToken(html: string, brand: string): string {
  const exact = brand.trim();
  if (!exact) return html;
  const segments = exact.match(/[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|\d+/g) ?? [exact];
  const escapedExact = exact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const spacedPattern = segments.length > 1
    ? new RegExp(segments.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "gi")
    : null;

  return html.split(/(<[^>]+>)/g).map((part) => {
    if (part.startsWith("<")) return part;
    let repaired = part.replace(new RegExp(escapedExact, "gi"), exact);
    if (spacedPattern) repaired = repaired.replace(spacedPattern, exact);
    return repaired;
  }).join("");
}

const ITALIAN_APOSTROPHE_FORMS = /\b(?:e|piu|perche|puo|gia|probabilita)'(?=\s|[.,;:!?<]|$)/giu;

export function findLanguageOrthographyIssue(html: string, language: string): string | null {
  if (language.trim().toLowerCase() !== "italian") return null;
  const text = decodeHtmlText(html);
  return ITALIAN_APOSTROPHE_FORMS.test(text)
    ? "Italian text uses apostrophe substitutions instead of required diacritics."
    : null;
}
