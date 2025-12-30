/**
 * LLM Parameter Presets for different use cases
 * 
 * These presets optimize quality, repeatability, and cost for different tasks.
 * Based on best practices for GPT-5.2 model.
 */

export interface LLMPreset {
  temperature: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_completion_tokens?: number;
  stop_sequences?: string[];
}

/**
 * SEO Article Generation (Direct Article Creation)
 * 
 * Goals: Predictability, minimal fluff, proper keywords, structured output
 * Use for: Production SEO articles, category pages, landing pages
 */
export const SEO_ARTICLE_PRESET: LLMPreset = {
  temperature: 0.25, // Low for predictable, structured content
  top_p: 0.9,
  frequency_penalty: 0.4, // Reduces tautology and keyword repetition
  presence_penalty: 0.1, // Minimal push to new topics
  stop_sequences: ['</article>', '</body>', '}]}'], // Prevent overflow
};

/**
 * Topic Discovery Article Generation
 * 
 * Goals: More creativity, exploratory ideas, but controlled structure
 * Use for: Idea articles, briefs, exploratory content
 */
export const TOPIC_DISCOVERY_PRESET: LLMPreset = {
  temperature: 0.6, // Balanced for ideas + structure
  top_p: 0.9,
  frequency_penalty: 0.3, // Moderate reduction of repetition
  presence_penalty: 0.5, // Encourages new angles/formats
  stop_sequences: ['\n\n###', '</article>'], // Limit heading count
};

/**
 * Topic Generation (Cluster Discovery)
 * 
 * Goals: Creative topic ideas, diverse suggestions
 * Use for: Generating topic clusters, brainstorming
 */
export const TOPIC_GENERATION_PRESET: LLMPreset = {
  temperature: 0.7, // Higher for more creative ideas
  top_p: 0.95,
  frequency_penalty: 0.2, // Light penalty
  presence_penalty: 0.4, // Encourages diversity
};

/**
 * Article Editing (Direct Article Assistant)
 * 
 * Goals: Variability in formulations without losing meaning
 * Use for: Editing existing articles, adding images/links
 */
export const ARTICLE_EDIT_PRESET: LLMPreset = {
  temperature: 0.7,
  top_p: 0.9,
  frequency_penalty: 0.3,
  presence_penalty: 0.2,
  max_completion_tokens: 8000, // Allow for longer articles
};

/**
 * Humanize Pass 1: Restructure/Outline
 * 
 * Goals: Controlled restructuring, preserve meaning
 */
export const HUMANIZE_PASS_1_PRESET: LLMPreset = {
  temperature: 0.4, // Controlled variation
  top_p: 0.9,
  frequency_penalty: 0.2,
  presence_penalty: 0.1,
};

/**
 * Humanize Pass 2: Rewrite with variations
 * 
 * Goals: More natural flow, different word choices, break patterns
 */
export const HUMANIZE_PASS_2_PRESET: LLMPreset = {
  temperature: 0.75, // Higher for more variation
  top_p: 0.95,
  frequency_penalty: 0.6, // Strong penalty to break patterns
  presence_penalty: 0.4,
};

/**
 * Humanize Pass 3: Clean-up / Brand tone
 * 
 * Goals: Final polish, consistent style
 */
export const HUMANIZE_PASS_3_PRESET: LLMPreset = {
  temperature: 0.25, // Low for consistency
  top_p: 0.9,
  frequency_penalty: 0.1, // Minimal
  presence_penalty: 0.1,
};

/**
 * Style Analysis (Reference Image Analysis)
 * 
 * Goals: Precise, detailed style extraction
 * Use for: Analyzing reference image styles
 */
export const STYLE_ANALYSIS_PRESET: LLMPreset = {
  temperature: 0.3, // Low for precise analysis
  top_p: 1.0,
  max_completion_tokens: 2000, // Detailed descriptions
};

/**
 * Meta Snippet Generation (Titles, Descriptions)
 * 
 * Goals: Concise, keyword-rich, controlled length
 * Use for: Title tags, meta descriptions, OG tags
 */
export const META_SNIPPET_PRESET: LLMPreset = {
  temperature: 0.3, // Low for consistency
  top_p: 0.9,
  frequency_penalty: 0.3,
  presence_penalty: 0.2,
  // max_completion_tokens calculated based on target length
};

/**
 * Calculate max_completion_tokens based on word count
 * 
 * Formula: ~1.3 tokens per word (English) + 5% buffer
 */
export function calculateMaxTokens(wordCount: number | string): number {
  const count = typeof wordCount === 'string' ? parseInt(wordCount) || 1500 : wordCount;
  const baseTokens = Math.ceil(count * 1.3);
  const buffer = Math.ceil(baseTokens * 0.05); // 5% buffer
  return baseTokens + buffer;
}

/**
 * Apply preset to OpenAI API call parameters
 * 
 * Returns a clean object with only defined parameters
 */
export function applyPreset(preset: LLMPreset, overrides?: Partial<LLMPreset>): {
  temperature: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_completion_tokens?: number;
  stop?: string[];
} {
  const merged = { ...preset, ...overrides };
  const result: any = {
    temperature: merged.temperature,
  };
  
  if (merged.top_p !== undefined) result.top_p = merged.top_p;
  if (merged.frequency_penalty !== undefined) result.frequency_penalty = merged.frequency_penalty;
  if (merged.presence_penalty !== undefined) result.presence_penalty = merged.presence_penalty;
  if (merged.max_completion_tokens !== undefined) result.max_completion_tokens = merged.max_completion_tokens;
  if (merged.stop_sequences && merged.stop_sequences.length > 0) result.stop = merged.stop_sequences;
  
  return result;
}

