/**
 * Utility functions for protecting and restoring anchors/links during humanization
 */

export interface ProtectedChunk {
  token: string;
  html: string;
  type: 'anchor' | 'phrase';
}

/**
 * Extracts and protects all anchor tags from HTML, replacing them with tokens
 */
export function protectAnchors(html: string): { protectedHtml: string; chunks: ProtectedChunk[] } {
  const chunks: ProtectedChunk[] = [];
  let protectedHtml = html;
  let anchorIndex = 0;

  // Match all <a> tags (including nested content)
  const anchorRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  
  protectedHtml = protectedHtml.replace(anchorRegex, (match, href, text) => {
    anchorIndex++;
    const token = `[[ANCHOR_${anchorIndex}]]`;
    
    chunks.push({
      token,
      html: match, // Full <a> tag with all attributes
      type: 'anchor'
    });
    
    return token;
  });

  return { protectedHtml, chunks };
}

/**
 * Protects frozen phrases (brand names, exact anchor texts) in plain text
 */
export function protectFrozenPhrases(
  text: string,
  frozenPhrases: string[]
): { protectedText: string; chunks: ProtectedChunk[] } {
  const chunks: ProtectedChunk[] = [];
  let protectedText = text;
  let phraseIndex = 0;

  for (const phrase of frozenPhrases) {
    if (!phrase || phrase.trim().length === 0) continue;
    
    // Escape special regex characters
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phraseRegex = new RegExp(escapedPhrase, 'gi');
    
    protectedText = protectedText.replace(phraseRegex, (match) => {
      phraseIndex++;
      const token = `[[PHRASE_${phraseIndex}]]`;
      
      chunks.push({
        token,
        html: match, // Original phrase text
        type: 'phrase'
      });
      
      return token;
    });
  }

  return { protectedText, chunks };
}

/**
 * Converts HTML to plain text suitable for AIHumanize
 * Preserves paragraph structure with double newlines
 */
export function htmlToPlainText(html: string): string {
  // Replace closing paragraph tags with double newline
  let text = html.replace(/<\/p>/gi, '\n\n');
  
  // Replace closing heading tags with double newline
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  
  // Replace list item endings with single newline
  text = text.replace(/<\/li>/gi, '\n');
  
  // Replace <br> and <br/> with single newline
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Normalize multiple newlines to max 2
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace
  text = text.trim();
  
  return text;
}

/**
 * Restores protected chunks (anchors and phrases) back into humanized text
 */
export function restoreProtectedChunks(
  text: string,
  chunks: ProtectedChunk[]
): string {
  let result = text;
  
  // Sort chunks by token index (descending) to avoid token collision
  const sortedChunks = [...chunks].sort((a, b) => {
    const aMatch = a.token.match(/\d+/);
    const bMatch = b.token.match(/\d+/);
    const aNum = aMatch ? parseInt(aMatch[0], 10) : 0;
    const bNum = bMatch ? parseInt(bMatch[0], 10) : 0;
    return bNum - aNum; // Descending order
  });
  
  for (const chunk of sortedChunks) {
    // Escape brackets for regex
    const tokenRegex = new RegExp(chunk.token.replace(/[[\]]/g, '\\$&'), 'g');
    result = result.replace(tokenRegex, chunk.html);
  }
  
  return result;
}

/**
 * Converts plain text back to HTML structure
 * Wraps paragraphs and preserves structure
 */
