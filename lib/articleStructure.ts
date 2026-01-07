// lib/articleStructure.ts
// Block-based article structure for live humanization

export type BlockType = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'li' | 'ul' | 'ol';

export interface ArticleBlockBase {
  id: string;          // unique ID per block
  type: BlockType;
  text: string;        // plain text, no HTML tags (may contain placeholders like [A1], [T1])
}

export interface ListBlock extends ArticleBlockBase {
  type: 'ul' | 'ol';
  items: ArticleBlockBase[]; // type 'li'
}

export type ArticleBlock = ArticleBlockBase | ListBlock;

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

/**
 * Injects anchor and trust source links into text by replacing placeholders
 * Also converts markdown-style bold (**text**) to HTML <b> tags
 */
export function injectAnchorsIntoText(
  text: string, 
  anchors: AnchorSpec[], 
  trusts: TrustSourceSpec[]
): string {
  let result = text;

  // Replace anchor placeholders [A1], [A2], etc.
  anchors.forEach(a => {
    const placeholder = `[${a.id}]`;
    const anchorHtml = `<b><a href="${a.url}">${a.text}</a></b>`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), anchorHtml);
  });

  // Replace trust source placeholders [T1], [T2], etc.
  trusts.forEach(t => {
    const placeholder = `[${t.id}]`;
    const trustHtml = `<b><a href="${t.url}">${t.text}</a></b>`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), trustHtml);
  });

  // Convert markdown-style bold (**text**) to HTML <b> tags
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  
  // Convert markdown-style italic (*text*) to HTML <i> tags (if not already bold)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');

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
  }).join('\n');
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
      const name = parts.length > 1 ? parts[0] : `Source ${index + 1}`;
      
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

