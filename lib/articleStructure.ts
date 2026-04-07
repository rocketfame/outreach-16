// lib/articleStructure.ts
// Block-based article structure for live humanization

// Debug logger — silent in production unless DEBUG_ANCHORS=1 is set.
// Replaces noisy `[debug-7bb5e0]` style instrumentation that was kept around for
// troubleshooting the anchor pipeline. console.warn/error stay loud.
const dbg: (...args: unknown[]) => void =
  process.env.DEBUG_ANCHORS === '1' || process.env.NODE_ENV !== 'production'
    ? (...args) => console.log(...args)
    : () => {};

export type BlockType = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'li' | 'ul' | 'ol' | 'table';

export interface ArticleBlockBase {
  id: string;          // unique ID per block
  type: BlockType;
  text: string;        // plain text, no HTML tags (may contain placeholders like [A1], [T1])
}

export interface ListBlock extends ArticleBlockBase {
  type: 'ul' | 'ol';
  items: ArticleBlockBase[]; // type 'li'
}

export interface TableBlock extends ArticleBlockBase {
  type: 'table';
  caption?: string;
  headers: string[];
  rows: string[][];
}

export type ArticleBlock = ArticleBlockBase | ListBlock | TableBlock;

/**
 * Model-friendly block format (NO HTML). Used to avoid heuristic parsing and produce stable HTML.
 */
export type ModelArticleBlock =
  | { type: 'h1' | 'h2' | 'h3' | 'h4' | 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] };

export interface AnchorSpec {
  id: string;           // e.g. "A1"
  text: string;         // visible anchor text
  url: string;          // href
  blockIndex?: number;  // optional: which block this anchor should appear in
}

export interface TrustSourceSpec {
  id: string;           // e.g. "T1"
  text: string;         // anchor label
  url: string;
  blockIndex?: number;  // optional: which block this trust source should appear in
}

export interface ArticleStructure {
  blocks: ArticleBlock[];
  meta: {
    titleTag: string;
    metaDescription: string;
    h1: string;
  };
  anchors: AnchorSpec[];
  trustSources: TrustSourceSpec[];
  humanizedOnWrite?: boolean; // flag indicating if article was humanized during generation
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(text: string): string {
  // Minimal escaping for attribute context
  return escapeHtml(text);
}

const isValidTrustUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
};

/** Extract main brand from URL (e.g. creators.spotify.com → Spotify, not Creators) */
function getBrandFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const parts = host.split(".");
    // subdomain.brand.tld → use brand (index 1); domain.tld → use domain (index 0)
    const brandPart = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
    if (brandPart && brandPart.length > 1 && brandPart.length < 25) {
      return brandPart.charAt(0).toUpperCase() + brandPart.slice(1).toLowerCase();
    }
  } catch {}
  return null;
}

/**
 * Injects anchor and trust source links into text by replacing placeholders
 * Also converts markdown-style bold (**text**) to HTML <b> tags
 */
