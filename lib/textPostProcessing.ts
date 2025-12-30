// lib/textPostProcessing.ts
// Post-processing utilities for cleaning and enhancing article text

import { getCostTracker } from "@/lib/costTracker";
import { HUMANIZE_PASS_1_PRESET, applyPreset } from "@/lib/llmPresets";

/**
 * Cleans invisible Unicode characters and normalizes whitespace
 * Based on Originality.ai's approach: removes hidden Unicode characters that LLMs inject
 * This humanizes text by removing AI-typical formatting characters
 * Preserves HTML structure while cleaning text content
 */
export function cleanInvisibleChars(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove zero-width characters (completely invisible)
  // U+200B: Zero-width space
  // U+200C: Zero-width non-joiner
  // U+200D: Zero-width joiner
  // U+200E: Left-to-right mark
  // U+200F: Right-to-left mark
  // U+FEFF: Zero-width no-break space / BOM
  cleaned = cleaned.replace(/[\u200B-\u200F\uFEFF]/g, '');
  
  // Remove other invisible Unicode characters commonly used by LLMs
  // U+180B-D: Mongolian variation selectors (invisible)
  cleaned = cleaned.replace(/[\u180B-\u180D]/g, '');
  
  // U+FE00-FE0F: Variation selectors (invisible)
  cleaned = cleaned.replace(/[\uFE00-\uFE0F]/g, '');
  
  // U+2060: Word joiner (invisible)
  // U+2061: Function application (invisible)
  // U+2062: Invisible times (invisible)
  // U+2063: Invisible separator (invisible)
  // U+2064: Invisible plus (invisible)
  cleaned = cleaned.replace(/[\u2060-\u2064]/g, '');
  
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
 * Removes Markdown syntax from text (converts to plain text or HTML)
 * LLMs sometimes use Markdown even when instructed to use HTML
 */
export function removeMarkdown(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove Markdown bold: **text** or __text__ → text
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold**
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1'); // __bold__
  
  // Remove Markdown italic: *text* or _text_ → text
  cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1'); // *italic* (but not **bold**)
  cleaned = cleaned.replace(/(?<!_)_([^_]+)_(?!_)/g, '$1'); // _italic_ (but not __bold__)
  
  // Remove Markdown links: [text](url) → text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove Markdown code: `code` → code
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  
  // Remove Markdown headers: # Header → Header
  cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  return cleaned;
}

/**
 * Normalizes quotes and dashes to standard ASCII equivalents
 * Converts fancy Unicode quotes/dashes to standard ones
 * This humanizes text by removing AI-typical formatting (em-dash is heavily used by GPT-5.2)
 * Based on Originality.ai's findings: LLMs overuse em-dash and smart quotes
 */
export function normalizeQuotesAndDashes(text: string): string {
  if (!text) return text;

  let normalized = text;

  // Normalize quotes (smart quotes → standard quotes)
  // U+201C: Left double quotation mark
  // U+201D: Right double quotation mark
  normalized = normalized.replace(/[""]/g, '"'); // Left/right double quotes → standard double quote
  // U+2018: Left single quotation mark
  // U+2019: Right single quotation mark
  normalized = normalized.replace(/['']/g, "'"); // Left/right single quotes → standard single quote
  
  // Normalize dashes (em-dash and en-dash → comma or hyphen for more natural text)
  // U+2014: Em dash (—) - heavily used by GPT-5.2, makes text look AI-generated
  // U+2013: En dash (–)
  // Strategy: Replace em-dash with comma + space for more natural flow, or just comma
  // This makes text less "AI-like" as em-dash is a strong AI indicator
  normalized = normalized.replace(/—/g, ', '); // Em dash → comma + space (more natural)
  normalized = normalized.replace(/–/g, '-'); // En dash → hyphen
  
  // Normalize ellipsis
  // U+2026: Horizontal ellipsis
  normalized = normalized.replace(/…/g, '...'); // Ellipsis → three dots

  return normalized;
}

/**
 * Detects and logs hidden Unicode characters (for debugging)
 * Based on Originality.ai's invisible text detector approach
 */
export function detectHiddenChars(text: string): Array<{ char: string; code: string; description: string }> {
  if (!text) return [];

  const hiddenChars: Array<{ char: string; code: string; description: string }> = [];
  
  // Common invisible/hidden Unicode characters that LLMs inject
  const patterns = [
    { regex: /[\u200B-\u200F\uFEFF]/g, description: 'Zero-width characters' },
    { regex: /[\u180B-\u180D]/g, description: 'Mongolian variation selectors' },
    { regex: /[\uFE00-\uFE0F]/g, description: 'Variation selectors' },
    { regex: /[\u2060-\u2064]/g, description: 'Word joiners and invisible operators' },
    { regex: /[—–]/g, description: 'Em-dash and en-dash (AI indicator)' },
    { regex: /[""]/g, description: 'Smart double quotes (AI indicator)' },
    { regex: /['']/g, description: 'Smart single quotes (AI indicator)' },
    { regex: /…/g, description: 'Ellipsis character' },
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern.regex);
    if (matches) {
      matches.forEach(match => {
        const code = `U+${match.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
        if (!hiddenChars.find(h => h.code === code)) {
          hiddenChars.push({
            char: match,
            code,
            description: pattern.description,
          });
        }
      });
    }
  }

  return hiddenChars;
}

/**
 * Applies all text cleaning functions
 * This is the main function to use for humanizing AI-generated text
 */
export function cleanText(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // First, remove Markdown syntax (LLMs sometimes use it despite HTML instructions)
  cleaned = removeMarkdown(cleaned);
  
  // Then, clean invisible characters
  cleaned = cleanInvisibleChars(cleaned);
  
  // Finally, normalize quotes and dashes (removes AI indicators like em-dash)
  cleaned = normalizeQuotesAndDashes(cleaned);
  
  // Log detected hidden chars for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    const detected = detectHiddenChars(text);
    if (detected.length > 0) {
      console.log('[text-post-processing] Detected hidden Unicode characters:', detected);
    }
  }
  
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
        model: "gpt-5.2",
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
    const apiCallLog = {location:'textPostProcessing.ts:145',message:'[light-human-edit] Calling OpenAI API',data:{model:'gpt-5.2',temperature:0.6},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'openai-call'};
    console.log("[text-post-processing-debug]", apiCallLog);
    // #endregion

    // Use HUMANIZE_PASS_1 preset for light human edit
    // Note: For multi-pass humanization, we could use PASS_1, PASS_2, PASS_3
    // Currently using PASS_1 as a balanced approach
    const apiParams = applyPreset(HUMANIZE_PASS_1_PRESET);

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-5.2",
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
      ...apiParams,
    });

    let rewritten = completion.choices[0]?.message?.content ?? textWithPlaceholders;

    // Track cost
    const costTracker = getCostTracker();
    const usage = completion.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    if (inputTokens > 0 || outputTokens > 0) {
      costTracker.trackOpenAIChat('gpt-5.2', inputTokens, outputTokens);
    }

    // #region agent log
    const rewriteSuccessLog = {location:'textPostProcessing.ts:165',message:'[light-human-edit] OpenAI response received',data:{rewrittenLength:rewritten.length,placeholdersFound:htmlElements.length,usage:{inputTokens,outputTokens}},timestamp:Date.now(),sessionId:'debug-session',runId:'light-human-edit',hypothesisId:'openai-response'};
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

