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
  
  // Line and paragraph separators (invisible - convert to newlines)
  cleaned = cleaned.replace(/\u2028/g, '\n'); // Line separator
  cleaned = cleaned.replace(/\u2029/g, '\n\n'); // Paragraph separator
  
  // Control characters (except newline U+000A which we keep)
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  
  // File/Group/Record/Unit separators
  cleaned = cleaned.replace(/[\u001C-\u001F]/g, ''); // File, Group, Record, Unit separators
  
  // Carriage return (keep only Line Feed for consistency)
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
  cleaned = cleaned.replace(/>([^<]+)</g, (match, textContent) => {
    const normalized = textContent.replace(/\s{2,}/g, ' ');
    return '>' + normalized + '<';
  });
  
  // Normalize spaces outside tags
  cleaned = cleaned.replace(/([^>])\s{2,}([^<])/g, '$1 $2');
  
  // Remove leading/trailing whitespace from lines, preserving HTML tags
  const lines = cleaned.split('\n');
  cleaned = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return trimmed;
    }
    return trimmed;
  }).filter(line => line.length > 0).join('\n');
  
  // Remove excessive empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

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

