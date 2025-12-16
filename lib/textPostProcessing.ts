// lib/textPostProcessing.ts
// Post-processing utilities for cleaning and enhancing article text

/**
 * Cleans invisible Unicode characters and normalizes whitespace
 * This is essential text sanitization, not a "detector bypass"
 * Preserves HTML structure while cleaning text content
 */
export function cleanInvisibleChars(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove zero-width characters (safe to remove everywhere)
  cleaned = cleaned.replace(/[\u200B-\u200F\uFEFF]/g, ''); // Zero-width space, joiner, non-joiner, etc.
  
  // Replace non-breaking space with regular space (safe for HTML)
  cleaned = cleaned.replace(/\u00A0/g, ' ');
  
  // Remove other control characters (except newlines, tabs, and HTML-safe chars)
  // Be careful: don't remove characters that might be part of HTML entities or structure
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  
  // Normalize tabs to spaces (safe for HTML - tabs are whitespace)
  cleaned = cleaned.replace(/\t+/g, ' ');
  
  // Remove multiple consecutive spaces, but preserve HTML structure
  // Strategy: process text content between HTML tags separately
  // This regex finds text between tags and normalizes spaces there
  cleaned = cleaned.replace(/>([^<]+)</g, (match, textContent) => {
    // Normalize spaces in text content (between tags)
    const normalized = textContent.replace(/\s{2,}/g, ' ');
    return '>' + normalized + '<';
  });
  
  // Also normalize spaces at the start/end of text (outside tags)
  cleaned = cleaned.replace(/([^>])\s{2,}([^<])/g, '$1 $2');
  
  // Remove leading/trailing whitespace from lines, but preserve HTML tags
  const lines = cleaned.split('\n');
  cleaned = lines.map(line => {
    const trimmed = line.trim();
    // If line is just whitespace or empty, return empty string
    if (!trimmed) return '';
    // If line is an HTML tag, preserve it as-is (but trim whitespace around it)
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return trimmed;
    }
    // Otherwise, trim the line
    return trimmed;
  }).filter(line => line.length > 0).join('\n');
  
  // Remove excessive empty lines (more than 2 consecutive newlines)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned;
}

/**
 * Normalizes quotes and dashes to standard ASCII equivalents
 * Converts fancy Unicode quotes/dashes to standard ones
 */
export function normalizeQuotesAndDashes(text: string): string {
  if (!text) return text;

  let normalized = text;

  // Normalize quotes
  normalized = normalized.replace(/[""]/g, '"'); // Left/right double quotes → standard double quote
  normalized = normalized.replace(/['']/g, "'"); // Left/right single quotes → standard single quote
  
  // Normalize dashes
  normalized = normalized.replace(/[—–]/g, '-'); // Em dash, en dash → hyphen
  normalized = normalized.replace(/…/g, '...'); // Ellipsis → three dots

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