export function injectAnchorsIntoText(
  text: string, 
  anchors: AnchorSpec[], 
  trusts: TrustSourceSpec[]
): string {
  if (!text) return '';

  // #region agent log
  const hasA1InText = text.includes('[A1]');
  const hasA1InAnchors = anchors.some(a => a.id === 'A1');
  if (hasA1InText && !hasA1InAnchors) {
    dbg('[debug-7bb5e0] CRITICAL: [A1] found in text but NO A1 in anchors array!', JSON.stringify({textPreview:text.substring(0,150),anchorsCount:anchors.length,anchors:anchors.map(a=>({id:a.id,text:a.text})),trustsCount:trusts.length}));
  }
  if (hasA1InText || hasA1InAnchors) {
    dbg('[debug-7bb5e0] injectAnchorsIntoText A1 status:', JSON.stringify({hasA1InText,hasA1InAnchors,anchorsIds:anchors.map(a=>a.id),textA1Context:hasA1InText?text.substring(Math.max(0,text.indexOf('[A1]')-30),text.indexOf('[A1]')+35):'N/A'}));
  }
  // #endregion

  // BUG 1 FIX: Normalize spacing around placeholders BEFORE any replacement
  // Ensures exactly one space before and after [A1], [T1]-[T8] to prevent glued words in final HTML
  // Use two-pass: (1) add space before if non-space char before placeholder (2) add space after if non-space char after
  text = text.replace(/([^\s])\[(A1|T[1-8])\]/g, '$1 [$2]');
  text = text.replace(/\[(A1|T[1-8])\]([^\s])/g, '[$1] $2');
  text = text.replace(/\s*\[(A1|T[1-8])\]\s*/g, ' [$1] ');

  // CRITICAL: First, check if placeholders exist in the original text
  const allPlaceholders: string[] = [];
  anchors.forEach(a => {
    const placeholder = `[${a.id}]`;
    if (text.includes(placeholder)) {
      allPlaceholders.push(placeholder);
    }
  });
  trusts.forEach(t => {
    const placeholder = `[${t.id}]`;
    if (text.includes(placeholder)) {
      allPlaceholders.push(placeholder);
    }
  });
  
  if (allPlaceholders.length > 0) {
    dbg(`[injectAnchorsIntoText] Found ${allPlaceholders.length} placeholders in text:`, allPlaceholders, {
      textLength: text.length,
      textPreview: text.substring(0, 300),
      anchorsProvided: anchors.length,
      trustsProvided: trusts.length,
    });
  } else {
    console.warn(`[injectAnchorsIntoText] No placeholders found in text! Expected:`, {
      anchors: anchors.map(a => `[${a.id}]`),
      trusts: trusts.map(t => `[${t.id}]`),
      textPreview: text.substring(0, 500),
      textLength: text.length,
    });
  }
  
  // CRITICAL: Protect placeholders BEFORE escaping HTML
  // Replace placeholders with temporary tokens that won't be affected by escapeHtml
  const placeholderMap = new Map<string, string>();
  let protectedText = text;
  let tokenIndex = 0;
  
  [...anchors, ...trusts].forEach(item => {
    const placeholder = `[${item.id}]`;
    if (protectedText.includes(placeholder)) {
      const token = `__PLACEHOLDER_TOKEN_${tokenIndex}__`;
      placeholderMap.set(token, placeholder);
      protectedText = protectedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), token);
      tokenIndex++;
      dbg(`[injectAnchorsIntoText] Protected placeholder ${placeholder} -> ${token}`);
    }
  });
  
  if (placeholderMap.size > 0) {
    dbg(`[injectAnchorsIntoText] Protected ${placeholderMap.size} placeholders. Protected text preview:`, protectedText.substring(0, 300));
  }
  
  // Now escape HTML (placeholders are protected as tokens)
  let result = escapeHtml(protectedText);
  dbg(`[injectAnchorsIntoText] After escapeHtml, text length: ${result.length}, tokens found: ${Array.from(placeholderMap.keys()).filter(t => result.includes(t)).length}`);

  // Convert markdown-style bold (**text**) to HTML <b> tags
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Convert markdown-style italic (*text*) to HTML <i> tags (if not already bold)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');

  // Restore placeholders from tokens
  let restoredCount = 0;
  placeholderMap.forEach((placeholder, token) => {
    const beforeRestore = result.includes(token);
    result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
    const afterRestore = result.includes(placeholder);
    if (beforeRestore && afterRestore) {
      restoredCount++;
      dbg(`[injectAnchorsIntoText] Successfully restored ${placeholder} from ${token}`);
    } else if (beforeRestore && !afterRestore) {
      console.error(`[injectAnchorsIntoText] ERROR: Failed to restore ${placeholder} from ${token}`);
    } else if (!beforeRestore) {
      console.warn(`[injectAnchorsIntoText] Token ${token} not found in text after escapeHtml`);
    }
  });
  
  if (placeholderMap.size > 0) {
    const finalPlaceholders = (result.match(/\[([AT][1-8])\]/g) || []).length;
    dbg(`[injectAnchorsIntoText] After restoration: ${restoredCount}/${placeholderMap.size} placeholders restored, ${finalPlaceholders} total placeholders found in result`);
  }

  // Replace anchor placeholders [A1], [A2], etc.
  // CRITICAL: Add spaces around anchors to prevent them from merging with adjacent text
  // This ensures anchors are always separated from surrounding words
  anchors.forEach(a => {
    const placeholder = `[${a.id}]`;
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeUrl = escapeHtmlAttr(a.url);
    const safeText = escapeHtml(a.text);
    // STEP 2 FIX: Wrap <a> tag with spaces so it never glues to adjacent words
    const anchorHtml = ` <a href="${safeUrl}">${safeText}</a> `;
    
    // DEBUG: Check if placeholder exists in text before replacement
    const placeholderExists = result.includes(placeholder);
    if (!placeholderExists) {
      console.warn(`[injectAnchorsIntoText] Placeholder ${placeholder} not found in text after restoration. Text preview: ${result.substring(0, 200)}`);
      return; // Skip if placeholder not found
    }
    
    // BUG 1: Normalize spacing RIGHT BEFORE substitution (catches humanization/modification edge cases)
    result = result.replace(new RegExp(`([^\\s])${escapedPlaceholder}`, 'g'), `$1 ${placeholder}`);
    result = result.replace(new RegExp(`${escapedPlaceholder}([^\\s])`, 'g'), `${placeholder} $1`);
    
    // Now replace placeholder with HTML anchor
    const beforeReplace = result;
    // CRITICAL: escapedPlaceholder is already escaped, don't escape it again!
    const placeholderRegex = new RegExp(escapedPlaceholder, 'g');
    const matchesBefore = (result.match(placeholderRegex) || []).length;
    
    if (matchesBefore === 0 && placeholderExists) {
      // Fallback: try with unescaped placeholder (in case escapeHtml changed something)
      const unescapedRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const unescapedMatches = (result.match(unescapedRegex) || []).length;
      if (unescapedMatches > 0) {
        dbg(`[injectAnchorsIntoText] Using unescaped regex for ${placeholder} (found ${unescapedMatches} matches)`);
        result = result.replace(unescapedRegex, anchorHtml);
      } else {
        console.error(`[injectAnchorsIntoText] CRITICAL: Placeholder ${placeholder} exists in text but regex finds 0 matches! Text sample: ${result.substring(result.indexOf(placeholder) - 50, result.indexOf(placeholder) + 50)}`);
      }
    } else {
    result = result.replace(placeholderRegex, anchorHtml);
    }

    const matchesAfter = (result.match(placeholderRegex) || []).length;
    const linksAfter = (result.match(new RegExp(`<a[^>]*>.*?</a>`, 'g')) || []).length;
    
    // DEBUG: Verify replacement happened
    if (beforeReplace === result && placeholderExists) {
      console.error(`[injectAnchorsIntoText] Failed to replace placeholder ${placeholder}. Regex: ${escapedPlaceholder}, matches before: ${matchesBefore}, text preview: ${result.substring(0, 300)}`);
    } else if (beforeReplace !== result) {
      dbg(`[injectAnchorsIntoText] Successfully replaced placeholder ${placeholder} (${matchesBefore} matches -> ${matchesAfter} remaining, ${linksAfter} links total)`);
    } else if (!placeholderExists) {
      console.warn(`[injectAnchorsIntoText] Placeholder ${placeholder} not found in text, skipping replacement`);
    }
  });

  // Replace trust source placeholders [T1], [T2], etc.
  // CRITICAL: Add spaces around anchors to prevent them from merging with adjacent text
  // This ensures anchors are always separated from surrounding words
  trusts.forEach(t => {
    const placeholder = `[${t.id}]`;
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // BUG 2: Debug logging for trust source substitution
    dbg("[trust-source] Substituting", placeholder, "with url:", t?.url, "text:", t?.text);
    
    if (!isValidTrustUrl(t.url)) {
      console.warn("[trust-source] Invalid URL skipped:", t.url);
    }
    const safeUrl = isValidTrustUrl(t.url) ? escapeHtmlAttr(t.url.trim()) : "";

    // CRITICAL: Trim anchor text to 1-3 words (enforce maximum)
    // This ensures short, natural anchor text instead of long article titles
    const words = t.text.trim().split(/\s+/);
    let anchorText = t.text;
    if (words.length > 3) {
      // Take first 1-3 words, preferring shorter if it makes sense
      // Extract MAIN brand from URL (creators.spotify.com → Spotify, not Creators)
      const brandFromUrl = isValidTrustUrl(t.url) ? getBrandFromUrl(t.url) : null;
      if (brandFromUrl) {
        anchorText = brandFromUrl;
      } else {
        const shortWords = words.slice(0, 2).join(' ');
        if (shortWords.length < 5 || /^(the|a|an|this|that|how|what|why|when|where)\s/i.test(shortWords)) {
          anchorText = words.slice(0, 3).join(' ');
        } else {
          anchorText = shortWords;
        }
      }
    } else if (words.length > 2) {
      // If 3 words, keep as is (within limit)
      anchorText = words.slice(0, 3).join(' ');
    }
    
    const safeText = escapeHtml(anchorText);
    // BUG 2: If no valid URL, use <strong> instead of broken link
    // STEP 2 FIX: Wrap with spaces so anchor never glues to adjacent words
    const trustHtml = isValidTrustUrl(t.url)
      ? ` <a href="${safeUrl}">${safeText}</a> `
      : ` <strong>${safeText}</strong> `;

    // BUG 1: Normalize spacing RIGHT BEFORE trust source substitution
    result = result.replace(new RegExp(`([^\\s])${escapedPlaceholder}`, 'g'), `$1 ${placeholder}`);
    result = result.replace(new RegExp(`${escapedPlaceholder}([^\\s])`, 'g'), `${placeholder} $1`);

    // DEBUG: Check if placeholder exists in text before replacement
    const placeholderExists = result.includes(placeholder);
    if (!placeholderExists) {
      console.warn(`[injectAnchorsIntoText] Placeholder ${placeholder} not found in text after restoration. Text preview: ${result.substring(0, 200)}`);
      return; // Skip if placeholder not found
    }
    
    // Replace placeholder with trust source HTML
    const beforeReplace = result;
    // CRITICAL: escapedPlaceholder is already escaped, don't escape it again!
    const placeholderRegex = new RegExp(escapedPlaceholder, 'g');
    const matchesBefore = (result.match(placeholderRegex) || []).length;
    
    if (matchesBefore === 0 && placeholderExists) {
      // Fallback: try with unescaped placeholder (in case escapeHtml changed something)
      const unescapedRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const unescapedMatches = (result.match(unescapedRegex) || []).length;
      if (unescapedMatches > 0) {
        dbg(`[injectAnchorsIntoText] Using unescaped regex for ${placeholder} (found ${unescapedMatches} matches)`);
        result = result.replace(unescapedRegex, trustHtml);
      } else {
        console.error(`[injectAnchorsIntoText] CRITICAL: Placeholder ${placeholder} exists in text but regex finds 0 matches! Text sample: ${result.substring(result.indexOf(placeholder) - 50, result.indexOf(placeholder) + 50)}`);
      }
    } else {
      result = result.replace(placeholderRegex, trustHtml);
    }
    
    const matchesAfter = (result.match(placeholderRegex) || []).length;
    const linksAfter = (result.match(new RegExp(`<a[^>]*>.*?</a>`, 'g')) || []).length;
    
    // DEBUG: Verify replacement happened
    if (beforeReplace === result && placeholderExists) {
      console.error(`[injectAnchorsIntoText] Failed to replace placeholder ${placeholder}. Regex: ${escapedPlaceholder}, matches before: ${matchesBefore}, text preview: ${result.substring(0, 300)}`);
    } else if (beforeReplace !== result) {
      dbg(`[injectAnchorsIntoText] Successfully replaced placeholder ${placeholder} with trust source link (${matchesBefore} matches -> ${matchesAfter} remaining, ${linksAfter} links total)`);
    } else if (!placeholderExists) {
      console.warn(`[injectAnchorsIntoText] Placeholder ${placeholder} not found in text, skipping replacement`);
    }
  });

  // STEP 2: Clean double spaces after all placeholder replacements
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Converts ArticleBlocks to HTML string
 */
