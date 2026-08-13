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
    // Link text is caller-controlled (money anchors are legitimately
    // lowercase, e.g. "music promotion" opening a sentence), so anchors are
    // case-neutralized for validation and never trigger the start check.
    const text = decodeHtmlText(neutralizeAnchorCase(match[2]));
    if (text) blocks.push({ tag: match[1].toLowerCase(), text, end: blockPattern.lastIndex });
  }

  const issues: ContentIntegrityIssue[] = [];
  blocks.forEach((block, blockIndex) => {
    const text = block.text;
    const nextBlockExists = /<(?:p|ul|ol|table|blockquote|h[2-6])\b/i.test(html.slice(block.end));

    const blockTail = text.slice(-80).trim();
    if (text.endsWith(":") && !nextBlockExists) {
      issues.push({
        blockIndex,
        code: "dangling_colon",
        message: `Paragraph ${blockIndex + 1} ends with a colon but has no continuation block: "…${blockTail}"`,
      });
    } else if (!/[.!?…:]["'»”’\])}]*$/u.test(text)) {
      issues.push({
        blockIndex,
        code: "missing_terminal_punctuation",
        message: `Paragraph ${blockIndex + 1} ends without terminal punctuation: "…${blockTail}"`,
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
        message: `Paragraph ${blockIndex + 1} contains unbalanced quotation marks: "${text.slice(0, 80).trim()}…"`,
      });
    }

    // A paragraph OPENING with a bare digit is a block-boundary truncation
    // signal ("770 caricamenti" left over from "50.770 caricamenti"). A digit
    // starting a sentence MID-paragraph is legitimate prose ("…growth. 2026
    // raised the bar."), so mid-paragraph only lowercase letters count.
    // Lowercase followed by an uppercase letter (iPhone, eBay) is a brand
    // spelling, not truncation.
    const fragmentAround = (index: number): string => {
      const start = Math.max(0, index - 20);
      return text.slice(start, index + 60).trim();
    };
    const blockStart = text.match(/^["'«“(\[]*([\p{L}\p{N}])(.{0,79})/u);
    const badStarts: string[] = [];
    if (blockStart && isInvalidSentenceStartChar(blockStart[1], blockStart[2])) {
      badStarts.push(`${blockStart[1]}${blockStart[2]}`.trim());
    }
    // Require a 4+ letter word before the boundary so common abbreviations
    // (e.g., U.S., etc., "ad es.") do not become false truncation signals.
    for (const sentence of text.matchAll(/[\p{L}]{4,}[.!?]["'»”’\])}]*\s+["'«“(\[]*(\p{Ll})/gu)) {
      const startIndex = sentence.index ?? 0;
      const rest = text.slice(startIndex + sentence[0].length, startIndex + sentence[0].length + 2);
      if (/^\p{Lu}/u.test(rest)) continue; // camelCase brand (iPhone, eBay)
      badStarts.push(fragmentAround(startIndex));
    }
    if (badStarts.length > 0) {
      issues.push({
        blockIndex,
        code: "invalid_sentence_start",
        message: `Paragraph ${blockIndex + 1} contains a sentence that starts with a lowercase letter or bare digit: "…${badStarts[0]}…"`,
      });
    }
  });

  return issues;
}

function isInvalidSentenceStartChar(char: string, following: string): boolean {
  if (/^\p{N}$/u.test(char)) return true;
  if (!/^\p{Ll}$/u.test(char)) return false;
  return !/^\p{Lu}/u.test(following); // iPhone/eBay-style brand spellings pass
}

/** Uppercase the first lowercase letter of each anchor so caller-controlled link text never reads as truncation. */
function neutralizeAnchorCase(blockHtml: string): string {
  return blockHtml.replace(
    /(<a\b[^>]*>[\s"'«“(\[]*)(\p{Ll})/giu,
    (_, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`
  );
}

const SENTENCE_BOUNDARY_LOWERCASE = /([\p{L}]{4,}[.!?]["'»”’\])}]*\s+["'«“(\[]*)(\p{Ll})(?!\p{Lu})/gu;

/**
 * Deterministic orthographic repair for humanizer artifacts: sentences left
 * starting with a lowercase letter after a clear sentence boundary get their
 * first letter uppercased. This is exactly the defect the EN Undetectable/
 * BetterWords path keeps producing; failing the whole paid job over casing
 * (truncated_output on paragraph 16/17) burned ~$0.50 per attempt.
 *
 * Deliberately NOT repaired: anchor/link text (money anchors are exact,
 * lowercase by design), camelCase brand spellings (iPhone, eBay), digits
 * (legitimate sentence openers), and placeholder tokens ([T1:…], LINKREF001).
 * Works on plain text and on HTML (tags are skipped, <a>…</a> content is
 * left untouched).
 */
export function repairSentenceCase(input: string): string {
  const parts = input.split(/(<[^>]+>)/g);
  let insideAnchor = false;
  let atBlockStart = true;

  return parts.map((part) => {
    if (part.startsWith("<") && part.endsWith(">")) {
      const tag = part.toLowerCase();
      if (/^<a[\s>]/.test(tag)) insideAnchor = true;
      else if (tag.startsWith("</a")) insideAnchor = false;
      else if (/^<(p|blockquote|h[1-6]|li|td|th)[\s>]/.test(tag)) atBlockStart = true;
      return part;
    }
    if (!part.trim()) return part;
    if (insideAnchor) {
      atBlockStart = false;
      return part;
    }
    let repaired = part;
    if (atBlockStart) {
      repaired = repaired.replace(
        /^(\s*["'«“(\[]*)(\p{Ll})(?!\p{Lu})/u,
        (_, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`
      );
      atBlockStart = false;
    }
    repaired = repaired.replace(
      SENTENCE_BOUNDARY_LOWERCASE,
      (_, boundary: string, char: string) => `${boundary}${char.toUpperCase()}`
    );
    return repaired;
  }).join("");
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
