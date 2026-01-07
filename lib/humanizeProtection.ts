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
 * Main function: prepares HTML for humanization by protecting anchors and converting to plain text
 */
export function prepareForHumanization(
  html: string,
  frozenPhrases: string[] = []
): { textForHumanize: string; chunks: ProtectedChunk[]; originalHtml: string } {
  // Step 1: Protect all anchor tags
  const { protectedHtml, chunks: anchorChunks } = protectAnchors(html);
  
  // Step 2: Convert to plain text
  let plainText = htmlToPlainText(protectedHtml);
  
  // Step 3: Protect frozen phrases in plain text
  const { protectedText, chunks: phraseChunks } = protectFrozenPhrases(plainText, frozenPhrases);
  
  // Combine all chunks
  const allChunks = [...anchorChunks, ...phraseChunks];
  
  return {
    textForHumanize: protectedText,
    chunks: allChunks,
    originalHtml: html // Keep original HTML for structure preservation
  };
}

/**
 * Main function: restores humanized text back to HTML with all anchors intact
 * Tries to preserve original HTML structure by mapping humanized paragraphs back to original structure
 */
export function restoreFromHumanization(
  humanizedText: string,
  chunks: ProtectedChunk[],
  originalHtml?: string
): string {
  // Step 1: Restore all protected chunks (anchors and phrases)
  let restored = restoreProtectedChunks(humanizedText, chunks);
  
  // Step 2: If we have original HTML, try to preserve structure
  if (originalHtml) {
    // Extract text blocks from original HTML (preserving structure markers)
    const originalBlocks: Array<{ tag: string; text: string }> = [];
    const blockRegex = /<(h[1-6]|p|li|div)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    
    while ((match = blockRegex.exec(originalHtml)) !== null) {
      const tag = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim(); // Remove nested tags for comparison
      if (text.length > 0) {
        originalBlocks.push({ tag, text });
      }
    }
    
    // If we found structure blocks, try to map humanized text back
    if (originalBlocks.length > 0) {
      const humanizedParagraphs = restored.split(/\n\n+/).filter(p => p.trim().length > 0);
      
      // Simple mapping: if counts match, map in order
      if (humanizedParagraphs.length === originalBlocks.length) {
        let result = '';
        for (let i = 0; i < originalBlocks.length; i++) {
          const block = originalBlocks[i];
          const humanizedText = humanizedParagraphs[i].trim();
          
          // Wrap in original tag
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
  
  // Fallback: Convert plain text to HTML structure
  if (!restored.includes('<')) {
    restored = plainTextToHtml(restored);
  }
  
  return restored;
}

