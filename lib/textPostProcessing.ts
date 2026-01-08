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
  // CRITICAL: Replace Line Feed (U+000A) FIRST - before any other processing
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
    // Replace any remaining LF characters (U+000A) with space (in case some were missed)
    let normalized = textContent.replace(/\u000A/g, ' '); // Direct Unicode replacement
    normalized = normalized.replace(/\n/g, ' '); // Also catch \n escape sequences
    // Normalize multiple spaces to single space
    normalized = normalized.replace(/\s{2,}/g, ' ');
    return '>' + normalized + '<';
  });
  
  // Normalize spaces outside tags
  cleaned = cleaned.replace(/([^>])\s{2,}([^<])/g, '$1 $2');
  
  // Since we've replaced all LFs with spaces, we now clean up HTML structure
  // Remove spaces between tags (but preserve text content)
  cleaned = cleaned.replace(/>\s+</g, '><'); // Remove spaces between consecutive tags
  cleaned = cleaned.replace(/>\s+/g, '>'); // Remove leading spaces after opening tags
  cleaned = cleaned.replace(/\s+</g, '<'); // Remove trailing spaces before closing tags
  
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
  
  // Add space after closing tags (</strong>, </b>, </a>, </span>, etc.) if followed by letter/number
  // Pattern: </tag>letter → </tag> letter
  // This handles: word</tag>word → word</tag> word
  fixed = fixed.replace(/(<\/(strong|b|a|span|em|i|u|mark|code|kbd|samp|var)[^>]*>)([A-Za-z0-9])/g, '$1 $3');
  
  // Add space before opening tags (<strong>, <b>, <a>, etc.) if preceded by letter/number
  // Pattern: letter<tag> → letter <tag>
  // This handles: word<tag>word → word <tag>word
  fixed = fixed.replace(/([A-Za-z0-9])(<(strong|b|a|span|em|i|u|mark|code|kbd|samp|var)[^>]*>)/g, '$1 $2');
  
  // Special case: handle anchors that might be adjacent to punctuation
  // Pattern: punctuation<tag> or </tag>punctuation (but not if it's already spaced)
  // This ensures anchors don't merge with punctuation marks
  fixed = fixed.replace(/([.,;:!?])(<(a|strong|b)[^>]*>)/g, '$1 $2');
  fixed = fixed.replace(/(<\/(a|strong|b)[^>]*>)([.,;:!?])/g, '$1 $3');
  
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
  
  // Split by paragraph-like boundaries (</p>, </h2>, </h3>, etc.)
  // For simplicity, we'll process the whole text but limit bold per "block"
  const blocks = cleaned.split(/(<\/p>|<\/h[1-6]>|<\/li>)/);
  
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
export function cleanText(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  cleaned = cleanInvisibleChars(cleaned);
  cleaned = normalizeQuotesAndDashes(cleaned);
  
  return cleaned;
}

/**
 * Light human edit: rewrites text with slight variations in rhythm and word choice
 * while preserving all HTML structure (tags, links, headings, formatting) exactly as they are
 */
