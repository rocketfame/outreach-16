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
import { cleanText, lightHumanEdit } from "@/lib/textPostProcessing";
import { getOpenAIClient, logApiKeyStatus, validateApiKeys } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";
import { 
  SEO_ARTICLE_PRESET, 
  TOPIC_DISCOVERY_PRESET, 
  applyPreset
} from "@/lib/llmPresets";

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
}

export interface ArticleResponse {
  topicTitle: string;
  titleTag: string;
  metaDescription: string;
  fullArticleText: string;
  articleBodyHtml?: string; // New field for HTML-formatted body
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

          prompt = buildDirectArticlePrompt({
            topicTitle: topic.title,
            topicBrief: topic.brief || topic.title, // Can be topic.title or custom brief from user
            niche: brief.niche || "", // Will be validated in buildDirectArticlePrompt
            mainPlatform: brief.platform || "multi-platform",
            contentPurpose: brief.contentPurpose || "Guest post / outreach",
            anchorText: brief.anchorText || "",
            anchorUrl: brief.anchorUrl || brief.clientSite || "",
            brandName: "PromosoundGroup",
            keywordList: keywordList.length > 0 ? keywordList : (topic.primaryKeyword ? [topic.primaryKeyword] : []),
            trustSourcesList: trustSourcesList,
            language: brief.language || "English",
            targetAudience: "B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms",
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

          prompt = buildArticlePrompt({
          topicTitle: topic.title,
          topicBrief: topicBrief,
          niche: brief.niche || "", // Will be validated in buildArticlePrompt
          mainPlatform: brief.platform || "multi-platform",
          anchorText: brief.anchorText || "",
          anchorUrl: brief.anchorUrl || brief.clientSite || "",
          brandName: "PromosoundGroup",
          keywordList: keywordList.length > 0 ? keywordList : (topic.primaryKeyword ? [topic.primaryKeyword] : []),
          trustSourcesList: trustSourcesList,
          language: brief.language || "English",
          targetAudience: "B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms",
          wordCount: brief.wordCount, // Pass wordCount from Project Basics (default: 1500)
        });
        }
        
        // #region agent log
        const trustSourcesLog = {location:'articles/route.ts:88',message:'Trust sources in prompt',data:{trustSourcesCount:trustSourcesList.length,trustSources:trustSourcesList.slice(0,3),hasTrustSources:trustSourcesList.length > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'trust-sources'};
        debugLog(trustSourcesLog);
        // #endregion

        // #region agent log
        const promptLog = {location:'articles/route.ts:75',message:'Article prompt built',data:{promptLength:prompt.length,topicTitle:topic.title},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
        debugLog(promptLog);
        // #endregion

        // Build system message
        const systemMessage = `You are an expert SEO Content Strategist and outreach content writer, native English speaker (US), with deep experience in social media, music marketing and creator economy. You write SEO-optimized, human-sounding articles that feel like an experienced practitioner, not AI, wrote them.

Target audience: B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms.
Brand to feature: PromosoundGroup
Goal: Create a useful, non-pushy outreach article that educates, builds trust and naturally promotes the provided link via a contextual anchor.
Language: US English.`;

        // Select preset based on mode
        const preset = isDirectMode ? SEO_ARTICLE_PRESET : TOPIC_DISCOVERY_PRESET;
        
        // Apply preset with fixed max_completion_tokens (8000 as before preset system)
        const apiParams = applyPreset(preset, { 
          max_completion_tokens: 8000
        });

        // Call OpenAI API with system + user messages
        // #region agent log
        const beforeApiLog = {
          location: 'articles/route.ts:103',
          message: 'About to call OpenAI API',
          data: {
            model: 'gpt-5.2',
            mode: isDirectMode ? 'direct' : 'topic-discovery',
            preset: isDirectMode ? 'SEO_ARTICLE' : 'TOPIC_DISCOVERY',
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
        let parsedResponse: { titleTag?: string; metaDescription?: string; articleBodyHtml?: string };
        let jsonContent = "";
        try {
          // Try to extract JSON from response (remove markdown code fences if present)
          jsonContent = content.trim();
          // Remove markdown code fences if present
          jsonContent = jsonContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          
          parsedResponse = JSON.parse(jsonContent);
          
          // Validate required fields
          if (!parsedResponse.titleTag || !parsedResponse.metaDescription || !parsedResponse.articleBodyHtml) {
            throw new Error("Missing required fields in JSON response");
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
            articleBodyHtml: content,
          };
        }

        // Post-process the article text: clean invisible chars and normalize
        let cleanedTitleTag = cleanText(parsedResponse.titleTag || topic.title);
        let cleanedMetaDescription = cleanText(parsedResponse.metaDescription || "");
        let cleanedArticleBodyHtml = cleanText(parsedResponse.articleBodyHtml || content);

        // #region agent log
        const cleaningLog = {location:'articles/route.ts:250',message:'Text cleaning applied',data:{titleTagLength:cleanedTitleTag.length,metaDescriptionLength:cleanedMetaDescription.length,articleBodyHtmlLength:cleanedArticleBodyHtml.length,originalLength:(parsedResponse.articleBodyHtml || content).length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'text-cleaning'};
        debugLog(cleaningLog);
        // #endregion

        // Optional: Light human edit for natural variation
        const enableLightHumanEdit = body.lightHumanEdit || false;
        if (enableLightHumanEdit) {
          try {
            // #region agent log
            const editStartLog = {location:'articles/route.ts:255',message:'Starting light human edit',data:{topicTitle:topic.title},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'light-human-edit'};
            debugLog(editStartLog);
            // #endregion

            cleanedArticleBodyHtml = await lightHumanEdit(cleanedArticleBodyHtml, openai, { preserveHtml: true });

            // #region agent log
            const editCompleteLog = {location:'articles/route.ts:260',message:'Light human edit completed',data:{topicTitle:topic.title,newLength:cleanedArticleBodyHtml.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'light-human-edit'};
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