export function plainTextToHtml(text: string): string {
  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/);
  
  const htmlParagraphs = paragraphs.map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    
    // Check if it looks like a heading (short, no punctuation, or starts with #)
    if (trimmed.length < 100 && /^#+\s/.test(trimmed)) {
      const level = (trimmed.match(/^#+/) || [''])[0].length;
      const content = trimmed.replace(/^#+\s+/, '').trim();
      return `<h${Math.min(level, 6)}>${content}</h${Math.min(level, 6)}>`;
    }
    
    // Check if it's a list item (starts with - or number)
    if (/^[-•*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const items = trimmed.split(/\n(?=[-•*]|\d+\.)/).map(item => {
        const cleanItem = item.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
        return `<li>${cleanItem}</li>`;
      }).join('\n');
      return `<ul>${items}</ul>`;
    }
    
    // Regular paragraph
    // Split by single newlines within paragraph and join with <br>
    const lines = trimmed.split('\n').map(line => line.trim()).filter(line => line);
    return `<p>${lines.join('<br>')}</p>`;
  }).filter(p => p.length > 0);
  
  return htmlParagraphs.join('\n');
}

/**
 * Represents a structured HTML block with its tag and content
 */
interface HtmlBlock {
  tag: string; // h1, h2, h3, p, ul, ol, li
  fullTag: string; // Full tag with attributes, e.g., <h2 class="...">
  content: string; // Text content inside the tag
  isListContainer: boolean; // true for ul/ol
  listItems?: HtmlBlock[]; // For ul/ol, contains li blocks
}

/**
 * Parses HTML into structured blocks preserving hierarchy
 * Uses a stack-based approach to handle nested elements correctly
 */
function parseHtmlIntoBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  
  // First, extract all block-level elements in order
  // Match opening tags for h1-h6, p, ul, ol
  const topLevelRegex = /<(h[1-6]|p|ul|ol)([^>]*)>/gi;
  const matches: Array<{ tag: string; attrs: string; start: number }> = [];
  let match;
  
  while ((match = topLevelRegex.exec(html)) !== null) {
    matches.push({
      tag: match[1].toLowerCase(),
      attrs: match[2],
      start: match.index
    });
  }
  
  // Process each top-level block
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const tag = current.tag;
    const fullTag = `<${tag}${current.attrs}>`;
    const tagStart = current.start;
    
    // Find the matching closing tag
    const closingTag = `</${tag}>`;
    let depth = 1;
    let pos = tagStart + fullTag.length;
    let contentEnd = -1;
    
    while (pos < html.length && depth > 0) {
      const nextOpen = html.indexOf(`<${tag}`, pos);
      const nextClose = html.indexOf(closingTag, pos);
      
      if (nextClose === -1) break;
      
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + tag.length + 1;
      } else {
        depth--;
        if (depth === 0) {
          contentEnd = nextClose;
          break;
        }
        pos = nextClose + closingTag.length;
      }
    }
    
    if (contentEnd === -1) {
      // No closing tag found, skip
      continue;
    }
    
    const content = html.substring(tagStart + fullTag.length, contentEnd);
    
    if (tag === 'ul' || tag === 'ol') {
      // Parse list items within this list
      const listItems: HtmlBlock[] = [];
      const liRegex = /<li([^>]*)>([\s\S]*?)<\/li>/gi;
      let liMatch;
      
      while ((liMatch = liRegex.exec(content)) !== null) {
        listItems.push({
          tag: 'li',
          fullTag: `<li${liMatch[1]}>`,
          content: liMatch[2],
          isListContainer: false
        });
      }
      
      blocks.push({
        tag,
        fullTag,
        content,
        isListContainer: true,
        listItems
      });
    } else {
      blocks.push({
        tag,
        fullTag,
        content,
        isListContainer: false
      });
    }
  }
  
  return blocks;
}

/**
 * Main function: prepares HTML for humanization by protecting anchors and converting to plain text
 * Now preserves structure by processing blocks separately
 */
export function prepareForHumanization(
  html: string,
  frozenPhrases: string[] = []
): { textForHumanize: string; chunks: ProtectedChunk[]; originalHtml: string; structure: HtmlBlock[] } {
  // Step 1: Parse HTML into structured blocks
  const structure = parseHtmlIntoBlocks(html);
  
  // Step 2: Process each block: protect anchors, extract text
  const allChunks: ProtectedChunk[] = [];
  const textBlocks: string[] = [];
  
  for (const block of structure) {
    if (block.isListContainer && block.listItems && block.listItems.length > 0) {
      // Process list items separately
      for (const li of block.listItems) {
        // Protect anchors in list item
        const { protectedHtml: liProtected, chunks: liChunks } = protectAnchors(li.content);
        allChunks.push(...liChunks);
        
        // Extract plain text (remove HTML tags, keep only text)
        let liText = liProtected.replace(/<[^>]+>/g, '').trim();
        liText = liText
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        
        // Protect frozen phrases
        const { protectedText: liProtectedText, chunks: liPhraseChunks } = protectFrozenPhrases(liText, frozenPhrases);
        allChunks.push(...liPhraseChunks);
        
        // Add as a separate block with marker
        textBlocks.push(`[[BLOCK:li]]${liProtectedText}`);
      }
    } else {
      // Protect anchors in block content
      const { protectedHtml: blockProtected, chunks: blockChunks } = protectAnchors(block.content);
      allChunks.push(...blockChunks);
      
      // Extract plain text (remove HTML tags, keep only text)
      let blockText = blockProtected.replace(/<[^>]+>/g, '').trim();
      blockText = blockText
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      // Protect frozen phrases
      const { protectedText: blockProtectedText, chunks: blockPhraseChunks } = protectFrozenPhrases(blockText, frozenPhrases);
      allChunks.push(...blockPhraseChunks);
      
      // Add block marker to preserve structure
      textBlocks.push(`[[BLOCK:${block.tag}]]${blockProtectedText}`);
    }
  }
  
  // Join blocks with double newline to preserve separation
  const textForHumanize = textBlocks.join('\n\n');
  
  return {
    textForHumanize,
    chunks: allChunks,
    originalHtml: html,
    structure
  };
}

/**
 * Main function: restores humanized text back to HTML with all anchors intact
 * Preserves original HTML structure by mapping humanized text back to structured blocks
 */