export function blocksToHtml(
  blocks: ArticleBlock[], 
  anchors: AnchorSpec[], 
  trusts: TrustSourceSpec[]
): string {
  // DEBUG: Check for placeholders in all blocks before processing
  const allPlaceholders: string[] = [];
  blocks.forEach(block => {
    if (block.type === 'ul' || block.type === 'ol') {
      const listBlock = block as ListBlock;
      listBlock.items.forEach(item => {
        const matches = item.text.match(/\[([AT][1-8])\]/g);
        if (matches) allPlaceholders.push(...matches);
      });
    } else if (block.type === 'table') {
      const tableBlock = block as TableBlock;
      if (tableBlock.caption) {
        const matches = tableBlock.caption.match(/\[([AT][1-8])\]/g);
        if (matches) allPlaceholders.push(...matches);
      }
      tableBlock.headers.forEach(h => {
        const matches = h.match(/\[([AT][1-8])\]/g);
        if (matches) allPlaceholders.push(...matches);
      });
      tableBlock.rows.forEach(row => {
        row.forEach(cell => {
          const matches = cell.match(/\[([AT][1-8])\]/g);
          if (matches) allPlaceholders.push(...matches);
        });
      });
    } else {
      const matches = block.text.match(/\[([AT][1-8])\]/g);
      if (matches) allPlaceholders.push(...matches);
    }
  });
  
  // #region agent log
  const a1InBlocks = allPlaceholders.includes('[A1]');
  const a1InAnchors = anchors.some(a => a.id === 'A1');
  dbg('[debug-7bb5e0] blocksToHtml summary:', JSON.stringify({placeholders:[...new Set(allPlaceholders)],a1InBlocks,a1InAnchors,anchorsProvided:anchors.map(a=>({id:a.id,text:a.text?.substring(0,30),url:a.url?.substring(0,50)})),trustsProvided:trusts.map(t=>({id:t.id,text:t.text?.substring(0,30)})),mismatch:a1InBlocks&&!a1InAnchors?'A1_IN_TEXT_BUT_NOT_IN_ANCHORS':'OK'}));
  // #endregion
  if (allPlaceholders.length > 0) {
    dbg(`[blocksToHtml] Found ${allPlaceholders.length} placeholders in blocks:`, {
      placeholders: [...new Set(allPlaceholders)],
      anchorsExpected: anchors.map(a => `[${a.id}]`),
      trustsExpected: trusts.map(t => `[${t.id}]`),
    });
  } else {
    console.warn(`[blocksToHtml] No placeholders found in blocks! Expected:`, {
      anchorsExpected: anchors.map(a => `[${a.id}]`),
      trustsExpected: trusts.map(t => `[${t.id}]`),
      blocksCount: blocks.length,
    });
  }
  
  return blocks.map(block => {
    if (block.type === 'table') {
      const tableBlock = block as TableBlock;
      const captionHtml = tableBlock.caption
        ? `<caption style="font-weight: 600; margin-bottom: 0.5rem; text-align: left;">${injectAnchorsIntoText(tableBlock.caption, anchors, trusts)}</caption>`
        : '';
      // CRITICAL: Add border styles for Google Docs compatibility
      // Google Docs requires inline styles with border properties to display table borders correctly
      const tableStyle = 'border-collapse: collapse; width: 100%; border: 1px solid #000;';
      const thStyle = 'border: 1px solid #000; padding: 8px 12px; text-align: left; background-color: #f5f5f5; font-weight: 600;';
      const tdStyle = 'border: 1px solid #000; padding: 8px 12px; text-align: left;';
      const theadHtml = `<thead><tr>${(tableBlock.headers || [])
        .map((h) => `<th style="${thStyle}">${injectAnchorsIntoText(h, anchors, trusts)}</th>`)
        .join('')}</tr></thead>`;
      const tbodyHtml = `<tbody>${(tableBlock.rows || [])
        .map((row) => `<tr>${(row || [])
          .map((cell) => `<td style="${tdStyle}">${injectAnchorsIntoText(cell, anchors, trusts)}</td>`)
          .join('')}</tr>`)
        .join('')}</tbody>`;
      return `<table style="${tableStyle}">${captionHtml}${theadHtml}${tbodyHtml}</table>`;
    }

    if (block.type === 'ul' || block.type === 'ol') {
      const listBlock = block as ListBlock;
      const tag = listBlock.type;
      const itemsHtml = listBlock.items.map(li => {
        const textWithLinks = injectAnchorsIntoText(li.text, anchors, trusts);
        return `<li>${textWithLinks}</li>`;
      }).join('');
      return `<${tag}>${itemsHtml}</${tag}>`;
    }

    const textWithLinks = injectAnchorsIntoText(block.text, anchors, trusts);
    const tag = block.type;
    return `<${tag}>${textWithLinks}</${tag}>`;
  }).join(''); // Join without newlines - cleanText will handle any whitespace normalization
}