export async function lightHumanEdit(
  text: string,
  openaiClient: any,
  options: { preserveHtml?: boolean } = {}
): Promise<string> {
  if (!text) return text;

  const preserveHtml = options.preserveHtml !== false; // Default to true

  if (!preserveHtml) {
    // If HTML preservation is disabled, just rewrite plain text
    const rewritePrompt = `Rewrite this text in the same meaning and structure, but slightly vary sentence rhythm, transitions, and word choice.

Text to rewrite:
${text}

Important:
- Maintain the same overall meaning and structure
- Vary sentence length and rhythm naturally
- Use different transitions and word choices
- Keep the same tone and style`;

    try {
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: "You are a professional editor who improves text flow and naturalness.",
          },
          {
            role: "user",
            content: rewritePrompt,
          },
        ],
        temperature: 0.6,
      });

      return completion.choices[0]?.message?.content ?? text;
    } catch (error) {
      console.error('[text-post-processing] Light human edit failed:', error);
      return text;
    }
  }

  // Strategy: Replace all HTML tags with placeholders, rewrite text content, then restore tags
  // This ensures we preserve ALL HTML structure, not just specific tags
  
  const htmlElements: Array<{ original: string; placeholder: string }> = [];
  let elementIndex = 0;
  
  // Match all HTML tags (including self-closing tags and tags with attributes)
  // This regex matches: <tag>, </tag>, <tag attr="value">, <tag/>, etc.
  const htmlTagRegex = /<\/?[a-zA-Z][^>]*>/g;
  
  let textWithPlaceholders = text.replace(htmlTagRegex, (match) => {
    const placeholder = `__HTML_${elementIndex}__`;
    htmlElements.push({
      original: match,
      placeholder,
    });
    elementIndex++;
    return placeholder;
  });

  // #region agent log
  const extractionLog = {location:'textPostProcessing.ts:120',message:'[light-human-edit] HTML tags extracted',data:{originalLength:text.length,htmlTagsCount:htmlElements.length,textWithPlaceholdersLength:textWithPlaceholders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'html-extraction'};
  console.log("[text-post-processing-debug]", extractionLog);
  // #endregion

  // Create rewrite prompt
  const rewritePrompt = `Rewrite this text in the same meaning and structure, but slightly vary sentence rhythm, transitions, and word choice. Keep all placeholders (__HTML_X__) exactly as they are - do not modify or remove them.

Text to rewrite:
${textWithPlaceholders}

Important:
- Preserve all placeholders (__HTML_X__) exactly as written - they represent HTML tags
- Maintain the same overall meaning and structure
- Vary sentence length and rhythm naturally
- Use different transitions and word choices
- Keep the same tone and style
- Only modify the text content between placeholders, not the placeholders themselves`;

  try {
    // #region agent log
    const apiCallLog = {location:'textPostProcessing.ts:145',message:'[light-human-edit] Calling OpenAI API',data:{model:'gpt-5.1',temperature:0.6},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'openai-call'};
    console.log("[text-post-processing-debug]", apiCallLog);
    // #endregion

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: "You are a professional editor who improves text flow and naturalness while preserving all HTML structure exactly.",
        },
        {
          role: "user",
          content: rewritePrompt,
        },
      ],
      temperature: 0.6, // Lower temperature for more controlled variation
    });

    let rewritten = completion.choices[0]?.message?.content ?? textWithPlaceholders;

    // #region agent log
    const rewriteSuccessLog = {location:'textPostProcessing.ts:165',message:'[light-human-edit] OpenAI response received',data:{rewrittenLength:rewritten.length,placeholdersFound:htmlElements.length},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'openai-response'};
    console.log("[text-post-processing-debug]", rewriteSuccessLog);
    // #endregion

    // Restore all HTML elements in reverse order to avoid conflicts
    // (e.g., if placeholder __HTML_0__ contains __HTML_1__, we need to restore in reverse)
    for (let i = htmlElements.length - 1; i >= 0; i--) {
      const element = htmlElements[i];
      rewritten = rewritten.replace(new RegExp(element.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), element.original);
    }

    // #region agent log
    const restorationLog = {location:'textPostProcessing.ts:175',message:'[light-human-edit] HTML tags restored',data:{finalLength:rewritten.length,restoredTagsCount:htmlElements.length},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'html-restoration'};
    console.log("[text-post-processing-debug]", restorationLog);
    // #endregion

    return rewritten;
  } catch (error) {
    // #region agent log
    const errorLog = {location:'textPostProcessing.ts:180',message:'[light-human-edit] Error during rewrite',data:{error:(error as Error).message,errorName:(error as Error).name},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'error-handling'};
    console.log("[text-post-processing-debug]", errorLog);
    // #endregion
    console.error('[text-post-processing] Light human edit failed, returning original text:', error);
    return text; // Return original text if rewrite fails
  }
}

