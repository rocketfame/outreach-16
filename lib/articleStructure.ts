// lib/articleStructure.ts
// Block-based article structure for live humanization

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

/**
 * Injects anchor and trust source links into text by replacing placeholders
 * Also converts markdown-style bold (**text**) to HTML <b> tags
 */
export function injectAnchorsIntoText(
  text: string, 
  anchors: AnchorSpec[], 
  trusts: TrustSourceSpec[]
): string {
  // Escape any model-provided text first to avoid HTML injection.
  let result = escapeHtml(text || '');

  // Convert markdown-style bold (**text**) to HTML <b> tags
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Convert markdown-style italic (*text*) to HTML <i> tags (if not already bold)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');

  // Replace anchor placeholders [A1], [A2], etc.
  // Add spaces around anchors to prevent them from merging with adjacent text
  anchors.forEach(a => {
    const placeholder = `[${a.id}]`;
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeUrl = escapeHtmlAttr(a.url);
    const safeText = escapeHtml(a.text);
    const anchorHtml = `<a href="${safeUrl}">${safeText}</a>`;
    // Replace placeholder with anchor, ensuring spaces on both sides if not already present
    // Pattern: (non-space)(placeholder)(non-space) -> $1 space anchor space $2
    result = result.replace(
      new RegExp(`([^\\s])${escapedPlaceholder}([^\\s])`, 'g'),
      `$1 ${anchorHtml} $2`
    );
    // Pattern: (non-space)(placeholder)(space or end) -> $1 space anchor $2
    result = result.replace(
      new RegExp(`([^\\s])${escapedPlaceholder}(\\s|$)`, 'g'),
      `$1 ${anchorHtml}$2`
    );
    // Pattern: (space or start)(placeholder)(non-space) -> $1 anchor space $2
    result = result.replace(
      new RegExp(`(^|\\s)${escapedPlaceholder}([^\\s])`, 'g'),
      `$1${anchorHtml} $2`
    );
    // Pattern: (space or start)(placeholder)(space or end) -> $1 anchor $2 (already has spaces)
    result = result.replace(
      new RegExp(`(^|\\s)${escapedPlaceholder}(\\s|$)`, 'g'),
      `$1${anchorHtml}$2`
    );
  });

  // Replace trust source placeholders [T1], [T2], etc.
  // Add spaces around anchors to prevent them from merging with adjacent text
  trusts.forEach(t => {
    const placeholder = `[${t.id}]`;
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeUrl = escapeHtmlAttr(t.url);
    const safeText = escapeHtml(t.text);
    const trustHtml = `<a href="${safeUrl}">${safeText}</a>`;
    // Replace placeholder with anchor, ensuring spaces on both sides if not already present
    // Pattern: (non-space)(placeholder)(non-space) -> $1 space anchor space $2
    result = result.replace(
      new RegExp(`([^\\s])${escapedPlaceholder}([^\\s])`, 'g'),
      `$1 ${trustHtml} $2`
    );
    // Pattern: (non-space)(placeholder)(space or end) -> $1 space anchor $2
    result = result.replace(
      new RegExp(`([^\\s])${escapedPlaceholder}(\\s|$)`, 'g'),
      `$1 ${trustHtml}$2`
    );
    // Pattern: (space or start)(placeholder)(non-space) -> $1 anchor space $2
    result = result.replace(
      new RegExp(`(^|\\s)${escapedPlaceholder}([^\\s])`, 'g'),
      `$1${trustHtml} $2`
    );
    // Pattern: (space or start)(placeholder)(space or end) -> $1 anchor $2 (already has spaces)
    result = result.replace(
      new RegExp(`(^|\\s)${escapedPlaceholder}(\\s|$)`, 'g'),
      `$1${trustHtml}$2`
    );
  });

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
  return blocks.map(block => {
    if (block.type === 'table') {
      const tableBlock = block as TableBlock;
      const captionHtml = tableBlock.caption
        ? `<caption>${injectAnchorsIntoText(tableBlock.caption, anchors, trusts)}</caption>`
        : '';
      const theadHtml = `<thead><tr>${(tableBlock.headers || [])
        .map((h) => `<th>${injectAnchorsIntoText(h, anchors, trusts)}</th>`)
        .join('')}</tr></thead>`;
      const tbodyHtml = `<tbody>${(tableBlock.rows || [])
        .map((row) => `<tr>${(row || [])
          .map((cell) => `<td>${injectAnchorsIntoText(cell, anchors, trusts)}</td>`)
          .join('')}</tr>`)
        .join('')}</tbody>`;
      return `<table>${captionHtml}${theadHtml}${tbodyHtml}</table>`;
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

  const inputBlocks = Array.isArray(modelBlocks) ? (modelBlocks as ModelArticleBlock[]) : [];

  for (const b of inputBlocks) {
    if (!b || typeof (b as any).type !== 'string') continue;
    const type = (b as any).type as BlockType;

    if (type === 'ul' || type === 'ol') {
      const items = Array.isArray((b as any).items) ? (b as any).items : [];
      blocks.push({
        id: crypto.randomUUID(),
        type,
        text: '',
        items: items
          .filter((x: any) => typeof x === 'string' && x.trim().length > 0)
          .map((x: string) => ({ id: crypto.randomUUID(), type: 'li', text: x.trim() })),
      } as ListBlock);
      continue;
    }

    if (type === 'table') {
      const headers = Array.isArray((b as any).headers) ? (b as any).headers : [];
      const rows = Array.isArray((b as any).rows) ? (b as any).rows : [];
      const caption = typeof (b as any).caption === 'string' ? (b as any).caption : undefined;
      blocks.push({
        id: crypto.randomUUID(),
        type: 'table',
        text: '',
        caption: caption?.trim() || undefined,
        headers: headers.filter((x: any) => typeof x === 'string').map((x: string) => x.trim()).filter(Boolean),
        rows: rows
          .filter((r: any) => Array.isArray(r))
          .map((r: any[]) => r.filter((c) => typeof c === 'string').map((c) => (c as string).trim())),
      } as TableBlock);
      continue;
    }

    // Regular text blocks
    const text = typeof (b as any).text === 'string' ? (b as any).text.trim() : '';
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

  if (anchorText && anchorUrl) {
    anchors.push({ id: 'A1', text: anchorText, url: anchorUrl });
  }

  if (trustSourcesList && trustSourcesList.length > 0) {
    trustSourcesList.forEach((source, index) => {
      const parts = source.split('|');
      const url = parts.length > 1 ? parts[1] : parts[0];
      let name = parts.length > 1 ? parts[0] : `Source ${index + 1}`;
      
      // CRITICAL: Trim anchor text to 2-5 words maximum (as per prompt rules)
      // This ensures short, natural anchor text instead of long article titles
      const words = name.trim().split(/\s+/);
      if (words.length > 5) {
        // Take first 2-5 words, preferring shorter if it makes sense
        // Try to extract brand name from URL if possible
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace('www.', '');
          const domainName = domain.split('.')[0];
          // Use domain name if it's a recognizable brand (2-3 words max)
          if (domainName.length > 2 && domainName.length < 20) {
            name = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          } else {
            // Fallback: use first 2-3 words from title
            name = words.slice(0, 3).join(' ');
          }
        } catch {
          // If URL parsing fails, use first 2-3 words from title
          name = words.slice(0, 3).join(' ');
        }
      } else if (words.length > 2) {
        // If 3-5 words, keep as is (within limit)
        name = words.slice(0, 5).join(' ');
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
        // Take first 2-5 words, preferring shorter if it makes sense
        // Try to extract brand name from URL if possible
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace('www.', '');
          const domainName = domain.split('.')[0];
          // Use domain name if it's a recognizable brand (2-3 words max)
          if (domainName.length > 2 && domainName.length < 20) {
            name = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          } else {
            // Fallback: use first 2-3 words from title
            name = words.slice(0, 3).join(' ');
          }
        } catch {
          // If URL parsing fails, use first 2-3 words from title
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