export function restoreFromHumanization(
  humanizedText: string,
  chunks: ProtectedChunk[],
  originalHtml?: string,
  structure?: HtmlBlock[]
): string {
  // Step 1: Restore all protected chunks (anchors and phrases)
  let restored = restoreProtectedChunks(humanizedText, chunks);
  
  // Step 2: If we have structure, restore it
  if (structure && structure.length > 0) {
    // Split humanized text by block markers
    const blockMarkerRegex = /\[\[BLOCK:(\w+)\]\]/g;
    const blocks: Array<{ tag: string; text: string }> = [];
    
    // Find all markers first
    const markers: Array<{ tag: string; index: number; length: number }> = [];
    let match;
    while ((match = blockMarkerRegex.exec(restored)) !== null) {
      markers.push({
        tag: match[1],
        index: match.index,
        length: match[0].length
      });
    }
    
    // Extract text for each block
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const textStart = marker.index + marker.length;
      const textEnd = i < markers.length - 1 ? markers[i + 1].index : restored.length;
      const text = restored.substring(textStart, textEnd).trim();
      
      blocks.push({ tag: marker.tag, text });
    }
    
    // Map blocks back to structure
    if (blocks.length > 0) {
      let result = '';
      let blockIndex = 0;
      
      for (const originalBlock of structure) {
        if (originalBlock.isListContainer && originalBlock.listItems && originalBlock.listItems.length > 0) {
          // Reconstruct list
          result += originalBlock.fullTag;
          
          // Get list items from humanized blocks (all consecutive li blocks)
          const listItemBlocks: Array<{ tag: string; text: string }> = [];
          let liCount = 0;
          while (blockIndex + liCount < blocks.length && blocks[blockIndex + liCount].tag === 'li') {
            listItemBlocks.push(blocks[blockIndex + liCount]);
            liCount++;
          }
          
          // Use humanized items if available, otherwise use original
          for (let i = 0; i < originalBlock.listItems.length; i++) {
            const li = originalBlock.listItems[i];
            const humanizedText = listItemBlocks[i]?.text?.trim() || '';
            // If humanized text is empty, use original content
            const finalText = humanizedText || li.content.replace(/<[^>]+>/g, '').trim() || li.content;
            result += `<li>${finalText}</li>`;
          }
          
          blockIndex += listItemBlocks.length;
          result += `</${originalBlock.tag}>\n\n`;
        } else {
          // Regular block (h1-h6, p)
          if (blockIndex < blocks.length) {
            const humanizedBlock = blocks[blockIndex];
            // Match by tag type
            if (humanizedBlock && humanizedBlock.tag === originalBlock.tag) {
              const humanizedText = humanizedBlock.text.trim();
              const finalText = humanizedText || originalBlock.content.replace(/<[^>]+>/g, '').trim() || originalBlock.content;
              result += `${originalBlock.fullTag}${finalText}</${originalBlock.tag}>\n\n`;
              blockIndex++;
            } else {
              // Try to find matching tag in remaining blocks
              const matchingIndex = blocks.findIndex((b, idx) => idx >= blockIndex && b.tag === originalBlock.tag);
              if (matchingIndex !== -1) {
                const matchingBlock = blocks[matchingIndex];
                const humanizedText = matchingBlock.text.trim();
                const finalText = humanizedText || originalBlock.content.replace(/<[^>]+>/g, '').trim() || originalBlock.content;
                result += `${originalBlock.fullTag}${finalText}</${originalBlock.tag}>\n\n`;
                blockIndex = matchingIndex + 1;
              } else {
                // Fallback: use original content
                result += `${originalBlock.fullTag}${originalBlock.content}</${originalBlock.tag}>\n\n`;
              }
            }
          } else {
            // No more humanized blocks, use original
            result += `${originalBlock.fullTag}${originalBlock.content}</${originalBlock.tag}>\n\n`;
          }
        }
      }
      
      return result.trim();
    }
  }
  
  // Fallback: If no structure or mapping failed, try simple restoration
  if (originalHtml) {
    // Try to extract and map by paragraph count
    const originalBlocks: Array<{ tag: string; text: string }> = [];
    const blockRegex = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    
    while ((match = blockRegex.exec(originalHtml)) !== null) {
      const tag = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      if (text.length > 0) {
        originalBlocks.push({ tag, text });
      }
    }
    
    if (originalBlocks.length > 0) {
      const humanizedParagraphs = restored.split(/\n\n+/).filter(p => p.trim().length > 0);
      
      if (humanizedParagraphs.length === originalBlocks.length) {
        let result = '';
        for (let i = 0; i < originalBlocks.length; i++) {
          const block = originalBlocks[i];
          const humanizedText = humanizedParagraphs[i].trim();
          
          if (block.tag.startsWith('h')) {
            result += `<${block.tag}>${humanizedText}</${block.tag}>\n\n`;
          } else if (block.tag === 'li') {
            result += `<li>${humanizedText}</li>\n`;
          } else {
            result += `<p>${humanizedText}</p>\n\n`;
          }
        }
        return result.trim();
      }
    }
  }
  
  // Final fallback: Convert plain text to HTML structure
  if (!restored.includes('<')) {
    restored = plainTextToHtml(restored);
  }
  
  return restored;
}

