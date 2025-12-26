// lib/editArticlePrompt.ts

export interface EditHistoryEntry {
  timestamp: string;
  editRequest: string;
  summary: string;
}

export interface EditArticleParams {
  currentArticleHtml: string;
  articleTitle: string;
  editRequest: string;
  niche: string;
  language: string;
  trustSourcesList: string[];
  editHistory?: EditHistoryEntry[];
}

const EDIT_ARTICLE_PROMPT_TEMPLATE = `
You are an expert content editor with deep analytical capabilities. You understand context, structure, and user intent at a professional level.

Your approach: Think comprehensively, analyze deeply, execute precisely.

Context:
• Niche: [[NICHE]]
• Article Title: [[ARTICLE_TITLE]]
• Language: [[LANGUAGE]]
• Current Article: [[CURRENT_ARTICLE_HTML]]

Previous Edit History:
[[EDIT_HISTORY]]

Current Editorial Request:
[[EDIT_REQUEST]]

Available Resources:
[[TRUST_SOURCES_LIST]]

CRITICAL: COMPREHENSIVE ANALYSIS AND INTELLIGENT EXECUTION

1. DEEP STRUCTURAL ANALYSIS (MANDATORY FIRST STEP):
   - Read and analyze the ENTIRE article structure - every section, every heading, every list
   - Identify ALL sections: H2 headings, H3 subsections, lists, paragraphs
   - Map out the complete article structure mentally before making any changes
   - Understand the article's organization: how content is grouped, what sections exist, what's in each section
   - If the article has "North America", "Europe", "Global" sections → you MUST work across ALL of them
   - If the article has numbered lists → understand how many items are in each list
   - Think: "What is the complete structure? What sections need attention? What's missing?"
   - This analysis is MANDATORY - never skip it

2. INTELLIGENT INSTRUCTION UNDERSTANDING:
   - Read the edit request carefully and understand the COMPLETE scope
   - If user says "add images" → understand: add to ALL relevant sections, not just one
   - If user says "add links" → understand: where do they belong in the structure?
   - If user says "modify content" → understand: what exactly needs to change?
   - If user mentions specific items (festivals, events, etc.) → understand: are they in one section or multiple?
   - Never assume the request applies to only one section - analyze the FULL article scope
   - Think: "Does this apply to the entire article? All sections? All items?"

3. COMPREHENSIVE EXECUTION:
   - Work systematically through the ENTIRE article structure
   - If adding images: go through EACH section, EACH item, ensure complete coverage
   - If adding links: identify ALL places where links should appear
   - If modifying content: understand how changes affect the entire article
   - Never work on just one section and stop - complete the task across the entire article
   - Think: "Have I covered everything? All sections? All items?"

4. ACCURACY AND PRECISION:
   - When matching content (images, links, text) to items:
     * If text mentions "Tomorrowland" → match EXACTLY to Tomorrowland, not another festival
     * If text mentions "Ultra" → match EXACTLY to Ultra, not another festival
     * Verify matches by checking names, titles, URLs - exact correspondence is required
   - When working with images:
     * Match image title/description to the EXACT item mentioned in text
     * If you cannot find an exact match, skip it silently - never use a wrong match
     * NEVER add text notes or messages about missing images - just skip them
     * Ensure source diversity - different domains for different images
     * The article must contain ONLY actual content - no technical notes or explanations
   - When working with links:
     * Match links to the correct items/sections
     * Use official sources when requested
     * Verify URLs are valid and correct

5. PRESERVE EXISTING CONTENT:
   - NEVER delete or remove existing content unless explicitly asked
   - ALL previous edits (from [[EDIT_HISTORY]]) are already in the article - preserve them
   - When adding new content, add it WITHOUT removing existing content
   - The article grows incrementally - each edit builds on previous ones
   - Maintain all HTML structure, formatting, and existing elements

6. PROFESSIONAL QUALITY STANDARDS:
   - Use standard ASCII punctuation (no em-dash, smart quotes, ellipsis character)
   - Keep natural, human-written style
   - Ensure all HTML tags are properly closed
   - Validate all URLs before using them
   - Check for consistency and flow across the entire article

TECHNICAL REQUIREMENTS:

1. IMAGE HANDLING (when images are requested):
   - Images in [[TRUST_SOURCES_LIST]] format: "Title|Image URL|Source URL"
   - Use Image URL as src, Source URL for figcaption link
   - Validate URLs: only use http:// or https:// URLs that look like valid images
   - EXACT MATCHING: Image title/description MUST match the EXACT item mentioned in text
   - COMPLETE COVERAGE: Add images to ALL relevant sections, not just one
   - Distribute evenly: one image per item if user requests "for each" or "evenly"
   - Source diversity: don't use multiple images from the same domain
   - Format: <figure><img src="..." alt="..." /><figcaption>Image source: <a href="..." target="_blank" rel="noopener noreferrer">...</a></figcaption></figure>
   - 🚨 CRITICAL: If an image is not available for an item, simply skip it - DO NOT add any text notes, messages, or explanations
   - 🚨 CRITICAL: NEVER add text like "Photo note:", "verified image was not included", "image not found", or any similar messages
   - 🚨 CRITICAL: The article must contain ONLY actual content - if you can't add an image, just leave the item without an image, silently

2. LINK HANDLING (when links are requested):
   - Use sources from [[TRUST_SOURCES_LIST]] when available
   - If user asks for "official sites" → prioritize official domains
   - If user asks for "social media" → prioritize social media sources
   - Format: <b><a href="URL" target="_blank" rel="noopener noreferrer">short anchor</a></b>
   - Integrate links naturally within sentences
   - Use short anchor text (2-5 words), never full URLs

3. CONTENT MODIFICATIONS:
   - Understand what needs to change and why
   - Make changes while preserving all other content
   - Ensure modifications are consistent across the article
   - Maintain article flow and readability

4. OUTPUT FORMAT:
   - Return ONLY the complete edited article HTML
   - Include ALL sections from the original article
   - Include ALL content from previous edits
   - Add new content as requested
   - Use proper HTML tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <b>, <a>, <figure>, <img>, <figcaption>
   - No JSON wrapper, no explanations, just the HTML
   - 🚨 CRITICAL: NEVER add notes, messages, or explanations in the article content
   - 🚨 CRITICAL: If an image is not available, simply skip it - DO NOT add text like "Photo note: image not found" or "verified image was not included"
   - 🚨 CRITICAL: The article must contain ONLY actual content - no technical messages, no notes, no explanations
   - If you cannot add an image for an item, just leave it without an image - do not add any text about it

WORKFLOW (follow systematically):

1. ANALYZE: Read the entire article, understand its complete structure, identify all sections
2. UNDERSTAND: Read the edit request carefully, understand the full scope and requirements
3. PLAN: Map out what needs to be done across the entire article structure
4. EXECUTE: Work systematically through all relevant sections, ensuring complete coverage
5. VERIFY: Check that the task is complete across the entire article, all sections are covered, all matches are accurate

Remember: You are a professional editor. You think comprehensively, analyze deeply, and execute precisely. You work on the ENTIRE article scope, not just one section. You understand structure, context, and requirements at a professional level.

Now, analyze the article structure, understand the request, and execute the edit comprehensively across the entire article.
`;

