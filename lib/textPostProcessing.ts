// lib/textPostProcessing.ts
// Post-processing utilities for cleaning and enhancing article text

/**
 * Cleans invisible Unicode characters and normalizes whitespace
 * Based on Originality.ai's Invisible Text Detector & Remover tool
 * This is essential text sanitization to remove AI-generated hidden characters
 * Preserves HTML structure while cleaning text content
 * 
 * Reference: https://originality.ai/blog/invisible-text-detector-remover
 */
export function cleanInvisibleChars(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // ========================================
  // 0. CRITICAL: Replace Line Feed HTML entities FIRST (before any other processing)
  // HTML entities for U+000A: &#10; &#x0A; &#xa; (case insensitive)
  // ========================================
  // Replace HTML numeric entities for Line Feed (U+000A) with space
  cleaned = cleaned.replace(/&#10;/gi, ' '); // Decimal: &#10;
  cleaned = cleaned.replace(/&#x0A;/gi, ' '); // Hexadecimal: &#x0A;
  cleaned = cleaned.replace(/&#xa;/gi, ' '); // Hexadecimal lowercase: &#xa;
  cleaned = cleaned.replace(/&#X0A;/gi, ' '); // Hexadecimal uppercase: &#X0A;
  cleaned = cleaned.replace(/&#XA;/gi, ' '); // Hexadecimal uppercase: &#XA;

  // ========================================
  // 1. REMOVE all invisible characters (completely invisible)
  // ========================================
  
  // Zero-width characters
  cleaned = cleaned.replace(/[\u200B-\u200F]/g, ''); // Zero-width space, joiner, non-joiner, LTR/RTL marks
  cleaned = cleaned.replace(/\uFEFF/g, ''); // Zero-width NBSP / BOM
  
  // Directional formatting characters (invisible)
  cleaned = cleaned.replace(/[\u202A-\u202E]/g, ''); // LTR/RTL embedding, override, pop
  cleaned = cleaned.replace(/[\u2066-\u2069]/g, ''); // LTR/RTL isolates
  cleaned = cleaned.replace(/[\u206A-\u206F]/g, ''); // Symmetric swap, Arabic shaping, digit shapes
  
  // Word joiner and invisible operators
  cleaned = cleaned.replace(/\u2060/g, ''); // Word joiner
  cleaned = cleaned.replace(/[\u2061\u2063-\u2064]/g, ''); // Function application, invisible separator/plus
  cleaned = cleaned.replace(/\u2062/g, ''); // Invisible times (will be replaced separately)
  
  // Mongolian variation selectors
  cleaned = cleaned.replace(/[\u180B-\u180D]/g, ''); // Mongolian VS-1, VS-2, VS-3
  
  // Variation selectors (Unicode)
  cleaned = cleaned.replace(/[\uFE00-\uFE0F]/g, ''); // Variation Selector-1 through Variation Selector-16
  
  // Grapheme joiner
  cleaned = cleaned.replace(/\u034F/g, ''); // Grapheme joiner
  
  // Soft hyphen
  cleaned = cleaned.replace(/\u00AD/g, ''); // Soft hyphen
  
  // ========================================
  // CRITICAL: Replace Line Feed (U+000A) - after HTML entities are handled
  // According to Originality.ai: Line Feed should be replaced with space
  // This must happen BEFORE converting other separators to \n
  // ========================================
  // Replace ALL Line Feed characters (U+000A) with space immediately
  cleaned = cleaned.replace(/\u000A/g, ' '); // Direct Unicode replacement for U+000A
  cleaned = cleaned.replace(/\n/g, ' '); // Also catch any \n escape sequences (same as U+000A)
  
  // Line and paragraph separators (replace with space, not newlines)
  cleaned = cleaned.replace(/\u2028/g, ' '); // Line separator → space
  cleaned = cleaned.replace(/\u2029/g, ' '); // Paragraph separator → space
  
  // Control characters (LF is already handled above, now remove other control chars)
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  
  // File/Group/Record/Unit separators
  cleaned = cleaned.replace(/[\u001C-\u001F]/g, ''); // File, Group, Record, Unit separators
  
  // Carriage return (remove - we've already handled LF)
  cleaned = cleaned.replace(/\u000D/g, '');
  
  // ========================================
  // 2. REPLACE various space types with regular space (U+0020)
  // ========================================
  
  // Non-breaking space and related
  cleaned = cleaned.replace(/\u00A0/g, ' '); // No-Break Space
  
  // Unicode space variations
  cleaned = cleaned.replace(/[\u2000-\u200A]/g, ' '); // En Quad, Em Quad, En Space, Em Space, etc.
  cleaned = cleaned.replace(/\u202F/g, ' '); // Narrow NBSP
  cleaned = cleaned.replace(/\u205F/g, ' '); // Math Space
  cleaned = cleaned.replace(/\u3000/g, ' '); // Ideographic Space
  cleaned = cleaned.replace(/\u1680/g, ' '); // Ogham Space Mark
  cleaned = cleaned.replace(/\u180E/g, ' '); // Mongolian Vowel Separator
  cleaned = cleaned.replace(/[\u3164\uFFA0]/g, ' '); // Hangul Filler, Half-width Hangul Filler
  cleaned = cleaned.replace(/\u2800/g, ' '); // Braille Blank
  
  // ========================================
  // 3. REPLACE invisible operators with visible equivalents
  // ========================================
  
  cleaned = cleaned.replace(/\u2062/g, 'x'); // Invisible Times → "x"
  cleaned = cleaned.replace(/\u2063/g, ','); // Invisible Separator → ","
  cleaned = cleaned.replace(/\u2064/g, '+'); // Invisible Plus → "+"
  
  // ========================================
  // 4. REMOVE filler characters
  // ========================================
  
  cleaned = cleaned.replace(/[\u115F\u1160\u17B4\u17B5]/g, ''); // Hangul Choseong/Jungseong Fillers, Khmer Vowels
  
  // ========================================
  // 5. REPLACE special characters
  // ========================================
  
  cleaned = cleaned.replace(/\uFFFC/g, '[OBJECT]'); // Object Replacement → "[OBJECT]"
  
  // ========================================
  // 6. NORMALIZE tabs to spaces
  // ========================================
  
  cleaned = cleaned.replace(/\u0009/g, '    '); // Tab → 4 spaces
  
  // ========================================
  // 7. NORMALIZE whitespace (preserve HTML structure)
  // ========================================
  
  // Normalize spaces in text content between HTML tags
  // This handles any remaining Line Feeds (U+000A) that might be in text content
  cleaned = cleaned.replace(/>([^<]+)</g, (match, textContent) => {
    // Replace any remaining LF HTML entities first
    let normalized = textContent.replace(/&#10;/gi, ' ');
    normalized = normalized.replace(/&#x0A;/gi, ' ');
    normalized = normalized.replace(/&#xa;/gi, ' ');
    // Replace any remaining LF characters (U+000A) with space (in case some were missed)
    normalized = normalized.replace(/\u000A/g, ' '); // Direct Unicode replacement
    normalized = normalized.replace(/\n/g, ' '); // Also catch \n escape sequences
    // Normalize multiple spaces to single space
    normalized = normalized.replace(/\s{2,}/g, ' ');
    return '>' + normalized + '<';
  });
  
  // Normalize spaces outside tags
  cleaned = cleaned.replace(/([^>])\s{2,}([^<])/g, '$1 $2');
  
  // Since we've replaced all LFs with spaces, we now clean up HTML structure.
  // CRITICAL: Only collapse whitespace strictly BETWEEN adjacent tags (e.g. `</p> <p>`).
  // Do NOT strip whitespace between text and an inline tag — that was the cause of
  // anchors gluing to surrounding words ("tests aTikTok promotion packafter" — the
  // legitimate space before `<a>` and after `</a>` was being eaten by overly aggressive
  // regexes here, AFTER fixHtmlTagSpacing had already added them correctly).
  cleaned = cleaned.replace(/>\s+</g, '><'); // Safe: only matches whitespace between two tags

  // Remove excessive consecutive spaces (more than 2)
  cleaned = cleaned.replace(/ {3,}/g, ' '); // Max 1 space (multiple spaces collapsed)

  return cleaned;
}

/**
 * Normalizes quotes and dashes to standard ASCII equivalents
 * Converts fancy Unicode quotes/dashes to standard ones
 * Based on Originality.ai's Invisible Text Detector & Remover tool
 * 
 * Reference: https://originality.ai/blog/invisible-text-detector-remover
 */
export function normalizeQuotesAndDashes(text: string): string {
  if (!text) return text;

  let normalized = text;

  // ========================================
  // SMART QUOTES → STRAIGHT QUOTES
  // ========================================
  
  // Double quotes
  normalized = normalized.replace(/\u201C/g, '"'); // Left double quote (U+201C) → "
  normalized = normalized.replace(/\u201D/g, '"'); // Right double quote (U+201D) → "
  
  // Single quotes
  normalized = normalized.replace(/\u2018/g, "'"); // Left single quote (U+2018) → '
  normalized = normalized.replace(/\u2019/g, "'"); // Right single quote (U+2019) → '
  
  // ========================================
  // DASHES → HYPHEN
  // ========================================
  
  normalized = normalized.replace(/\u2014/g, '-'); // Em dash (U+2014) → hyphen
  normalized = normalized.replace(/\u2013/g, '-'); // En dash (U+2013) → hyphen
  
  // ========================================
  // ELLIPSIS → THREE DOTS
  // ========================================
  
  normalized = normalized.replace(/\u2026/g, '...'); // Horizontal ellipsis (U+2026) → ...

  return normalized;
}

/**
 * Fixes spacing around HTML tags to prevent words from merging
 * Adds spaces after closing tags and before opening tags if they're adjacent to letters/numbers
 * Example: "but<strong>completion</strong>is" → "but <strong>completion</strong> is"
 * Also handles anchors and other inline tags to prevent merging with text
 */
export function fixHtmlTagSpacing(text: string): string {
  if (!text) return text;
  
  let fixed = text;
  
  // CRITICAL: PRIORITY 1 - Handle <a> tags FIRST (most important for links)
  // These patterns MUST run before other tag patterns to ensure anchors are properly spaced
  // Pattern: word<a href="..."> → word <a href="...">
  // This handles: use<a href="..."> → use <a href="...">
  fixed = fixed.replace(/([A-Za-z0-9])(<a\s+[^>]*>)/g, '$1 $2');
  
  // Pattern: </a>word → </a> word
  // This handles: </a>once → </a> once
  fixed = fixed.replace(/(<\/a>)([A-Za-z0-9])/g, '$1 $2');

  // REMOVED (anchor underline bug):
  //   /([A-Za-z0-9])(<\/a>)/ → '$1 $2'
  // This pattern was supposed to fix "word</a>" but it inserted a space BETWEEN the
  // last letter and the closing tag — meaning the space ended up INSIDE the <a>
  // element. That made the trailing space underlined and clickable as part of the
  // link. The legitimate "</a>nextword" case (anchor merged with following word)
  // is already handled by the regex above, which puts the space AFTER </a>.
  
  // CRITICAL: Add space after closing tags (</strong>, </b>, </a>, </span>, etc.) if followed by letter/number
  // Pattern: </tag>letter → </tag> letter
  // This handles: word</tag>word → word</tag> word
  // IMPORTANT: This must handle <a> tags especially to prevent anchor merging
  fixed = fixed.replace(/(<\/(strong|b|a|span|em|i|u|mark|code|kbd|samp|var)[^>]*>)([A-Za-z0-9])/g, '$1 $3');
  
  // CRITICAL: Add space before opening tags (<strong>, <b>, <a>, etc.) if preceded by letter/number
  // Pattern: letter<tag> → letter <tag>
  // This handles: word<tag>word → word <tag>word
  // IMPORTANT: This must handle <a> tags especially to prevent anchor merging
  fixed = fixed.replace(/([A-Za-z0-9])(<(strong|b|a|span|em|i|u|mark|code|kbd|samp|var)[^>]*>)/g, '$1 $2');
  
  // Special case: handle anchors that might be adjacent to punctuation
  // Pattern: punctuation<tag> or </tag>punctuation (but not if it's already spaced)
  // This ensures anchors don't merge with punctuation marks
  fixed = fixed.replace(/([.,;:!?])(<(a|strong|b)[^>]*>)/g, '$1 $2');
  fixed = fixed.replace(/(<\/(a|strong|b)[^>]*>)([.,;:!?])/g, '$1 $3');
  
  // CRITICAL: Handle punctuation before/after links
  // Pattern: punctuation<a> -> punctuation <a> (unless it's part of the anchor)
  fixed = fixed.replace(/([.,;:!?])(<a\s+[^>]*>)/g, '$1 $2');
  // Pattern: </a>punctuation -> </a> punctuation
  fixed = fixed.replace(/(<\/a>)([.,;:!?])/g, '$1 $2');
  
  // Normalize multiple spaces back to single space (in case we added spaces that were already there)
  fixed = fixed.replace(/\s{2,}/g, ' ');
  
  return fixed;
}

/**
 * Removes excessive bold formatting from text
 * Limits bold tags to prevent spammy appearance
 * Rules:
 * - Maximum 3 bold tags per paragraph
 * - No consecutive bold tags (avoid <b>word</b><b>word</b>)
 * - Remove bold from very short words (1-2 characters) unless they're technical terms
 */
export function removeExcessiveBold(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // Split by paragraph-like boundaries AND table cell boundaries.
  // Each segment is checked independently for excessive bold — this prevents a
  // table with many bolded cells from having later cells stripped while earlier
  // ones keep their formatting (which produces visually inconsistent tables).
  const blocks = cleaned.split(/(<\/p>|<\/h[1-6]>|<\/li>|<\/td>|<\/th>)/);
  
  cleaned = blocks.map(block => {
    // Count bold tags in this block
    const boldMatches = block.match(/<b[^>]*>.*?<\/b>/gi) || [];
    
    // If more than 3 bold tags, remove excess (keep first 3)
    if (boldMatches.length > 3) {
      let count = 0;
      block = block.replace(/<b[^>]*>(.*?)<\/b>/gi, (match, content) => {
        count++;
        if (count <= 3) {
          return match; // Keep first 3
        } else {
          return content; // Remove bold, keep content
        }
      });
    }
    
    // Remove consecutive bold tags (merge them)
    // Pattern: </b><b> → </b> <b> (add space) or merge if same content
    block = block.replace(/<\/b>\s*<b[^>]*>/gi, ' ');
    
    // Remove bold from very short words (1-2 chars) that aren't likely to be technical terms
    // Keep common short technical terms like "AI", "API", "UI", "UX", "IT", "HR", "VPN"
    const shortTechTerms = /\b(AI|API|UI|UX|IT|HR|VPN|SEO|SMM|CTR|CPC|CPA|ROI|KPI)\b/i;
    block = block.replace(/<b[^>]*>([A-Za-z]{1,2})<\/b>/gi, (match, word) => {
      if (shortTechTerms.test(word)) {
        return match; // Keep bold for technical terms
      }
      return word; // Remove bold for other short words
    });
    
    return block;
  }).join('');
  
  return cleaned;
}

/**
 * Applies all text cleaning functions
 */
/**
 * Fix concatenation errors: "word Through" -> "word. Through"
 * Common AI error when two sentences are merged without punctuation
 */
function fixConcatenation(text: string): string {
  if (!text || text.length < 10) return text;
  // Sentence starters that often get concatenated (lowercase letter + space + Capital)
  const starters = ["Through", "However", "Therefore", "Thus", "Additionally", "Furthermore", "Moreover", "Meanwhile", "Similarly", "Consequently", "Nevertheless", "Instead", "Also", "Then", "Now", "So"];
  let fixed = text;
  for (const word of starters) {
    const re = new RegExp(`([a-z]) (${word})([\\s,])`, "g");
    fixed = fixed.replace(re, `$1. $2$3`);
  }
  return fixed;
}

/**
 * Remove numbered prefixes from H2/H3 headings: "1) Title" -> "Title", "Step 2: Title" -> "Title"
 */
function stripNumberedHeadings(html: string): string {
  if (!html) return html;
  // Match <h2> or <h3> tags with numbered prefixes like "1)", "2.", "Step 1:", "Part 2 -"
  return html.replace(
    /(<h[23][^>]*>)\s*(?:\d+[\).\-:]\s*|(?:Step|Part)\s+\d+[:\-.\s]+)/gi,
    '$1'
  );
}

/**
 * Replace arrow notation "->" / "=>" with proper punctuation in prose text
 * Preserves arrows inside <code>, <pre>, and HTML attributes
 */
function cleanArrowNotation(html: string): string {
  if (!html) return html;
  // Only replace arrows in text nodes (not inside tags or code blocks)
  return html.replace(
    /(?<=>)([^<]*?)(?:\s*->\s*|\s*=>\s*)([^<]*?)(?=<)/g,
    (match, before, after) => `${before} - ${after}`
  );
}

export function cleanText(text: string): string {
  if (!text) return text;

  let cleaned = text;
  cleaned = cleanInvisibleChars(cleaned);
  cleaned = normalizeQuotesAndDashes(cleaned);
  cleaned = fixConcatenation(cleaned);
  cleaned = stripNumberedHeadings(cleaned);
  cleaned = cleanArrowNotation(cleaned);

  return cleaned;
}

/**
 * Detect and strip AI prompt-scaffolding leaks from generated text.
 *
 * Background: The Undetectable.AI humanizer (and occasionally GPT itself) sometimes
 * leaks fragments of its internal prompt into the final article — phrases like
 * "Hier die Eingabe des Benutzers:" (German for "Here is the user's input:") or
 * English equivalents. An editor will reject the article instantly if such a marker
 * is present, so we strip them defensively as a final safety net.
 *
 * Strategy:
 *   1. Match any sentence containing a known leak marker (case-insensitive,
 *      multilingual — model can output any language).
 *   2. Remove the entire offending sentence (from the previous sentence boundary
 *      up to and including the next . ! ? newline).
 *   3. Collapse the resulting whitespace.
 *   4. Return the cleaned text + a list of detected markers (for logging).
 *
 * Markers are intentionally specific. We do NOT strip generic words like "input" or
 * "user" alone — only phrases that are clearly prompt scaffolding. False positives
 * here would damage real content, so the bar is high.
 */
// IMPORTANT: every marker below must be HIGHLY SPECIFIC to prompt/system scaffolding.
// We must NOT trigger on legitimate article content, especially in German where the
// user may write articles about form input, user experience, etc. The bar for inclusion
// is: "this phrase has no place in published article prose, only in model-internal
// prompt instructions". When in doubt — leave it out.
const PROMPT_LEAK_MARKERS: RegExp[] = [
  // ── German prompt-scaffolding leaks (observed in GPT-5.2 German output) ────────
  // "Hier (ist) die Eingabe des Benutzers" — literal "Here is the user's input"
  /Hier (?:ist )?die Eingabe des Benutzers/i,
  /Hier ist die Benutzereingabe/i,
  // Stand-alone scaffolding labels at line/sentence start
  /(?:^|\n)\s*Eingabe(?:\s+des\s+Benutzers)?\s*:/i,
  /(?:^|\n)\s*Benutzereingabe\s*:/i,
  /(?:^|\n)\s*Anweisung(?:en)?\s*:/i,
  /(?:^|\n)\s*Systemnachricht\s*:/i,
  // ── English ────────────────────────────────────────────────────────────────────
  /Here(?:'s| is) the (?:user(?:'s)?|original) input/i,
  /Below is the (?:user(?:'s)?|original) (?:input|prompt|message)/i,
  /(?:^|\n)\s*User (?:input|prompt|message)\s*:/i,
  /(?:^|\n)\s*System (?:message|prompt)\s*:/i,
  /As an AI (?:language )?model/i,
  /I(?:'m| am) (?:an? )?(?:AI|language model|large language model|LLM)\b/i,
  /\bI cannot (?:fulfill|comply with) (?:this|that|your) (?:request|prompt)/i,
  // ── Spanish / French / Italian / Russian / Ukrainian leak prefixes ─────────────
  /Aquí (?:está|tienes) la entrada del usuario/i,
  /Voici l['']entrée de l['']utilisateur/i,
  /Ecco l['']input dell['']utente/i,
  /Вот ввод пользователя/i,
  /Ось ввід користувача/i,
  // ── Generic system / template markers ──────────────────────────────────────────
  /\[Your response here\]/i,
  /\{\{[A-Z_]+\}\}/, // un-replaced template variables like {{TOPIC_TITLE}}
  /\[\[[A-Z_]+\]\]/, // un-replaced [[ANCHOR_TEXT]] etc.
];

export interface PromptLeakStripResult {
  cleaned: string;
  removedSentences: string[];
}

export function stripPromptLeaks(text: string): PromptLeakStripResult {
  if (!text) return { cleaned: text, removedSentences: [] };

  // Quick reject: only do the expensive sentence walk if at least one marker matches.
  const hasAnyMarker = PROMPT_LEAK_MARKERS.some((re) => re.test(text));
  if (!hasAnyMarker) return { cleaned: text, removedSentences: [] };

  // Split into sentences using punctuation + whitespace as boundaries.
  // Keep punctuation attached to each sentence so reassembly stays natural.
  // Regex captures groups of (sentence text + ending punctuation + trailing space).
  const sentences = text.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+$/g) || [text];

  const removed: string[] = [];
  const kept = sentences.filter((sentence) => {
    const hit = PROMPT_LEAK_MARKERS.some((re) => re.test(sentence));
    if (hit) {
      removed.push(sentence.trim());
      return false;
    }
    return true;
  });

  if (removed.length === 0) {
    // Marker matched the whole text but no individual sentence captured it
    // (e.g. multi-line marker). Fall back: replace the marker substring directly.
    let fallback = text;
    for (const re of PROMPT_LEAK_MARKERS) {
      fallback = fallback.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), "");
    }
    return {
      cleaned: fallback.replace(/\s{2,}/g, " ").trim(),
      removedSentences: ["<inline marker(s) stripped>"],
    };
  }

  const cleaned = kept.join("").replace(/\s{2,}/g, " ").trim();
  return { cleaned, removedSentences: removed };
}

