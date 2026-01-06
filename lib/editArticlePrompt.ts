// lib/editArticlePrompt.ts

export interface EditHistoryEntry {
  timestamp: string;
  editRequest: string;
  summary: string;
}

export interface BuildEditArticlePromptParams {
  currentArticleHtml: string;
  articleTitle: string;
  editRequest: string;
  niche: string;
  language: string;
  trustSourcesList: string[];
  editHistory: EditHistoryEntry[];
}

const EDIT_ARTICLE_PROMPT_TEMPLATE = `
You are editing an existing article for the music industry. Your task is to modify the article according to the edit request while maintaining professional quality, natural writing style, and preserving the article's overall structure and flow.

================================
CONTEXT
================================

• Niche: [[NICHE]]
• Article Title: [[ARTICLE_TITLE]]
• Language: [[LANGUAGE]]

================================
CURRENT ARTICLE
================================

Here is the current article HTML:

[[CURRENT_ARTICLE_HTML]]

================================
EDIT REQUEST
================================

[[EDIT_REQUEST]]

================================
EDIT HISTORY
================================

[[EDIT_HISTORY]]

================================
TRUST SOURCES LIST
================================

[[TRUST_SOURCES_LIST]]

These are pre-validated external sources from Tavily search API. Use ONLY these URLs when adding or updating external links. Each item is in format "Name|URL".

CRITICAL RULES FOR SOURCES:
- You MUST use ONLY URLs from [[TRUST_SOURCES_LIST]]
- NEVER invent, guess, or create new sources, guides, portals, brand names, or URLs
- If a source is NOT present in [[TRUST_SOURCES_LIST]], you MUST NOT mention it, link to it, or reference it
- Before using ANY source, verify that its EXACT URL appears in [[TRUST_SOURCES_LIST]]
- If you cannot find a relevant source in [[TRUST_SOURCES_LIST]], do not add external links

================================
EDITING INSTRUCTIONS
================================

1. PRESERVE EXISTING STRUCTURE:
   - Keep the same HTML structure (h1, h2, h3, p, ul, ol, etc.)
   - Maintain the same heading hierarchy
   - Preserve existing links and anchor texts unless the edit request specifically asks to change them
   - Keep the same overall article flow and organization

2. APPLY THE EDIT REQUEST:
   - Follow the edit request [[EDIT_REQUEST]] precisely
   - Make only the changes requested - do not add unnecessary modifications
   - If the edit request asks to add content, integrate it naturally into the existing structure
   - If the edit request asks to remove content, remove it cleanly without leaving gaps
   - If the edit request asks to modify content, update it while maintaining the same tone and style

3. MAINTAIN QUALITY:
   - Keep the same professional, natural writing style
   - Preserve the article's tone and voice
   - Ensure all changes flow naturally with the existing content
   - Do not introduce inconsistencies or contradictions
   - Maintain proper HTML formatting

4. EXTERNAL SOURCES:
   - If adding new external links, use ONLY sources from [[TRUST_SOURCES_LIST]]
   - Format links as: <b><a href="EXACT_URL_FROM_LIST" target="_blank" rel="noopener noreferrer">short natural anchor</a></b>
   - Use short, natural anchor text (2-5 words maximum)
   - Integrate links naturally into sentences
   - Never use full URLs as anchor text

5. CHARACTER RULES (MANDATORY - prevents AI-detection):
   - NEVER use em-dash (—) or en-dash (–). Use ONLY regular hyphen "-"
   - NEVER use smart quotes (" " or ' '). Use ONLY standard straight quotes (" " and ' ')
   - NEVER use ellipsis character (…). Use three dots "..." instead
   - NEVER use zero-width spaces, non-breaking spaces, or any invisible Unicode characters
   - Use ONLY standard ASCII punctuation characters

6. OUTPUT FORMAT:
   - Return ONLY the edited article HTML
   - Do NOT include any explanations, notes, or comments
   - Do NOT wrap the output in markdown code fences or JSON
   - Return pure HTML that can be directly inserted into the article
   - Ensure all HTML tags are properly closed
   - Maintain proper indentation and formatting

================================
FINAL CHECKLIST
================================

Before outputting:
- [ ] Edit request has been fully addressed
- [ ] Existing article structure is preserved
- [ ] All HTML tags are properly formatted
- [ ] No em-dash, en-dash, smart quotes, or hidden Unicode characters
- [ ] All external links (if any) are from [[TRUST_SOURCES_LIST]]
- [ ] Anchor texts are short and natural (2-5 words)
- [ ] Changes flow naturally with existing content
- [ ] Output is pure HTML with no markdown or JSON wrapper

Now return ONLY the edited article HTML:
`.trim();

export function buildEditArticlePrompt(params: BuildEditArticlePromptParams): string {
  let prompt = EDIT_ARTICLE_PROMPT_TEMPLATE;

  // Replace placeholders
  prompt = prompt.replaceAll("[[NICHE]]", params.niche);
  prompt = prompt.replaceAll("[[ARTICLE_TITLE]]", params.articleTitle);
  prompt = prompt.replaceAll("[[LANGUAGE]]", params.language);
  prompt = prompt.replaceAll("[[CURRENT_ARTICLE_HTML]]", params.currentArticleHtml);
  prompt = prompt.replaceAll("[[EDIT_REQUEST]]", params.editRequest);

  // Format edit history
  let editHistoryText = "No previous edits.";
  if (params.editHistory && params.editHistory.length > 0) {
    editHistoryText = params.editHistory
      .map((entry, index) => {
        return `Edit #${index + 1} (${entry.timestamp}):\nRequest: ${entry.editRequest}\nSummary: ${entry.summary || "N/A"}`;
      })
      .join("\n\n");
  }
  prompt = prompt.replaceAll("[[EDIT_HISTORY]]", editHistoryText);

  // Format trust sources list
  let trustSourcesText = "No external sources provided.";
  if (params.trustSourcesList && params.trustSourcesList.length > 0) {
    trustSourcesText = params.trustSourcesList
      .map((source, index) => `${index + 1}. ${source}`)
      .join("\n");
  }
  prompt = prompt.replaceAll("[[TRUST_SOURCES_LIST]]", trustSourcesText);

  return prompt;
}
