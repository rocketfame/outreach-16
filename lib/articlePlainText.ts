/**
 * Utility functions for converting HTML articles to well-structured plain text
 * for AI checkers and other text analysis tools.
 */

/**
 * Converts an HTML element to plain text while preserving structure.
 * 
 * @param root - The root HTML element containing the article
 * @returns A well-structured plain text string
 */
export function extractPlainTextFromElement(root: HTMLElement): string {
  // Clone the element to avoid modifying the original
  const clone = root.cloneNode(true) as HTMLElement;
  
  // Remove script and style elements
  const scripts = clone.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Process the clone to build plain text
  const parts: string[] = [];
  
  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      if (text) {
        parts.push(text);
      }
      return;
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    
    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    
    // Handle headings - add blank lines before and after
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      if (parts.length > 0 && parts[parts.length - 1] !== '') {
        parts.push('');
      }
      
      const headingText = getTextContent(element).trim();
      if (headingText) {
        parts.push(headingText);
        parts.push('');
      }
      return;
    }
    
    // Handle paragraphs - add blank lines before and after
    if (tagName === 'p') {
      if (parts.length > 0 && parts[parts.length - 1] !== '') {
        parts.push('');
      }
      
      const paraText = getTextContent(element).trim();
      if (paraText) {
        parts.push(paraText);
      }
      return;
    }
    
    // Handle lists
    if (tagName === 'ul' || tagName === 'ol') {
      if (parts.length > 0 && parts[parts.length - 1] !== '') {
        parts.push('');
      }
      
      const items = element.querySelectorAll('li');
      items.forEach((item, index) => {
        const itemText = getTextContent(item).trim();
        if (itemText) {
          const prefix = tagName === 'ol' ? `${index + 1}. ` : '- ';
          parts.push(prefix + itemText);
        }
      });
      
      parts.push('');
      return;
    }
    
    // Handle line breaks
    if (tagName === 'br') {
      parts.push('');
      return;
    }
    
    // Handle links - extract only the text, not the URL
    if (tagName === 'a') {
      const linkText = getTextContent(element).trim();
      if (linkText) {
        parts.push(linkText);
      }
      return;
    }
    
    // For other block elements, add spacing
    const isBlockElement = ['div', 'section', 'article'].includes(tagName);
    if (isBlockElement) {
      if (parts.length > 0 && parts[parts.length - 1] !== '') {
        parts.push('');
      }
    }
    
    // Recursively process children
    Array.from(element.childNodes).forEach(child => {
      processNode(child);
    });
    
    if (isBlockElement && parts.length > 0 && parts[parts.length - 1] !== '') {
      parts.push('');
    }
  }
  
  // Helper to get text content from an element (excluding nested block elements)
  function getTextContent(el: HTMLElement): string {
    const textParts: string[] = [];
    
    function collectText(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim() || '';
        if (text) {
          textParts.push(text);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        const tag = elem.tagName.toLowerCase();
        
        // Skip block elements when collecting inline text
        if (!['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br'].includes(tag)) {
          Array.from(elem.childNodes).forEach(collectText);
        }
      }
    }
    
    Array.from(el.childNodes).forEach(collectText);
    return textParts.join(' ');
  }
  
  // Process all nodes
  Array.from(clone.childNodes).forEach(processNode);
  
  // Join parts and clean up
  let result = parts.join('\n');
  
  // Replace \r\n with \n
  result = result.replace(/\r\n/g, '\n');
  
  // Collapse 3+ consecutive line breaks into max 2
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Collapse multiple spaces inside a line into single space
  // (but preserve spaces in numbers/URLs - this is a simple heuristic)
  result = result.split('\n').map(line => {
    // Don't collapse spaces if line looks like it might contain a URL or number pattern
    if (/https?:\/\//.test(line) || /\d+[\s-]\d+/.test(line)) {
      return line.replace(/[ \t]{2,}/g, ' '); // Only collapse 2+ spaces
    }
    return line.replace(/[ \t]+/g, ' '); // Collapse all spaces/tabs
  }).join('\n');
  
  // Trim leading and trailing whitespace
  result = result.trim();
  
  return result;
}

/**
 * Copies article as plain text to clipboard.
 * 
 * @param root - The root HTML element containing the article (or a selector string)
 * @returns Promise that resolves when copy is complete
 */
export async function copyArticleAsPlainText(root: HTMLElement | string): Promise<void> {
  let element: HTMLElement;
  
  if (typeof root === 'string') {
    const found = document.querySelector(root);
    if (!found || !(found instanceof HTMLElement)) {
      throw new Error(`Element not found: ${root}`);
    }
    element = found;
  } else {
    element = root;
  }
  
  const plainText = extractPlainTextFromElement(element);
  
  // Use modern Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(plainText);
      return;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }
  
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = plainText;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  textarea.style.top = '-999999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('execCommand copy failed');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Downloads article as a .txt file.
 * 
 * @param plainText - The plain text content
 * @param filename - Optional filename (without extension). Defaults to typereach-article-[timestamp]
 */
export function downloadArticleAsTxt(plainText: string, filename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const finalFilename = filename || `typereach-article-${timestamp}`;
  
  const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${finalFilename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