/**
 * Converts model-provided articleBlocks into ArticleStructure deterministically.
 * This avoids heuristic parsing and ensures stable HTML structure (headings, lists, tables).
 */
export function modelBlocksToArticleStructure(
  modelBlocks: unknown,
  titleTag: string,
  metaDescription: string,
  anchorText?: string,
  anchorUrl?: string,
  trustSourcesList?: string[]
): ArticleStructure {
  const blocks: ArticleBlock[] = [];
  const anchors: AnchorSpec[] = [];
  const trustSources: TrustSourceSpec[] = [];

  const inputBlocks: unknown[] = Array.isArray(modelBlocks) ? modelBlocks : [];

  for (const raw of inputBlocks) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as Record<string, unknown>;
    if (typeof b.type !== 'string') continue;
    const type = b.type as BlockType;

    if (type === 'ul' || type === 'ol') {
      const items = Array.isArray(b.items) ? (b.items as unknown[]) : [];
      blocks.push({
        id: crypto.randomUUID(),
        type,
        text: '',
        items: items
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => ({ id: crypto.randomUUID(), type: 'li' as const, text: x.trim() })),
      } as ListBlock);
      continue;
    }

    if (type === 'table') {
      const headers = Array.isArray(b.headers) ? (b.headers as unknown[]) : [];
      const rows = Array.isArray(b.rows) ? (b.rows as unknown[]) : [];
      const caption = typeof b.caption === 'string' ? b.caption : undefined;
      blocks.push({
        id: crypto.randomUUID(),
        type: 'table',
        text: '',
        caption: caption?.trim() || undefined,
        headers: headers.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean),
        rows: rows
          .filter((r): r is unknown[] => Array.isArray(r))
          .map((r) => r.filter((c): c is string => typeof c === 'string').map((c) => c.trim())),
      } as TableBlock);
      continue;
    }

    // Regular text blocks
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) continue;
    if (type === 'h1' || type === 'h2' || type === 'h3' || type === 'h4' || type === 'p') {
      blocks.push({ id: crypto.randomUUID(), type, text });
    }
  }

  // Ensure first block is H1
  const first = blocks[0];
  const h1Text = first && first.type === 'h1' ? (first as ArticleBlockBase).text : (titleTag || '').trim();
  if (!first || first.type !== 'h1') {
    blocks.unshift({ id: crypto.randomUUID(), type: 'h1', text: h1Text || 'Article' });
  }

  // #region agent log
  dbg('[debug-7bb5e0] modelBlocksToArticleStructure anchor check:', JSON.stringify({anchorText,anchorUrl,anchorTextTruthy:!!anchorText,anchorUrlTruthy:!!anchorUrl,willAddA1:!!(anchorText&&anchorUrl),anchorTextCharCodes:anchorText?[...anchorText].slice(0,5).map(c=>c.charCodeAt(0)):[],anchorUrlCharCodes:anchorUrl?[...anchorUrl].slice(0,10).map(c=>c.charCodeAt(0)):[]}));
  // #endregion
  if (anchorText && anchorUrl) {
    anchors.push({ id: 'A1', text: anchorText, url: anchorUrl });
  }

  if (trustSourcesList && trustSourcesList.length > 0) {
    trustSourcesList.forEach((source, index) => {
      const parts = source.split('|');
      const url = parts.length > 1 ? parts[1] : parts[0];
      let name = parts.length > 1 ? parts[0] : `Source ${index + 1}`;
      
      // CRITICAL: Trim anchor text to 1-3 words maximum (as per prompt rules)
      // This ensures short, natural anchor text instead of long article titles
      const words = name.trim().split(/\s+/);
      if (words.length > 3) {
        // Take first 1-3 words, preferring shorter if it makes sense
        const brandFromUrl = getBrandFromUrl(url);
        if (brandFromUrl) {
          name = brandFromUrl;
        } else {
            // Fallback: use first 1-2 words from title (prefer shorter)
            const shortWords = words.slice(0, 2).join(' ');
            // If first 2 words are too generic or short, use first 3
            if (shortWords.length < 5 || /^(the|a|an|this|that|how|what|why|when|where)\s/i.test(shortWords)) {
            name = words.slice(0, 3).join(' ');
            } else {
              name = shortWords;
            }
        }
      } else if (words.length > 2) {
        // If 3 words, keep as is (within limit)
        name = words.slice(0, 3).join(' ');
      }
      
      trustSources.push({ id: `T${index + 1}`, text: name, url });
    });
  }

  return {
    blocks,
    meta: { titleTag, metaDescription, h1: h1Text || titleTag },
    anchors,
    trustSources,
  };
}

