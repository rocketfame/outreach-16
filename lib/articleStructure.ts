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
    const anchorHtml = `<a href="${a.url}">${a.text}</a>`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), anchorHtml);
  });

  // Replace trust source placeholders [T1], [T2], etc.
  trusts.forEach(t => {
    const placeholder = `[${t.id}]`;
    const trustHtml = `<a href="${t.url}">${t.text}</a>`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), trustHtml);
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
 * Splits section text into ArticleBlocks
 */
export function sectionTextToBlocks(
  sectionText: string, 
  sectionMeta: { level: 'h2' | 'h3' }
): ArticleBlock[] {
  const paragraphs = sectionText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  const blocks: ArticleBlock[] = [];

  // First block – heading
  blocks.push({
    id: crypto.randomUUID(),
    type: sectionMeta.level,
    text: paragraphs[0]
  });

  // Rest – paragraphs
  for (let i = 1; i < paragraphs.length; i++) {
    // Check if this looks like a list item (starts with - or 1. etc.)
    const trimmed = paragraphs[i].trim();
    if (trimmed.match(/^[-•]\s/) || trimmed.match(/^\d+\.\s/)) {
      // This is a list item - for now, treat as paragraph
      // TODO: implement proper list parsing if needed
    }
    
    blocks.push({
      id: crypto.randomUUID(),
      type: 'p',
      text: paragraphs[i]
    });
  }

  return blocks;
}

