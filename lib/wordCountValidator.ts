// lib/wordCountValidator.ts

/**
 * Utility functions for word count validation and trimming
 */

/**
 * Counts words in plain text (excluding HTML tags)
 */
export function countWords(text: string): number {
  if (!text) return 0;
  
  // Remove HTML tags
  let textWithoutHtml = text.replace(/<[^>]*>/g, ' ');
  
  // Remove placeholders like [T1], [A1] (they don't count as words)
  textWithoutHtml = textWithoutHtml.replace(/\[[A-Z0-9]+\]/g, '');
  
  // Decode HTML entities to get accurate word count
  textWithoutHtml = textWithoutHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Split by whitespace and filter out empty strings
  const words = textWithoutHtml
    .split(/\s+/)
    .filter(word => word.trim().length > 0);
  
  return words.length;
}

/**
 * Counts words across all blocks in an article structure
 */
export function countWordsInArticleStructure(blocks: any[]): number {
  let totalWords = 0;
  
  for (const block of blocks) {
    if (block.type === 'ul' || block.type === 'ol') {
      // Count words in list items
      const items = block.items || [];
      for (const item of items) {
        totalWords += countWords(item.text || '');
      }
    } else if (block.type === 'table') {
      // Count words in table caption, headers, and cells
      if (block.caption) {
        totalWords += countWords(block.caption);
      }
      const headers = block.headers || [];
      for (const header of headers) {
        totalWords += countWords(header);
      }
      const rows = block.rows || [];
      for (const row of rows) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            totalWords += countWords(cell);
          }
        }
      }
    } else {
      // Regular text blocks (h1, h2, h3, h4, p)
      totalWords += countWords(block.text || '');
    }
  }
  
  return totalWords;
}

/**
 * Trims article blocks to target word count (removes blocks from the end)
 * Preserves structure: keeps H1, first few paragraphs, and maintains list/table integrity
 */
export function trimArticleToWordCount(
  blocks: any[],
  targetWordCount: number,
  tolerancePercent: number = 10
): any[] {
  const currentWordCount = countWordsInArticleStructure(blocks);
  const maxAllowed = Math.floor(targetWordCount * (1 + tolerancePercent / 100));
  
  // If within tolerance, return as-is
  if (currentWordCount <= maxAllowed) {
    return blocks;
  }
  
  // Calculate how many words to remove
  const wordsToRemove = currentWordCount - maxAllowed;
  
  // Start from the end and remove blocks until we're within target
  const trimmedBlocks = [...blocks];
  let removedWords = 0;
  
  // Always keep H1 (first block)
  // Work backwards from the end
  for (let i = trimmedBlocks.length - 1; i > 0 && removedWords < wordsToRemove; i--) {
    const block = trimmedBlocks[i];
    let blockWordCount = 0;
    
    if (block.type === 'ul' || block.type === 'ol') {
      const items = block.items || [];
      for (const item of items) {
        blockWordCount += countWords(item.text || '');
      }
    } else if (block.type === 'table') {
      if (block.caption) {
        blockWordCount += countWords(block.caption);
      }
      const headers = block.headers || [];
      for (const header of headers) {
        blockWordCount += countWords(header);
      }
      const rows = block.rows || [];
      for (const row of rows) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            blockWordCount += countWords(cell);
          }
        }
      }
    } else {
      blockWordCount = countWords(block.text || '');
    }
    
    // If removing this block would get us close to target, remove it
    if (removedWords + blockWordCount <= wordsToRemove + 50) { // +50 for some buffer
      removedWords += blockWordCount;
      trimmedBlocks.splice(i, 1);
    } else {
      // Try to trim partial content from this block
      if (block.type === 'p' && block.text) {
        const words = block.text.split(/\s+/);
        const targetWordsInBlock = blockWordCount - (wordsToRemove - removedWords);
        if (targetWordsInBlock > 0 && targetWordsInBlock < words.length) {
          block.text = words.slice(0, targetWordsInBlock).join(' ') + '...';
          removedWords += (words.length - targetWordsInBlock);
        }
      }
      break;
    }
  }
  
  return trimmedBlocks;
}

/**
 * Validates word count and returns validation result
 */
export interface WordCountValidationResult {
  isValid: boolean;
  currentWordCount: number;
  targetWordCount: number;
  minAllowed: number;
  maxAllowed: number;
  difference: number;
  differencePercent: number;
  needsTrimming: boolean;
}

export function validateWordCount(
  blocks: any[],
  targetWordCount: number,
  tolerancePercent: number = 10
): WordCountValidationResult {
  const currentWordCount = countWordsInArticleStructure(blocks);
  const minAllowed = Math.floor(targetWordCount * (1 - tolerancePercent / 100));
  const maxAllowed = Math.floor(targetWordCount * (1 + tolerancePercent / 100));
  
  const isValid = currentWordCount >= minAllowed && currentWordCount <= maxAllowed;
  const difference = currentWordCount - targetWordCount;
  const differencePercent = targetWordCount > 0 
    ? (difference / targetWordCount) * 100 
    : 0;
  const needsTrimming = currentWordCount > maxAllowed;
  
  return {
    isValid,
    currentWordCount,
    targetWordCount,
    minAllowed,
    maxAllowed,
    difference,
    differencePercent,
    needsTrimming
  };
}

