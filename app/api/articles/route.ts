// app/api/articles/route.ts

import OpenAI from "openai";
import { buildArticlePrompt, buildDirectBriefPrompt, buildRewritePrompt } from "@/lib/articlePrompt";
import { cleanText, lightHumanEdit } from "@/lib/textPostProcessing";

// Simple debug logger that works in both local and production (Vercel)
const debugLog = (...args: any[]) => {
  console.log("[articles-api-debug]", ...args);
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type GenerationMode = "topics" | "directBrief" | "rewrite";

export interface ArticleRequest {
  mode?: GenerationMode; // Defaults to "topics" for backward compatibility
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
  selectedTopics?: Array<{
    title: string;
    brief?: string;
    shortAngle?: string;
    primaryKeyword?: string;
    whyNonGeneric?: string;
    howAnchorFits?: string;
    evergreenNote?: string;
    competitionNote?: string;
  }>;
  // For directBrief mode
  clientBrief?: string;
  articleSettings?: {
    nicheOrIndustry?: string;
    brandName?: string;
    anchorKeyword?: string;
    targetWordCount?: number;
    writingStyle?: string;
  };
  // For rewrite mode
  originalArticle?: string;
  rewriteParams?: {
    niche?: string;
    brandName?: string;
    anchorKeyword?: string;
    targetWordCount?: number;
    style?: string;
  };
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
  // Safe debug log for OpenAI API key (only prefix, never full key)
  console.log(
    "OPENAI_API_KEY prefix in runtime:",
    (process.env.OPENAI_API_KEY || "undefined").slice(0, 10)
  );

  // #region agent log
  const logEntry = {location:'articles/route.ts:35',message:'POST /api/articles called',data:{hasApiKey:!!process.env.OPENAI_API_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
  debugLog(logEntry);
  // #endregion

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Critical validation: OpenAI key must start with "sk-" (not Tavily key "tvly-")
  if (!openaiApiKey.startsWith("sk-")) {
    const keyPrefix = openaiApiKey.slice(0, 10);
    console.error(`OPENAI_API_KEY has invalid prefix: ${keyPrefix}. OpenAI keys must start with "sk-". This might be a Tavily key (tvly-) mistakenly set as OPENAI_API_KEY.`);
    return new Response(
      JSON.stringify({ 
        error: `Invalid OPENAI_API_KEY format. OpenAI keys must start with "sk-", but got prefix "${keyPrefix}". Please check your Vercel Environment Variables - you might have set TAVILY_API_KEY value as OPENAI_API_KEY.` 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body: ArticleRequest = await req.json();
    const { 
      mode = "topics", // Default to "topics" for backward compatibility
      brief, 
      selectedTopics = [], 
      keywordList = [], 
      trustSourcesList = [],
      clientBrief,
      articleSettings,
      originalArticle,
      rewriteParams,
    } = body;

    // Validate mode-specific requirements
    if (mode === "directBrief") {
      if (!clientBrief || clientBrief.trim().length < 50) {
        return new Response(
          JSON.stringify({ error: "Client brief is required and must be at least 50 characters." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else if (mode === "rewrite") {
      if (!originalArticle || originalArticle.trim().length < 100) {
        return new Response(
          JSON.stringify({ error: "Original article is required and must be at least 100 characters." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // Mode "topics" - original flow
      if (!selectedTopics || selectedTopics.length === 0) {
        return new Response(
          JSON.stringify({ error: "No topics selected for article generation." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Validate that trust sources are provided (mandatory for article generation, except rewrite mode)
    if (mode !== "rewrite" && (!trustSourcesList || trustSourcesList.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Cannot generate articles without trust sources. Trust sources are mandatory (1-3 per article). Please ensure browsing/search is working correctly." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // #region agent log
    const bodyLog = {location:'articles/route.ts:48',message:'Request body parsed',data:{mode,topicsCount:selectedTopics.length,hasBrief:!!brief,hasKeywords:keywordList.length>0,hasClientBrief:!!clientBrief,hasOriginalArticle:!!originalArticle},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
    debugLog(bodyLog);
    // #endregion

    const generatedArticles: ArticleResponse[] = [];

    // Handle different modes
    if (mode === "directBrief") {
      // Direct Brief mode: Generate single article from client brief
      try {
        // Build prompt for direct brief mode
        const prompt = buildDirectBriefPrompt({
          clientBrief: clientBrief!,
          niche: articleSettings?.nicheOrIndustry || brief.niche || "",
          platform: brief.platform || "multi-platform",
          contentPurpose: brief.contentPurpose || "Guest post / outreach",
          anchorText: articleSettings?.anchorKeyword || brief.anchorText || "",
          anchorUrl: brief.anchorUrl || brief.clientSite || "",
          brandName: articleSettings?.brandName || "PromosoundGroup",
          keywordList: keywordList,
          trustSourcesList: trustSourcesList,
          language: brief.language || "English",
          targetAudience: "B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms",
          wordCount: articleSettings?.targetWordCount ? String(articleSettings.targetWordCount) : (brief.wordCount || "1000"),
          writingStyle: articleSettings?.writingStyle,
        });

        const systemMessage = `You are an expert SEO Content Strategist and outreach content writer, native English speaker (US), with deep experience in social media, music marketing and creator economy. You write SEO-optimized, human-sounding articles that feel like an experienced practitioner, not AI, wrote them.

Target audience: B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms.
Brand to feature: PromosoundGroup
Goal: Create a useful, non-pushy outreach article that educates, builds trust and naturally promotes the provided link via a contextual anchor.
Language: ${brief.language || "US English"}.`;

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:177',message:'[Bug1-FIX] About to call OpenAI with gpt-4-turbo in directBrief mode',data:{mode:'directBrief',modelName:'gpt-4-turbo'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        let completion;
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
          });
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:186',message:'[Bug1-FIX] OpenAI call succeeded with gpt-4-turbo',data:{modelName:'gpt-4-turbo'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        } catch (formatError: any) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:188',message:'[Bug1-FIX] OpenAI call failed, caught error',data:{modelName:'gpt-4-turbo',errorMessage:formatError?.message,errorCode:formatError?.code,errorType:formatError?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:189',message:'[Bug1-FIX] Retrying with gpt-4-turbo',data:{modelName:'gpt-4-turbo'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
          });
        }

        const content = completion.choices[0]?.message?.content ?? "";
        let parsedResponse: { titleTag?: string; metaDescription?: string; articleBodyHtml?: string };
        
        try {
          let jsonContent = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          parsedResponse = JSON.parse(jsonContent);
          if (!parsedResponse.titleTag || !parsedResponse.metaDescription || !parsedResponse.articleBodyHtml) {
            throw new Error("Missing required fields in JSON response");
          }
        } catch (parseError) {
          parsedResponse = {
            titleTag: "Article",
            metaDescription: "",
            articleBodyHtml: content,
          };
        }

        let cleanedTitleTag = cleanText(parsedResponse.titleTag || "Article");
        let cleanedMetaDescription = cleanText(parsedResponse.metaDescription || "");
        let cleanedArticleBodyHtml = cleanText(parsedResponse.articleBodyHtml || content);

        if (body.lightHumanEdit) {
          try {
            cleanedArticleBodyHtml = await lightHumanEdit(cleanedArticleBodyHtml, openai, { preserveHtml: true });
          } catch (editError) {
            console.error('[articles-api] Light human edit failed:', editError);
          }
        }

        generatedArticles.push({
          topicTitle: "Direct Brief Article",
          titleTag: cleanedTitleTag,
          metaDescription: cleanedMetaDescription,
          fullArticleText: cleanedArticleBodyHtml,
          articleBodyHtml: cleanedArticleBodyHtml,
        });
      } catch (error) {
        console.error("Error generating article from brief:", error);
        throw error;
      }
    } else if (mode === "rewrite") {
      // Rewrite mode: Deeply rewrite and improve existing article
      try {
        const prompt = buildRewritePrompt({
          originalArticle: originalArticle!,
          niche: rewriteParams?.niche || brief.niche || "",
          brandName: rewriteParams?.brandName || "",
          anchorKeyword: rewriteParams?.anchorKeyword || brief.anchorText || "",
          targetWordCount: rewriteParams?.targetWordCount || parseInt(brief.wordCount || "1000"),
          style: rewriteParams?.style || "neutral",
          language: brief.language || "English",
        });

        const systemMessage = `You are an expert content editor and SEO specialist. Your task is to deeply analyze and rewrite articles, improving their structure, clarity, SEO optimization, and overall quality while preserving the core meaning and message.

Language: ${brief.language || "US English"}.`;

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:258',message:'[Bug1-FIX] About to call OpenAI with gpt-4-turbo in rewrite mode',data:{mode:'rewrite',modelName:'gpt-4-turbo'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        let completion;
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
          });
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:267',message:'[Bug1-FIX] OpenAI call succeeded with gpt-4-turbo',data:{modelName:'gpt-4-turbo'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        } catch (formatError: any) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:269',message:'[Bug1-FIX] OpenAI call failed, caught error',data:{modelName:'gpt-4-turbo',errorMessage:formatError?.message,errorCode:formatError?.code,errorType:formatError?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'articles/route.ts:270',message:'[Bug1-FIX] Retrying with gpt-4-turbo',data:{modelName:'gpt-4-turbo'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug1-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
          });
        }

        const content = completion.choices[0]?.message?.content ?? "";
        let parsedResponse: { titleTag?: string; metaDescription?: string; articleBodyHtml?: string };
        
        try {
          let jsonContent = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          parsedResponse = JSON.parse(jsonContent);
          if (!parsedResponse.titleTag || !parsedResponse.metaDescription || !parsedResponse.articleBodyHtml) {
            throw new Error("Missing required fields in JSON response");
          }
        } catch (parseError) {
          parsedResponse = {
            titleTag: "Rewritten Article",
            metaDescription: "",
            articleBodyHtml: content,
          };
        }

        let cleanedTitleTag = cleanText(parsedResponse.titleTag || "Rewritten Article");
        let cleanedMetaDescription = cleanText(parsedResponse.metaDescription || "");
        let cleanedArticleBodyHtml = cleanText(parsedResponse.articleBodyHtml || content);

        if (body.lightHumanEdit) {
          try {
            cleanedArticleBodyHtml = await lightHumanEdit(cleanedArticleBodyHtml, openai, { preserveHtml: true });
          } catch (editError) {
            console.error('[articles-api] Light human edit failed:', editError);
          }
        }

        generatedArticles.push({
          topicTitle: "Rewritten Article",
          titleTag: cleanedTitleTag,
          metaDescription: cleanedMetaDescription,
          fullArticleText: cleanedArticleBodyHtml,
          articleBodyHtml: cleanedArticleBodyHtml,
        });
      } catch (error) {
        console.error("Error rewriting article:", error);
        throw error;
      }
    } else {
      // Original "topics" mode - Generate article for each selected topic
      for (const topic of selectedTopics) {
      try {
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
        const promptBuildLog = {location:'articles/route.ts:94',message:'Building article prompt',data:{topicTitle:topic.title,trustSourcesCount:trustSourcesList.length,trustSourcesPreview:trustSourcesList.slice(0,3),platform:brief.platform},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'article-prompt'};
        debugLog(promptBuildLog);
        // #endregion

        // Build the article prompt
        // Note: buildArticlePrompt will throw an error if niche is missing
        const prompt = buildArticlePrompt({
          topicTitle: topic.title,
          topicBrief: topicBrief,
          niche: brief.niche || "", // Will be validated in buildArticlePrompt
          mainPlatform: brief.platform || "multi-platform",
          contentPurpose: brief.contentPurpose || "Guest post / outreach",
          anchorText: brief.anchorText || "",
          anchorUrl: brief.anchorUrl || brief.clientSite || "",
          brandName: "PromosoundGroup",
          keywordList: keywordList.length > 0 ? keywordList : (topic.primaryKeyword ? [topic.primaryKeyword] : []),
          trustSourcesList: trustSourcesList,
          language: brief.language || "English",
          targetAudience: "B2C — beginner and mid-level musicians, content creators, influencers, bloggers, and small brands that want more visibility and growth on social platforms",
        });
        
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

        // Call OpenAI API with system + user messages
        // #region agent log
        const beforeApiLog = {location:'articles/route.ts:103',message:'About to call OpenAI API',data:{model:'gpt-4-turbo',hasSystemMessage:!!systemMessage,hasUserPrompt:!!prompt,promptLength:prompt.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
        debugLog(beforeApiLog);
        // #endregion

        let completion;
        try {
          // Try with response_format and reasoning_effort (Thinking mode) first
          try {
            completion = await openai.chat.completions.create({
              model: "gpt-4-turbo",
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
              temperature: 0.7,
              response_format: { type: "json_object" },
              reasoning_effort: "high", // Enable Thinking mode for better quality articles and links
            });
          } catch (formatError: any) {
            // If response_format or reasoning_effort is not supported, try without them
            // #region agent log
            const formatErrorLog = {location:'articles/route.ts:125',message:'response_format or reasoning_effort not supported, trying without them',data:{error:(formatError as Error).message,errorCode:formatError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
            debugLog(formatErrorLog);
            // #endregion
            try {
              // Try with reasoning_effort but without response_format
              completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
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
                temperature: 0.7,
                reasoning_effort: "high", // Enable Thinking mode
              });
            } catch (reasoningError: any) {
              // If reasoning_effort is not supported, fall back to standard call
              // #region agent log
              const reasoningErrorLog = {location:'articles/route.ts:165',message:'reasoning_effort not supported, using standard mode',data:{error:(reasoningError as Error).message,errorCode:reasoningError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'thinking-mode'};
              debugLog(reasoningErrorLog);
              // #endregion
              completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
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
                temperature: 0.7,
              });
            }
          }
        } catch (apiError: any) {
          // #region agent log
          const apiErrorLog = {location:'articles/route.ts:150',message:'OpenAI API call failed',data:{error:(apiError as Error).message,errorName:(apiError as Error).name,errorStatus:apiError?.status,errorCode:apiError?.code,errorType:apiError?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
          debugLog(apiErrorLog);
          // #endregion
          throw apiError;
        }

        const content = completion.choices[0]?.message?.content ?? "";

        // #region agent log
        const apiLog = {location:'articles/route.ts:135',message:'OpenAI API success',data:{contentLength:content.length,topicTitle:topic.title,hasContent:!!content,contentPreview:content.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-api',hypothesisId:'articles-endpoint'};
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

