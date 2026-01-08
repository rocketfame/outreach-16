// app/api/articles/route.ts

/**
 * ============================================================================
 * CRITICAL ARCHITECTURE DECISION - DO NOT CHANGE WITHOUT EXPLICIT APPROVAL
 * ============================================================================
 * 
 * This API endpoint handles article generation for TWO DISTINCT MODES:
 * 
 * 1. TOPIC DISCOVERY MODE
 *    - Uses: buildArticlePrompt() -> TOPIC_DISCOVERY_ARTICLE_PROMPT_TEMPLATE
 *    - Detected by: topic has detailed brief fields (shortAngle, whyNonGeneric, etc.)
 * 
 * 2. DIRECT ARTICLE CREATION MODE  
 *    - Uses: buildDirectArticlePrompt() -> DIRECT_ARTICLE_PROMPT_TEMPLATE
 *    - Detected by: absence of detailed brief fields (shortAngle, whyNonGeneric, howAnchorFits)
 *      Note: topic.brief can be topic.title OR a custom brief from the user
 * 
 * CRITICAL RULES:
 * - These two modes MUST use their respective prompt builders
 * - DO NOT merge the logic or use the wrong prompt builder
 * - Mode detection is automatic based on topic structure
 * - Do NOT modify this architecture without explicit user approval
 * 
 * ============================================================================
 */

import { buildArticlePrompt, buildDirectArticlePrompt } from "@/lib/articlePrompt";
import { cleanText, lightHumanEdit, fixHtmlTagSpacing, removeExcessiveBold } from "@/lib/textPostProcessing";
import { getOpenAIClient, logApiKeyStatus, validateApiKeys } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";
import { 
  parsePlainTextToStructure, 
  blocksToHtml, 
  modelBlocksToArticleStructure,
  ArticleStructure,
  type TableBlock,
  type TrustSourceSpec
} from "@/lib/articleStructure";
import { filterAndSelectTrustSources, TrustSourceInput } from "@/lib/trustSourceFilter";
import { humanizeSectionText } from "@/lib/sectionHumanize";
import { 
  getTrustedSourcesFromTavily, 
  type RawSearchResult,
  type TrustedSource 
} from "@/lib/sourceClassifier";

// Simple debug logger that works in both local and production (Vercel)
const debugLog = (...args: any[]) => {
  console.log("[articles-api-debug]", ...args);
};

export interface ArticleRequest {
  brief: {
    niche: string;
    platform?: string;
    contentPurpose?: string;
    clientSite?: string;
    anchorText?: string;
    anchorUrl?: string;
    language?: string;
    wordCount?: string;
  };
  selectedTopics: Array<{
    title: string;
    brief?: string;
    shortAngle?: string;
    primaryKeyword?: string;
    whyNonGeneric?: string;
    howAnchorFits?: string;
    evergreenNote?: string;
    competitionNote?: string;
  }>;
  keywordList?: string[];
  trustSourcesList?: string[];
  lightHumanEdit?: boolean; // Optional: enable light human edit post-processing
  humanizeOnWrite?: boolean; // NEW: enable live humanization during generation
  humanizeSettings?: { // Optional: humanize settings
    model: number; // 0: Quality, 1: Balance (default), 2: Enhanced
    style: string; // General, Blog, Formal, Informal, Academic, Expand, Simplify
    mode: "Basic" | "Autopilot"; // Basic or Autopilot
  };
}

export interface ArticleResponse {
  topicTitle: string;
  titleTag: string;
  metaDescription: string;
  fullArticleText: string;
  articleBodyHtml?: string; // New field for HTML-formatted body
  humanizedOnWrite?: boolean; // Flag indicating if article was humanized during generation
}