/**
 * Parses plain text article body into ArticleStructure
 * Handles headings, paragraphs, lists, and placeholders
 * 
 * Expected format:
 * - Headings: standalone lines (usually short, < 100 chars)
 * - Paragraphs: text separated by double newlines
 * - Lists: lines starting with "- " or "1. " etc.
 */
export function parsePlainTextToStructure(
  articleBodyText: string,
  titleTag: string,
  metaDescription: string,
  anchorText?: string,
  anchorUrl?: string,
  trustSourcesList?: string[]
): ArticleStructure {
  const blocks: ArticleBlock[] = [];
  const anchors: AnchorSpec[] = [];
  const trustSources: TrustSourceSpec[] = [];

  // Split by double newlines first to get major sections
  const sections = articleBodyText.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  
  let h1 = titleTag; // fallback to titleTag
  let currentList: ArticleBlockBase[] | null = null;
  let currentListType: 'ul' | 'ol' | null = null;
  let isFirstBlock = true;

  for (const section of sections) {
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a list item
      const bulletMatch = line.match(/^[-•]\s+(.+)$/);
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      
      if (bulletMatch || numberedMatch) {
        // This is a list item
        const listType = bulletMatch ? 'ul' : 'ol';
        const itemText = bulletMatch ? bulletMatch[1] : numberedMatch![2];
        
        // If we're starting a new list or changing list type, close previous list
        if (currentList && currentListType !== listType) {
          blocks.push({
            id: crypto.randomUUID(),
            type: currentListType!,
            items: currentList
          } as ListBlock);
          currentList = [];
          currentListType = listType;
        } else if (!currentList) {
          currentList = [];
          currentListType = listType;
        }
        
        currentList.push({
          id: crypto.randomUUID(),
          type: 'li',
          text: itemText
        });
      } else {
        // Close any open list
        if (currentList && currentList.length > 0) {
          blocks.push({
            id: crypto.randomUUID(),
            type: currentListType!,
            items: currentList
          } as ListBlock);
          currentList = null;
          currentListType = null;
        }
        
        // Determine block type
        // First block is usually H1
        if (isFirstBlock && line.length < 150 && !line.includes('. ') && !line.match(/^[a-z]/)) {
          h1 = line;
          blocks.push({
            id: crypto.randomUUID(),
            type: 'h1',
            text: line
          });
          isFirstBlock = false;
        } 
        // Check if this looks like a heading (short line, no sentence-ending punctuation, possibly all caps or title case)
        else if (line.length < 100 && 
                 !line.match(/[.!?]$/) && 
                 (line.length < 60 || line.match(/^[A-Z]/))) {
          // Try to determine heading level based on context and length
          // H2: usually longer, more descriptive (40-100 chars)
          // H3: usually shorter, more specific (20-60 chars)
          const level: 'h2' | 'h3' = line.length > 60 ? 'h2' : 'h3';
          blocks.push({
            id: crypto.randomUUID(),
            type: level,
            text: line
          });
          isFirstBlock = false;
        } else {
          // Regular paragraph
          blocks.push({
            id: crypto.randomUUID(),
            type: 'p',
            text: line
          });
          isFirstBlock = false;
        }
      }
    }
  }
  
  // Close any remaining list
  if (currentList && currentList.length > 0) {
    blocks.push({
      id: crypto.randomUUID(),
      type: currentListType!,
      items: currentList
    } as ListBlock);
  }

  // Extract anchor specs from placeholders in text
  if (anchorText && anchorUrl) {
    anchors.push({
      id: 'A1',
      text: anchorText,
      url: anchorUrl
    });
  }

  // Extract trust source specs from placeholders
  if (trustSourcesList && trustSourcesList.length > 0) {
    // Parse trust sources (format: "Name|URL" or just "URL")
    trustSourcesList.forEach((source, index) => {
      const parts = source.split('|');
      const url = parts.length > 1 ? parts[1] : parts[0];
      let name = parts.length > 1 ? parts[0] : `Source ${index + 1}`;
      
      // CRITICAL: Trim anchor text to 2-5 words maximum (as per prompt rules)
      // This ensures short, natural anchor text instead of long article titles
      const words = name.trim().split(/\s+/);
      if (words.length > 5) {
        const brandFromUrl = getBrandFromUrl(url);
        if (brandFromUrl) {
          name = brandFromUrl;
        } else {
          name = words.slice(0, 3).join(' ');
        }
      } else if (words.length > 2) {
        // If 3-5 words, keep as is (within limit)
        name = words.slice(0, 5).join(' ');
      }
      
      trustSources.push({
        id: `T${index + 1}`,
        text: name,
        url: url
      });
    });
  }

  return {
    blocks,
    meta: {
      titleTag,
      metaDescription,
      h1
    },
    anchors,
    trustSources
  };
}