export function buildEditArticlePrompt(params: EditArticleParams): string {
  let prompt = EDIT_ARTICLE_PROMPT_TEMPLATE;

  // Replace placeholders
  prompt = prompt.replaceAll("[[NICHE]]", params.niche || "");
  prompt = prompt.replaceAll("[[ARTICLE_TITLE]]", params.articleTitle || "Article");
  prompt = prompt.replaceAll("[[LANGUAGE]]", params.language || "English");
  prompt = prompt.replaceAll("[[CURRENT_ARTICLE_HTML]]", params.currentArticleHtml || "");
  prompt = prompt.replaceAll("[[EDIT_REQUEST]]", params.editRequest.trim());

  // Format edit history
  let editHistoryFormatted = "No previous edits.";
  if (params.editHistory && params.editHistory.length > 0) {
    editHistoryFormatted = params.editHistory
      .map((entry, index) => {
        return `${index + 1}. [${entry.timestamp}] ${entry.editRequest}\n   Summary: ${entry.summary}`;
      })
      .join("\n\n");
  }
  prompt = prompt.replaceAll("[[EDIT_HISTORY]]", editHistoryFormatted);

  // Format trust sources list
  const imageSources: string[] = [];
  const regularSources: string[] = [];

  params.trustSourcesList.forEach((source) => {
    if (source.includes("|") && source.split("|").length >= 3) {
      // Image format: "Title|Image URL|Source URL"
      imageSources.push(source);
    } else {
      // Regular source format: "Name|URL"
      regularSources.push(source);
    }
  });

  let trustSourcesFormatted = "";
  
  if (imageSources.length > 0) {
    trustSourcesFormatted += `AVAILABLE IMAGES (found via Tavily web browsing):\n${imageSources.map((s, i) => {
      const parts = s.split('|');
      return `${i + 1}. Title: "${parts[0] || 'Image'}"\n   Image URL: ${parts[1] || ''}\n   Source URL: ${parts[2] || ''}`;
    }).join('\n\n')}\n\n`;
  }
  
  if (regularSources.length > 0) {
    trustSourcesFormatted += `AVAILABLE SOURCES (for links):\n${regularSources.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
  }
  
  if (params.trustSourcesList.length === 0) {
    trustSourcesFormatted = "No additional sources available.";
  }

  // Add intelligent guidance based on available resources
  let sourcesGuidance = "";
  
  if (imageSources.length > 0) {
    sourcesGuidance += `\n\nIMAGES AVAILABLE:\n- You have ${imageSources.length} image(s) found via Tavily browsing\n- These are real images from the web (social media, official sites, news, etc.)\n- CRITICAL: Match images EXACTLY to items mentioned in text (e.g., "Tomorrowland" image for "Tomorrowland" text)\n- CRITICAL: Add images to ALL relevant sections of the article, not just one section\n- Distribute evenly if user requested "for each" or "evenly"\n- Validate URLs before using (must be http:// or https://)\n- Ensure source diversity (don't use multiple images from same domain)\n- If you cannot find an exact match, DO NOT use a wrong image - skip it silently (no text notes or messages)\n- 🚨 CRITICAL: NEVER add text notes or messages in the article about missing images - just skip them\n`;
  }
  
  if (regularSources.length > 0) {
    sourcesGuidance += `\n\nSOURCES AVAILABLE:\n- You have ${regularSources.length} source(s) for links\n- Use them when adding links as requested\n- Prioritize based on user's specific instructions (official sites, social media, etc.)\n`;
  }

  prompt = prompt.replaceAll("[[TRUST_SOURCES_LIST]]", trustSourcesFormatted + sourcesGuidance);

  return prompt;
}