export async function POST(req: Request) {
  // #region agent log
  const logEntry = {location:'articles/route.ts:35',message:'POST /api/articles called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
  debugLog(logEntry);
  // #endregion

  // Validate all API keys using centralized configuration
  try {
    validateApiKeys();
    logApiKeyStatus();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API key validation failed:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get OpenAI client (pre-configured with validated API key)
  const openai = getOpenAIClient();

  try {
    const body: ArticleRequest = await req.json();
    const { brief, selectedTopics, keywordList = [], trustSourcesList = [] } = body;
    
    // #region agent log
    const requestLog = {
      location: 'articles/route.ts:117',
      message: 'Article request received',
      data: {
        topicsCount: selectedTopics?.length || 0,
        trustSourcesCount: trustSourcesList?.length || 0,
        humanizeOnWrite: body.humanizeOnWrite,
        humanizeSettings: body.humanizeSettings,
        lightHumanEdit: body.lightHumanEdit,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'articles-api',
      hypothesisId: 'request-received'
    };
    debugLog(requestLog);
    // #endregion

    // Validate that trust sources are provided (mandatory for article generation)
    if (!trustSourcesList || trustSourcesList.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cannot generate articles without trust sources. Trust sources are mandatory (1-3 per article). Please ensure browsing/search is working correctly." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // #region agent log
    const bodyLog = {location:'articles/route.ts:48',message:'Request body parsed',data:{topicsCount:selectedTopics.length,hasBrief:!!brief,hasKeywords:keywordList.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
    debugLog(bodyLog);
    // #endregion

    if (!selectedTopics || selectedTopics.length === 0) {
      return new Response(
        JSON.stringify({ error: "No topics selected for article generation." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const generatedArticles: ArticleResponse[] = [];

    // Generate article for each selected topic
    for (const topic of selectedTopics) {
      try {
        // Determine if this is Direct Article Creation Mode or Topic Discovery Mode
        // Direct Mode: No detailed brief fields (shortAngle, whyNonGeneric, howAnchorFits)
        // Topic Discovery Mode: topic has detailed brief fields (shortAngle, whyNonGeneric, etc.)
        // Note: topic.brief can be either topic.title OR a custom brief from the user in Direct Mode
        const isDirectMode = !topic.shortAngle && 
                             !topic.whyNonGeneric && 
                             !topic.howAnchorFits;

        // ========================================================================
        // CRITICAL: Intelligent LLM-based source classification and filtering
        // ========================================================================
        // Convert trustSourcesList from "Name|URL" or "Name|URL|Snippet" format to RawSearchResult[]
        const rawSources: RawSearchResult[] = trustSourcesList.map((source: string | any) => {
          // Support both string format ("Name|URL|Snippet") and object format
          if (typeof source === 'string') {
            const parts = source.split('|');
            return {
              url: parts.length > 1 ? parts[1] : parts[0],
              title: parts.length > 1 ? parts[0] : `Source ${trustSourcesList.indexOf(source) + 1}`,
              snippet: parts.length > 2 ? parts[2] : "",
            };
          } else {
            // Object format (for future use)
            return {
              url: source.url || "",
              title: source.title || "",
              snippet: source.snippet || "",
              content_preview: source.content_preview || source.snippet || "",
            };
          }
        });

        // Use LLM-based intelligent classification to filter and rank sources
        let trustedSources: TrustedSource[] = [];
        try {
          trustedSources = await getTrustedSourcesFromTavily(
            rawSources,
            topic.title,
            brief.niche || ""
          );
          
          // If classification returned empty, fall back to old filter
          if (trustedSources.length === 0) {
            console.warn("[articles/route] LLM classification returned no sources, falling back to old filter");
            const trustSourcesInput: TrustSourceInput[] = rawSources.map(s => ({
              title: s.title,
              url: s.url,
              snippet: s.snippet || "",
            }));
            const topicBriefForFilter = isDirectMode
              ? (topic.brief || topic.title)
              : [
                  topic.brief || "",
                  topic.shortAngle || "",
                  topic.whyNonGeneric || "",
                  topic.howAnchorFits || "",
                ].filter(Boolean).join("\n\n") || topic.title;
            const filteredTrustSources: TrustSourceSpec[] = filterAndSelectTrustSources(
              trustSourcesInput,
              brief.niche || "",
              topic.title,
              topicBriefForFilter
            );
            // Convert to TrustedSource format for compatibility
            // Use "independent_media" as default type since old filter doesn't provide classification
            trustedSources = filteredTrustSources.map(ts => ({
              id: ts.id as "T1" | "T2" | "T3",
              url: ts.url,
              title: ts.text,
              type: "independent_media" as const, // Default type for fallback (old filter doesn't provide type)
              relevance_score: 7, // Default score
            }));
          }
        } catch (error) {
          console.error("[articles/route] LLM classification failed, falling back to old filter:", error);
          // Fallback to old filter if LLM classification fails
          const trustSourcesInput: TrustSourceInput[] = rawSources.map(s => ({
            title: s.title,
            url: s.url,
            snippet: s.snippet || "",
          }));
          const topicBriefForFilter = isDirectMode
            ? (topic.brief || topic.title)
            : [
                topic.brief || "",
                topic.shortAngle || "",
                topic.whyNonGeneric || "",
                topic.howAnchorFits || "",
              ].filter(Boolean).join("\n\n") || topic.title;
          const filteredTrustSources: TrustSourceSpec[] = filterAndSelectTrustSources(
            trustSourcesInput,
            brief.niche || "",
            topic.title,
            topicBriefForFilter
          );
          // Convert to TrustedSource format for compatibility
          // Use "independent_media" as default type since old filter doesn't provide classification
          trustedSources = filteredTrustSources.map(ts => ({
            id: ts.id as "T1" | "T2" | "T3",
            url: ts.url,
            title: ts.text,
            type: "independent_media" as const, // Default type for fallback (old filter doesn't provide type)
            relevance_score: 7, // Default score
          }));
        }
        
        // Final fallback: if still no sources, use first 3 raw sources
        // This ensures we always have at least some sources to work with
        if (trustedSources.length === 0 && rawSources.length > 0) {
          console.warn("[articles/route] All filtering failed, using raw sources as final fallback");
          // #region agent log
          const fallbackLog = {
            location: 'articles/route.ts:270',
            message: 'Using raw sources fallback',
            data: {
              rawSourcesCount: rawSources.length,
              rawSources: rawSources.slice(0, 3).map(s => ({ title: s.title, url: s.url })),
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'articles-api',
            hypothesisId: 'raw-sources-fallback'
          };
          debugLog(fallbackLog);
          // #endregion
          const ids: TrustedSource["id"][] = ["T1", "T2", "T3"];
          trustedSources = rawSources.slice(0, 3).map((source, i) => ({
            id: ids[i],
            url: source.url,
            title: source.title,
            type: "independent_media" as const,
            relevance_score: 5, // Default score
          }));
        }
        
        // #region agent log
        const finalSourcesLog = {
          location: 'articles/route.ts:290',
          message: 'Final trusted sources after all filtering',
          data: {
            finalCount: trustedSources.length,
            sources: trustedSources.map(ts => ({ id: ts.id, title: ts.title, url: ts.url, type: ts.type })),
            rawSourcesCount: rawSources.length,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'articles-api',
          hypothesisId: 'final-trusted-sources'
        };
        debugLog(finalSourcesLog);
        // #endregion

        // Convert to format expected by prompt builders
        // Format: JSON array with id, url, title, type for the prompt
        const trustSourcesForPrompt = JSON.stringify(trustedSources.map(ts => ({
          id: ts.id,
          url: ts.url,
          title: ts.title,
          type: ts.type,
        })), null, 2);

        // Also keep old format for backward compatibility with prompt builders
        const filteredTrustSourcesList = trustedSources.map(ts => `${ts.title}|${ts.url}`);

        // #region agent log
        const filterLog = {
          location: 'articles/route.ts:150',
          message: 'Trust sources classified and filtered',
          data: {
            originalCount: trustSourcesList.length,
            filteredCount: trustedSources.length,
            niche: brief.niche || "",
            topicTitle: topic.title,
            trustedSources: trustedSources.map(ts => ({ id: ts.id, title: ts.title, url: ts.url, type: ts.type }))
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'articles-api',
          hypothesisId: 'trust-source-classification'
        };
        debugLog(filterLog);
        // #endregion

        let prompt: string;

        if (isDirectMode) {
          // ========================================================================
          // DIRECT ARTICLE CREATION MODE - CRITICAL: Use buildDirectArticlePrompt
          // ========================================================================
          // DO NOT use buildArticlePrompt here! This mode has its own separate prompt.
          // ========================================================================
        // #region agent log
        const promptBuildLog = {location:'articles/route.ts:94',message:'Building DIRECT article prompt',data:{topicTitle:topic.title,trustSourcesCount:trustSourcesList.length,trustSourcesPreview:trustSourcesList.slice(0,3),platform:brief.platform,mode:'direct'},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'article-prompt'};
          debugLog(promptBuildLog);
          // #endregion

          // Extract brand name from clientSite if available, otherwise use empty string (will be handled as "NONE" in prompt)
          // If clientSite is a URL, extract domain; if it's plain text, use it as-is
          const brandName = brief.clientSite 
            ? (brief.clientSite.includes("://") || (brief.clientSite.includes(".") && brief.clientSite.includes("/")))
              ? brief.clientSite.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").trim()
              : brief.clientSite.trim()
            : "";

          prompt = buildDirectArticlePrompt({
            topicTitle: topic.title,
            topicBrief: topic.brief || topic.title, // Can be topic.title or custom brief from user
            niche: brief.niche || "", // Will be validated in buildDirectArticlePrompt
            mainPlatform: brief.platform || "multi-platform",
            contentPurpose: brief.contentPurpose || "Guest post / outreach",
            anchorText: brief.anchorText || "",
            anchorUrl: brief.anchorUrl || brief.clientSite || "",
            brandName: brandName,
            keywordList: keywordList.length > 0 ? keywordList : (topic.primaryKeyword ? [topic.primaryKeyword] : []),
            trustSourcesList: filteredTrustSourcesList, // Old format for backward compatibility
            trustSourcesJSON: trustSourcesForPrompt, // New structured format with types
            trustSourcesSpecs: trustedSources.map(ts => ({ id: ts.id, text: ts.title, url: ts.url })), // Pass TrustSourceSpec[] for explicit placeholder mapping
            language: brief.language || "English",
            targetAudience: "B2C - beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms",
            wordCount: brief.wordCount, // Pass wordCount from Project Basics (default: 1500)
          });
        } else {
          // ========================================================================
          // TOPIC DISCOVERY MODE - CRITICAL: Use buildArticlePrompt
          // ========================================================================
          // DO NOT use buildDirectArticlePrompt here! This mode has its own separate prompt.
          // ========================================================================
        // Build comprehensive article brief from topic's deep brief fields
        const topicBriefParts = [
          topic.brief || "",
          topic.shortAngle ? `Short angle: ${topic.shortAngle}` : "",
          topic.whyNonGeneric ? `Why non-generic: ${topic.whyNonGeneric}` : "",
          topic.howAnchorFits ? `How anchor fits: ${topic.howAnchorFits}` : "",
          topic.evergreenNote ? `Evergreen potential: ${topic.evergreenNote}` : "",
          topic.competitionNote ? `Competition level: ${topic.competitionNote}` : "",
        ].filter(Boolean);
        
        const topicBrief = topicBriefParts.length > 0 
          ? topicBriefParts.join("\n\n")
          : topic.title;

        // #region agent log
          const promptBuildLog = {location:'articles/route.ts:94',message:'Building TOPIC DISCOVERY article prompt',data:{topicTitle:topic.title,trustSourcesCount:trustSourcesList.length,trustSourcesPreview:trustSourcesList.slice(0,3),platform:brief.platform,mode:'topic-discovery'},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'article-prompt'};
        debugLog(promptBuildLog);
        // #endregion

          // Extract brand name from clientSite if available, otherwise use empty string (will be handled as "NONE" in prompt)
          // If clientSite is a URL, extract domain; if it's plain text, use it as-is
          const brandName = brief.clientSite 
            ? (brief.clientSite.includes("://") || (brief.clientSite.includes(".") && brief.clientSite.includes("/")))
              ? brief.clientSite.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").trim()
              : brief.clientSite.trim()
            : "";

          console.log("[articles/route] Topic Discovery mode - Brand name extraction:", { clientSite: brief.clientSite, brandName });

          prompt = buildArticlePrompt({
          topicTitle: topic.title,
          topicBrief: topicBrief,
          niche: brief.niche || "", // Will be validated in buildArticlePrompt
          mainPlatform: brief.platform || "multi-platform",
          contentPurpose: brief.contentPurpose || "Guest post / outreach",
          anchorText: brief.anchorText || "",
          anchorUrl: brief.anchorUrl || brief.clientSite || "",
          brandName: brandName,
          keywordList: keywordList.length > 0 ? keywordList : (topic.primaryKeyword ? [topic.primaryKeyword] : []),
          trustSourcesList: filteredTrustSourcesList, // Old format for backward compatibility
          trustSourcesJSON: trustSourcesForPrompt, // New structured format with types
          trustSourcesSpecs: trustedSources.map(ts => ({ id: ts.id, text: ts.title, url: ts.url })), // Pass TrustSourceSpec[] for explicit placeholder mapping
          language: brief.language || "English",
          targetAudience: "B2C - beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms",
          wordCount: brief.wordCount, // Pass wordCount from Project Basics (default: 1500)
        });
        }
        
        // #region agent log
        const trustSourcesLog = {location:'articles/route.ts:88',message:'Trust sources in prompt',data:{filteredCount:trustedSources.length,filteredSources:trustedSources.map(ts => ({ id: ts.id, title: ts.title, type: ts.type })),hasTrustSources:trustedSources.length > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'trust-sources'};
        debugLog(trustSourcesLog);
        // #endregion

        // #region agent log
        const promptLog = {location:'articles/route.ts:75',message:'Article prompt built',data:{promptLength:prompt.length,topicTitle:topic.title},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
        debugLog(promptLog);
        // #endregion

        // Extract brand name for system message
        // Extract brand name from clientSite if available, otherwise use empty string
        // If clientSite is a URL, extract domain; if it's plain text, use it as-is
        const brandNameForSystem = brief.clientSite 
          ? (brief.clientSite.includes("://") || (brief.clientSite.includes(".") && brief.clientSite.includes("/")))
            ? brief.clientSite.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").trim()
            : brief.clientSite.trim()
          : "";

        // Build system message
        const systemMessage = `You are an expert SEO Content Strategist and outreach content writer, native English speaker (US), with deep experience in social media, music marketing and creator economy. You write SEO-optimized, human-sounding articles that feel like an experienced practitioner, not AI, wrote them.

Target audience: B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms.
${brandNameForSystem ? `Brand to feature: ${brandNameForSystem}` : "No specific brand to feature."}
Goal: Create a useful, non-pushy outreach article that educates, builds trust and naturally promotes the provided link via a contextual anchor.
Language: US English.`;

        // API parameters for OpenAI
        const apiParams = { 
          max_completion_tokens: 8000
        };

        // Call OpenAI API with system + user messages
        // #region agent log
        const beforeApiLog = {
          location: 'articles/route.ts:103',
          message: 'About to call OpenAI API',
          data: {
            model: 'gpt-5.2',
            mode: isDirectMode ? 'direct' : 'topic-discovery',
            hasSystemMessage: !!systemMessage,
            hasUserPrompt: !!prompt,
            promptLength: prompt.length,
            maxTokens: 8000,
            apiParams,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'articles-api',
          hypothesisId: 'articles-endpoint'
        };
        debugLog(beforeApiLog);
        // #endregion

        let completion;
        try {
          // Try with response_format first
          try {
            completion = await openai.chat.completions.create({
              model: "gpt-5.2",
              messages: [
                {
                  role: "system",
                  content: systemMessage,
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              ...apiParams,
              response_format: { type: "json_object" },
            });
          } catch (formatError: any) {
            // If response_format is not supported, try without it
            // #region agent log
            const formatErrorLog = {location:'articles/route.ts:125',message:'response_format not supported, trying without it',data:{error:(formatError as Error).message,errorCode:formatError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
            debugLog(formatErrorLog);
            // #endregion
              completion = await openai.chat.completions.create({
              model: "gpt-5.2",
                messages: [
                  {
                    role: "system",
                    content: systemMessage,
                  },
                  {
                    role: "user",
                    content: prompt,
                  },
                ],
                ...apiParams,
              });
          }
        } catch (apiError: any) {
          // #region agent log
          const apiErrorLog = {location:'articles/route.ts:150',message:'OpenAI API call failed',data:{error:(apiError as Error).message,errorName:(apiError as Error).name,errorStatus:apiError?.status,errorCode:apiError?.code,errorType:apiError?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
          debugLog(apiErrorLog);
          // #endregion
          throw apiError;
        }

        const content = completion.choices[0]?.message?.content ?? "";

        // Track cost
        const costTracker = getCostTracker();
        const usage = completion.usage as { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } } | undefined;
        const inputTokens = usage?.prompt_tokens || 0;
        const outputTokens = usage?.completion_tokens || 0;
        const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;
        console.log("[articles-api] Token usage:", { inputTokens, outputTokens, reasoningTokens, usage });
        if (inputTokens > 0 || outputTokens > 0) {
          costTracker.trackOpenAIChat('gpt-5.2', inputTokens, outputTokens);
          const totals = costTracker.getTotalCosts();
          console.log("[articles-api] Cost tracked. Current totals:", {
            tavily: totals.tavily,
            openai: totals.openai,
            total: totals.total,
          });
        } else {
          console.warn("[articles-api] No tokens to track - usage:", usage);
        }

        // Check if content is empty but we have reasoning tokens - this indicates a problem
        if (!content || content.trim().length === 0) {
          console.error("[articles-api] Empty content received from API", {
            hasReasoningTokens: reasoningTokens > 0,
            reasoningTokens,
            outputTokens,
            choicesLength: completion.choices?.length || 0,
            message: completion.choices[0]?.message,
          });
          throw new Error("Received empty content from OpenAI API. The model returned no content, only reasoning tokens.");
        }

        // #region agent log
        const apiLog = {location:'articles/route.ts:135',message:'OpenAI API success',data:{contentLength:content.length,topicTitle:topic.title,hasContent:!!content,contentPreview:content.substring(0,100),usage:{inputTokens,outputTokens,reasoningTokens}},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
        debugLog(apiLog);
        // #endregion

        // Parse JSON response
        let parsedResponse: {
          titleTag?: string;
          metaDescription?: string;
          articleBodyText?: string;
          articleBodyHtml?: string;
          articleBlocks?: unknown;
        };
        let jsonContent = "";
        try {
          // Try to extract JSON from response (remove markdown code fences if present)
          jsonContent = content.trim();
          // Remove markdown code fences if present
          jsonContent = jsonContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          
          parsedResponse = JSON.parse(jsonContent);
          
          // Validate required fields - support old (articleBodyHtml), plain text (articleBodyText), and block format (articleBlocks)
          if (!parsedResponse.titleTag || !parsedResponse.metaDescription) {
            throw new Error("Missing required fields (titleTag or metaDescription) in JSON response");
          }
          if (!parsedResponse.articleBlocks && !parsedResponse.articleBodyText && !parsedResponse.articleBodyHtml) {
            throw new Error("Missing required field (articleBlocks, articleBodyText, or articleBodyHtml) in JSON response");
          }
        } catch (parseError) {
          // #region agent log
          const parseErrorLog = {location:'articles/route.ts:150',message:'JSON parse error',data:{error:(parseError as Error).message,errorName:(parseError as Error).name,contentLength:content.length,contentPreview:content.substring(0,500),jsonContentPreview:jsonContent ? jsonContent.substring(0,500) : 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
          debugLog(parseErrorLog);
          // #endregion
          console.error("JSON parse error:", parseError);
          console.error("Content that failed to parse:", content.substring(0, 500));
          // Fallback: use topic title
          parsedResponse = {
            titleTag: topic.title,
            metaDescription: "",
            articleBodyText: content,
          };
        }

        // Post-process the article text: clean invisible chars and normalize
        let cleanedTitleTag = cleanText(parsedResponse.titleTag || topic.title);
        let cleanedMetaDescription = cleanText(parsedResponse.metaDescription || "");
        
        // Check formats: blocks (preferred), plain text, or old HTML
        const hasBlocksFormat = !!parsedResponse.articleBlocks;
        const hasNewFormat = !!parsedResponse.articleBodyText && !hasBlocksFormat;
        const hasOldFormat = !!parsedResponse.articleBodyHtml;
        
        let articleStructure: ArticleStructure | null = null;
        let cleanedArticleBodyHtml = "";
        
        // Convert trustedSources to TrustSourceSpec format for article structure
        const trustSourcesForStructure: TrustSourceSpec[] = trustedSources.map(ts => ({
          id: ts.id,
          text: ts.title, // Use title as anchor text
          url: ts.url,
        }));

        if (hasBlocksFormat) {
          // BLOCK FORMAT (preferred): deterministic structure -> HTML
          // Use trusted sources (convert to "Name|URL" format for backward compatibility)
          const trustSourcesListForStructure = trustedSources.map(ts => `${ts.title}|${ts.url}`);
          articleStructure = modelBlocksToArticleStructure(
            parsedResponse.articleBlocks,
            cleanedTitleTag,
            cleanedMetaDescription,
            brief.anchorText,
            brief.anchorUrl || brief.clientSite || "",
            trustSourcesListForStructure
          );
          // Override trustSources with trusted ones (to ensure correct anchor text)
          articleStructure.trustSources = trustSourcesForStructure;
        } else if (hasNewFormat) {
          // PLAIN TEXT FORMAT (fallback): heuristic parsing -> blocks -> HTML
          const articleBodyText = cleanText(parsedResponse.articleBodyText || "");
          // Use trusted sources (convert to "Name|URL" format for backward compatibility)
          const trustSourcesListForStructure = trustedSources.map(ts => `${ts.title}|${ts.url}`);
          articleStructure = parsePlainTextToStructure(
            articleBodyText,
            cleanedTitleTag,
            cleanedMetaDescription,
            brief.anchorText,
            brief.anchorUrl || brief.clientSite || "",
            trustSourcesListForStructure
          );
          // Override trustSources with trusted ones (to ensure correct anchor text)
          articleStructure.trustSources = trustSourcesForStructure;
        }

        if (articleStructure) {
          // Clean invisible characters from all block text (regardless of humanization)
          // This removes AI-generated hidden Unicode characters from GPT output
          articleStructure.blocks = articleStructure.blocks.map(block => {
            if (block.type === 'ul' || block.type === 'ol') {
              const listBlock = block as any;
              return {
                ...listBlock,
                items: (listBlock.items || []).map((item: any) => ({
                  ...item,
                  text: cleanText(item.text || '')
                }))
              };
            }
            if (block.type === 'table') {
              const t = block as TableBlock;
              return {
                ...t,
                caption: t.caption ? cleanText(t.caption) : undefined,
                headers: (t.headers || []).map(h => cleanText(h)),
                rows: (t.rows || []).map(row => row.map(cell => cleanText(cell)))
              };
            }
            return {
              ...block,
              text: cleanText(block.text || '')
            };
          });

          // Apply humanization on write if enabled
          const enableHumanizeOnWrite = body.humanizeOnWrite || false;
          let totalHumanizeWordsUsed = 0;

          // #region agent log
          const humanizeCheckLog = {
            location: 'articles/route.ts:647',
            message: 'Humanization check',
            data: {
              enableHumanizeOnWrite,
              bodyHumanizeOnWrite: body.humanizeOnWrite,
              hasArticleStructure: !!articleStructure,
              blocksCount: articleStructure?.blocks?.length || 0,
              humanizeSettings: body.humanizeSettings,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'articles-api',
            hypothesisId: 'humanization-check'
          };
          debugLog(humanizeCheckLog);
          // #endregion

          if (enableHumanizeOnWrite) {
            const registeredEmail = process.env.NEXT_PUBLIC_AIHUMANIZE_EMAIL || "";
            const apiKey = process.env.AIHUMANIZE_API_KEY || "";
            const frozenPlaceholders = ["[A1]", "[T1]", "[T2]", "[T3]"];
            
            // Get humanize settings from request (default: Balance model)
            const humanizeModel = body.humanizeSettings?.model ?? 1; // Default: Balance (1)
            const humanizeStyle = body.humanizeSettings?.style; // Optional: Writing style
            const humanizeMode = body.humanizeSettings?.mode; // Optional: Basic or Autopilot

            // #region agent log
            const humanizeConfigLog = {
              location: 'articles/route.ts:660',
              message: 'Humanization configuration',
              data: {
                hasEmail: !!registeredEmail,
                emailPrefix: registeredEmail ? registeredEmail.substring(0, 3) + "***" : "none",
                hasApiKey: !!apiKey,
                apiKeyPrefix: apiKey ? apiKey.substring(0, 5) + "***" : "none",
                humanizeModel,
                humanizeStyle,
                humanizeMode,
                blocksToHumanize: articleStructure?.blocks?.length || 0,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'articles-api',
              hypothesisId: 'humanization-config'
            };
            debugLog(humanizeConfigLog);
            // #endregion
            
            // Validate email and API key before proceeding
            if (!registeredEmail) {
              console.error("[articles-api] NEXT_PUBLIC_AIHUMANIZE_EMAIL is not set in environment variables");
              throw new Error("AIHumanize email is not configured. Please set NEXT_PUBLIC_AIHUMANIZE_EMAIL in .env.local");
            }
            
            if (!apiKey) {
              console.error("[articles-api] AIHUMANIZE_API_KEY is not set in environment variables");
              throw new Error("AIHumanize API key is not configured. Please set AIHUMANIZE_API_KEY in .env.local");
            }

            if (registeredEmail && apiKey) {
              try {
                const humanizedBlocks = await Promise.all(
                  articleStructure.blocks.map(async (block) => {
                    // Lists: humanize each item
                    if (block.type === 'ul' || block.type === 'ol') {
                      const listBlock = block as any;
                      let listWordsUsed = 0;
                      const humanizedItems = await Promise.all(
                        (listBlock.items || []).map(async (item: any) => {
                          if (!item?.text || item.text.length < 100) return item;
                          try {
                            // Clean invisible characters BEFORE humanization
                            const cleanedText = cleanText(item.text);
                            const result = await humanizeSectionText(cleanedText, humanizeModel, registeredEmail, frozenPlaceholders, humanizeStyle, humanizeMode);
                            listWordsUsed += result.wordsUsed;
                            // Clean invisible characters AFTER humanization (in case API returns them)
                            const finalText = cleanText(result.humanizedText);
                            return { ...item, text: finalText };
                          } catch {
                            return item;
                          }
                        })
                      );
                      totalHumanizeWordsUsed += listWordsUsed;
                      return { ...listBlock, items: humanizedItems };
                    }

                    // Tables: humanize long cell text (and caption if long)
                    if (block.type === 'table') {
                      const t = block as TableBlock;
                      let tableWordsUsed = 0;

                      let caption = t.caption;
                      if (caption && caption.length >= 100) {
                        try {
                          // Clean invisible characters BEFORE humanization
                          const cleanedCaption = cleanText(caption);
                          const result = await humanizeSectionText(cleanedCaption, humanizeModel, registeredEmail, frozenPlaceholders, humanizeStyle, humanizeMode);
                          // Clean invisible characters AFTER humanization
                          caption = cleanText(result.humanizedText);
                          tableWordsUsed += result.wordsUsed;
                        } catch {
                          // keep original
                        }
                      }

                      const rows = t.rows || [];
                      const humanizedRows = await Promise.all(
                        rows.map(async (row) => {
                          const cells = Array.isArray(row) ? row : [];
                          const humanizedCells = await Promise.all(
                            cells.map(async (cell) => {
                              if (!cell || cell.length < 100) return cell;
                              try {
                                // Clean invisible characters BEFORE humanization
                                const cleanedCell = cleanText(cell);
                                const result = await humanizeSectionText(cleanedCell, humanizeModel, registeredEmail, frozenPlaceholders, humanizeStyle, humanizeMode);
                                tableWordsUsed += result.wordsUsed;
                                // Clean invisible characters AFTER humanization
                                return cleanText(result.humanizedText);
                              } catch {
                                return cell;
                              }
                            })
                          );
                          return humanizedCells;
                        })
                      );

                      totalHumanizeWordsUsed += tableWordsUsed;
                      return { ...t, caption, rows: humanizedRows };
                    }

                    // Headings: don't humanize
                    if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3' || block.type === 'h4') {
                      return block;
                    }

                    // Paragraphs: humanize if long enough
                    if (!block.text || block.text.length < 100) return block;
                    try {
                      // Clean invisible characters BEFORE humanization
                      const cleanedText = cleanText(block.text);
                      const result = await humanizeSectionText(cleanedText, humanizeModel, registeredEmail, frozenPlaceholders, humanizeStyle, humanizeMode);
                      totalHumanizeWordsUsed += result.wordsUsed;
                      // Clean invisible characters AFTER humanization (in case API returns them)
                      const finalText = cleanText(result.humanizedText);
                      return { ...block, text: finalText };
                    } catch {
                      return block;
                    }
                  })
                );

                // Check if any blocks were actually humanized (not all failed)
                const anyHumanized = totalHumanizeWordsUsed > 0 || humanizedBlocks.some((block, i) => {
                  const original = articleStructure.blocks[i];
                  if (!original) return false;
                  // Compare text for paragraphs
                  if (block.text !== original.text) return true;
                  // Compare items for lists
                  if ((block.type === 'ul' || block.type === 'ol') && (original.type === 'ul' || original.type === 'ol')) {
                    const blockItems = (block as any).items || [];
                    const originalItems = (original as any).items || [];
                    return JSON.stringify(blockItems) !== JSON.stringify(originalItems);
                  }
                  // Compare rows for tables
                  if (block.type === 'table' && original.type === 'table') {
                    const blockRows = (block as any).rows || [];
                    const originalRows = (original as any).rows || [];
                    return JSON.stringify(blockRows) !== JSON.stringify(originalRows);
                  }
                  return false;
                });

                articleStructure.blocks = humanizedBlocks;
                articleStructure.humanizedOnWrite = anyHumanized; // Only mark as humanized if at least one block was changed

                // #region agent log
                const humanizeResultLog = {
                  location: 'articles/route.ts:845',
                  message: 'Humanization result',
                  data: {
                    totalWordsUsed: totalHumanizeWordsUsed,
                    blocksHumanized: humanizedBlocks.length,
                    anyHumanized,
                    originalBlocksCount: articleStructure.blocks.length,
                  },
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'articles-api',
                  hypothesisId: 'humanization-result'
                };
                debugLog(humanizeResultLog);
                // #endregion

                if (totalHumanizeWordsUsed > 0) {
                  const costTracker = getCostTracker();
                  const humanizeCost = totalHumanizeWordsUsed * 0.0005;
                  costTracker.trackHumanize(totalHumanizeWordsUsed, humanizeCost);
                } else if (enableHumanizeOnWrite) {
                  // Log warning if humanization was enabled but no words were used
                  console.warn('[articles-api] Humanization was enabled but no words were processed. This may indicate API errors (e.g., insufficient balance) or all blocks were too short.');
                }
                // #region agent log
                const humanizeSuccessLog = {
                  location: 'articles/route.ts:794',
                  message: 'Humanization completed successfully',
                  data: {
                    totalWordsUsed: totalHumanizeWordsUsed,
                    blocksHumanized: humanizedBlocks.length,
                    originalBlocksCount: articleStructure.blocks.length,
                  },
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'articles-api',
                  hypothesisId: 'humanization-success'
                };
                debugLog(humanizeSuccessLog);
                // #endregion

                if (totalHumanizeWordsUsed > 0) {
                  const costTracker = getCostTracker();
                  const humanizeCost = totalHumanizeWordsUsed * 0.0005;
                  costTracker.trackHumanize(totalHumanizeWordsUsed, humanizeCost);
                }
              } catch (humanizeError) {
                // #region agent log
                const humanizeErrorLog = {
                  location: 'articles/route.ts:802',
                  message: 'Humanization on write failed',
                  data: {
                    error: (humanizeError as Error).message,
                    errorName: (humanizeError as Error).name,
                    stack: (humanizeError as Error).stack?.substring(0, 500),
                  },
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'articles-api',
                  hypothesisId: 'humanization-error'
                };
                debugLog(humanizeErrorLog);
                // #endregion
                console.error('[articles-api] Humanization on write failed:', humanizeError);
              }
            } else {
              // #region agent log
              const humanizeConfigErrorLog = {
                location: 'articles/route.ts:805',
                message: 'Humanization requested but not configured',
                data: {
                  hasEmail: !!registeredEmail,
                  hasApiKey: !!apiKey,
                  enableHumanizeOnWrite,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'articles-api',
                hypothesisId: 'humanization-config-error'
              };
              debugLog(humanizeConfigErrorLog);
              // #endregion
              console.warn('[articles-api] Humanization on write requested but API key or email not configured');
            }
          } else {
            // #region agent log
            const humanizeDisabledLog = {
              location: 'articles/route.ts:650',
              message: 'Humanization disabled',
              data: {
                enableHumanizeOnWrite,
                bodyHumanizeOnWrite: body.humanizeOnWrite,
                hasArticleStructure: !!articleStructure,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'articles-api',
              hypothesisId: 'humanization-disabled'
            };
            debugLog(humanizeDisabledLog);
            // #endregion
          }

          // ========================================================================
          // VALIDATION: Check trust source placeholder usage
          // ========================================================================
          if (articleStructure.trustSources.length > 0) {
            // Count how many [T1]/[T2]/[T3] placeholders were actually used in the article text
            const allText = articleStructure.blocks
              .map(block => {
                if (block.type === 'ul' || block.type === 'ol') {
                  return (block as any).items?.map((item: any) => item.text || '').join(' ') || '';
                }
                if (block.type === 'table') {
                  const t = block as any;
                  return [
                    t.caption || '',
                    ...(t.headers || []),
                    ...(t.rows || []).flat()
                  ].join(' ');
                }
                return block.text || '';
              })
              .join(' ');
            
            const placeholderMatches = allText.match(/\[T[1-3]\]/g) || [];
            const uniquePlaceholders = new Set(placeholderMatches);
            const placeholderCount = uniquePlaceholders.size;
            
            // Validate: must have 1-3 placeholders if trustSources.length > 0
            if (placeholderCount === 0 && articleStructure.trustSources.length > 0) {
              console.warn(`[articles-api] No trust source placeholders found in article for topic: ${topic.title}. Expected 1-${articleStructure.trustSources.length} placeholders.`);
            } else if (placeholderCount > articleStructure.trustSources.length) {
              console.warn(`[articles-api] More placeholders (${placeholderCount}) than trust sources (${articleStructure.trustSources.length}) for topic: ${topic.title}.`);
            }
            
            // Validate: every placeholder must have a corresponding entry in trustSources
            const usedPlaceholderIds = Array.from(uniquePlaceholders).map(p => p.replace(/[\[\]]/g, ''));
            const validPlaceholderIds = articleStructure.trustSources.map(ts => ts.id);
            const invalidPlaceholders = usedPlaceholderIds.filter(id => !validPlaceholderIds.includes(id));
            
            if (invalidPlaceholders.length > 0) {
              console.warn(`[articles-api] Invalid placeholders found: ${invalidPlaceholders.join(', ')}. These will be removed or left as plain text.`);
              // Remove invalid placeholders from text (optional: can be done in post-processing)
            }
            
            // #region agent log
            const validationLog = {
              location: 'articles/route.ts:670',
              message: 'Trust source placeholder validation',
              data: {
                trustSourcesCount: articleStructure.trustSources.length,
                placeholderCount,
                uniquePlaceholders: Array.from(uniquePlaceholders),
                usedPlaceholderIds,
                validPlaceholderIds,
                invalidPlaceholders
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'articles-api',
              hypothesisId: 'trust-source-validation'
            };
            debugLog(validationLog);
            // #endregion
          }

          // Convert blocks to HTML, fix spacing around tags, remove excessive bold, then clean invisible characters
          cleanedArticleBodyHtml = cleanText(
            removeExcessiveBold(
              fixHtmlTagSpacing(
                blocksToHtml(
                  articleStructure.blocks,
                  articleStructure.anchors,
                  articleStructure.trustSources
                )
              )
            )
          );
        } else if (hasOldFormat) {
          // OLD FORMAT: Use existing HTML processing
          cleanedArticleBodyHtml = cleanText(
            removeExcessiveBold(
              fixHtmlTagSpacing(parsedResponse.articleBodyHtml || content)
            )
          );
        } else {
          // Fallback: use raw content
          cleanedArticleBodyHtml = cleanText(
            removeExcessiveBold(
              fixHtmlTagSpacing(content)
            )
          );
        }

        // #region agent log
        const cleaningLog = {location:'articles/route.ts:250',message:'Text cleaning applied',data:{titleTagLength:cleanedTitleTag.length,metaDescriptionLength:cleanedMetaDescription.length,articleBodyHtmlLength:cleanedArticleBodyHtml.length,originalLength:(parsedResponse.articleBodyHtml || content).length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'text-cleaning'};
        debugLog(cleaningLog);
        // #endregion

        // Optional: Light human edit for natural variation
        // NOTE: Only apply to old format (HTML). New format uses humanizeOnWrite instead.
        const enableLightHumanEdit = body.lightHumanEdit || false;
        if (enableLightHumanEdit && !hasNewFormat) {
          try {
            // #region agent log
            const editStartLog = {location:'articles/route.ts:255',message:'Starting light human edit',data:{topicTitle:topic.title},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'light-human-edit'};
            debugLog(editStartLog);
            // #endregion

            cleanedArticleBodyHtml = await lightHumanEdit(cleanedArticleBodyHtml, openai, { preserveHtml: true });

            // CRITICAL: Clean text again after Light Human Edit
            // GPT-5.2 can re-introduce em-dashes, smart quotes, and other AI indicators during rewrite
            // Also fix spacing around HTML tags that might have been lost during processing
            // Remove excessive bold formatting that might have been introduced
            cleanedArticleBodyHtml = cleanText(
              removeExcessiveBold(
                fixHtmlTagSpacing(cleanedArticleBodyHtml)
              )
            );

            // #region agent log
            const editCompleteLog = {location:'articles/route.ts:260',message:'Light human edit completed and re-cleaned',data:{topicTitle:topic.title,newLength:cleanedArticleBodyHtml.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'light-human-edit'};
            debugLog(editCompleteLog);
            // #endregion
          } catch (editError) {
            // #region agent log
            const editErrorLog = {location:'articles/route.ts:265',message:'Light human edit failed, using cleaned text',data:{error:(editError as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'light-human-edit'};
            debugLog(editErrorLog);
            // #endregion
            console.error('[articles-api] Light human edit failed:', editError);
            // Continue with cleaned text if edit fails
          }
        } else if (enableLightHumanEdit && hasNewFormat) {
          console.log('[articles-api] Light human edit skipped for new format (using humanizeOnWrite instead)');
        }

        const articleResponse = {
          topicTitle: topic.title,
          titleTag: cleanedTitleTag,
          metaDescription: cleanedMetaDescription,
          fullArticleText: cleanedArticleBodyHtml, // Keep for backward compatibility
          articleBodyHtml: cleanedArticleBodyHtml,
        };
        
        // #region agent log
        const articleHtml = articleResponse.articleBodyHtml || '';
        const hasTrustSourceLinks = /<a\s+href=["'][^"']+["']>[^<]*(Social Blade|Tubular Labs|Think Media|VidIQ|YouTube|Hootsuite|Sprout Social)[^<]*<\/a>/gi.test(articleHtml);
        const trustSourceLinkCount = (articleHtml.match(/<a\s+href=["'][^"']+["']>/gi) || []).length;
        const responseLog = {location:'articles/route.ts:280',message:'Article response prepared',data:{topicTitle:topic.title,hasTitleTag:!!parsedResponse.titleTag,hasMetaDescription:!!parsedResponse.metaDescription,articleBodyHtmlLength:articleHtml.length,hasH1Prefix:/H1:\s*/gi.test(articleHtml),hasH2Prefix:/H2:\s*/gi.test(articleHtml),hasH3Prefix:/H3:\s*/gi.test(articleHtml),hasTrustSourceLinks,trustSourceLinkCount,totalLinksCount:trustSourceLinkCount,lightHumanEditEnabled:enableLightHumanEdit,preview:articleHtml.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'html-format'};
        debugLog(responseLog);
        // #endregion
        
        generatedArticles.push(articleResponse);

        // Small delay between requests to avoid rate limiting
        if (selectedTopics.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        // #region agent log
        const topicErrorLog = {location:'articles/route.ts:175',message:'Error generating article for topic',data:{topicTitle:topic.title,error:(error as Error).message,errorName:(error as Error).name,errorStack:(error as Error).stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
        debugLog(topicErrorLog);
        // #endregion
        console.error(`Error generating article for topic ${topic.title}:`, error);
        // Continue with other topics even if one fails
      }
    }

    // #region agent log
    const successLog = {location:'articles/route.ts:140',message:'Articles generation completed',data:{articlesCount:generatedArticles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
    debugLog(successLog);
    // #endregion

    return new Response(
      JSON.stringify({ articles: generatedArticles }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    // #region agent log
    const errorLog = {location:'articles/route.ts:147',message:'Articles generation error',data:{error:(err as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
    debugLog(errorLog);
    // #endregion
    console.error("Article generation error", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate articles" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

