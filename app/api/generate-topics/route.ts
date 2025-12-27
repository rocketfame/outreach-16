// app/api/generate-topics/route.ts

import { buildTopicPrompt } from "@/lib/topicPrompt";
import { shouldUseBrowsing, browseForTopics } from "@/lib/topicBrowsing";
import { getOpenAIClient, logApiKeyStatus, validateApiKeys } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

// Simple debug logger that works in both local and production (Vercel)
const debugLog = (...args: any[]) => {
  console.log("[debug]", ...args);
};

export async function POST(req: Request) {
  // #region agent log
  const logEntry = {location:'generate-topics/route.ts:12',message:'POST /api/generate-topics called',data:{routeExists:true},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
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
    const { brief } = await req.json();
    
    // #region agent log
    const bodyLog = {location:'generate-topics/route.ts:25',message:'Request body parsed',data:{hasBrief:!!brief,niche:brief?.niche,platform:brief?.platform,anchorText:brief?.anchorText,anchorUrl:brief?.anchorUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(bodyLog);
    // #endregion

    // Step 1: Determine if browsing is needed
    const needsBrowsing = shouldUseBrowsing({
      niche: brief.niche || "",
      platform: brief.platform || "",
      contentPurpose: brief.contentPurpose || "",
      anchorText: brief.anchorText || "",
      anchorUrl: brief.anchorUrl || "",
    });

    // #region agent log
    const browsingDecisionLog = {location:'generate-topics/route.ts:35',message:'Browsing decision made',data:{needsBrowsing,niche:brief?.niche,platform:brief?.platform},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'browsing-decision'};
    debugLog(browsingDecisionLog);
    // #endregion

    // Step 2: Perform browsing if needed
    let browsingData;
    if (needsBrowsing) {
      // #region agent log
      const browsingStartLog = {location:'generate-topics/route.ts:42',message:'Starting browsing for topics',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'topic-browsing'};
      debugLog(browsingStartLog);
      // #endregion

      try {
        browsingData = await browseForTopics({
          niche: brief.niche || "",
          platform: brief.platform || "",
          contentPurpose: brief.contentPurpose || "",
          anchorText: brief.anchorText || "",
          anchorUrl: brief.anchorUrl || "",
        });
      } catch (tavilyError) {
        console.error("Topic generation error - Tavily browsing failed:", tavilyError);
        // #region agent log
        const tavilyErrorLog = {location:'generate-topics/route.ts:60',message:'Tavily browsing error',data:{error:(tavilyError as Error).message,errorName:(tavilyError as Error).name,errorStack:(tavilyError as Error).stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'tavily-error'};
        debugLog(tavilyErrorLog);
        // #endregion
        return new Response(
          JSON.stringify({ error: "Failed to generate topics: Tavily search failed" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // #region agent log
      const browsingCompleteLog = {location:'generate-topics/route.ts:52',message:'Browsing completed',data:{serpCount:browsingData.serpResults.length,officialCount:browsingData.officialResources.length,competitorCount:browsingData.competitorContent.length,dataCount:browsingData.recentData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'topic-browsing'};
      debugLog(browsingCompleteLog);
      // #endregion
    }

    // Step 3: Build prompt with or without browsing data
    const prompt = buildTopicPrompt({
      niche: brief.niche || "",
      platform: brief.platform || "",
      contentPurpose: brief.contentPurpose || "",
      anchorText: brief.anchorText || "",
      anchorUrl: brief.anchorUrl || "",
      brandName: "PromosoundGroup",
    }, browsingData);

    // #region agent log
    const promptLog = {location:'generate-topics/route.ts:35',message:'Topic prompt built',data:{promptLength:prompt.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(promptLog);
    // #endregion

    // #region agent log
    const apiCallLog = {location:'generate-topics/route.ts:40',message:'Calling OpenAI API',data:{model:'gpt-5.2'},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(apiCallLog);
    // #endregion

    // Generate topics using GPT-5.2
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: "You are a JSON-only API. Always respond with valid JSON only, no markdown, no code blocks, no commentary.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });
    } catch (formatError: any) {
      // If response_format is not supported, try without it
      // #region agent log
      const formatErrorLog = {location:'generate-topics/route.ts:55',message:'response_format not supported, trying without it',data:{error:(formatError as Error).message,errorCode:formatError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'format-fallback'};
      debugLog(formatErrorLog);
      // #endregion
      completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: "You are a JSON-only API. Always respond with valid JSON only, no markdown, no code blocks, no commentary.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });
    }

    const content = completion.choices[0]?.message?.content ?? "";

    // Track cost
    const costTracker = getCostTracker();
    const usage = completion.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    if (inputTokens > 0 || outputTokens > 0) {
      costTracker.trackOpenAIChat('gpt-5.2', inputTokens, outputTokens);
    }

    // #region agent log
    const successLog = {location:'generate-topics/route.ts:58',message:'OpenAI API success',data:{contentLength:content.length,hasContent:!!content,usage:{inputTokens,outputTokens}},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(successLog);
    // #endregion

    // Parse and validate JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(content);
      
      // Validate structure
      if (typeof parsedData.overview !== "string" || !Array.isArray(parsedData.topics)) {
        throw new Error("Invalid response structure: overview must be string and topics must be array");
      }
      
      if (parsedData.topics.length < 1) {
        throw new Error("Invalid response: topics array must contain at least 1 topic");
      }

      // Ensure 5-8 topics (take first 8 if more, log warning if less than 5)
      if (parsedData.topics.length > 8) {
        parsedData.topics = parsedData.topics.slice(0, 8);
        // #region agent log
        const warningLog = {location:'generate-topics/route.ts:91',message:'Warning: More than 8 topics returned, taking first 8',data:{topicsCount:parsedData.topics.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
        debugLog(warningLog);
        // #endregion
      } else if (parsedData.topics.length < 5) {
        // If less than 5, we'll accept what we have but log a warning
        // #region agent log
        const warningLog = {location:'generate-topics/route.ts:97',message:'Warning: Less than 5 topics returned',data:{topicsCount:parsedData.topics.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
        debugLog(warningLog);
        // #endregion
      }

      // Add unique IDs to each topic
      parsedData.topics = parsedData.topics.map((topic: any, index: number) => ({
        ...topic,
        id: `topic-${Date.now()}-${index}`,
      }));

      // #region agent log
      const parseLog = {location:'generate-topics/route.ts:85',message:'Topics parsed successfully',data:{topicsCount:parsedData.topics.length,hasOverview:!!parsedData.overview},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
      debugLog(parseLog);
      // #endregion

      return new Response(JSON.stringify({ overview: parsedData.overview, topics: parsedData.topics }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (parseError) {
      // #region agent log
      const parseErrorLog = {location:'generate-topics/route.ts:92',message:'JSON parse error',data:{error:(parseError as Error).message,contentPreview:content.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
      debugLog(parseErrorLog);
      // #endregion
      console.error("JSON parse error:", parseError);
      return new Response(JSON.stringify({ error: "Failed to parse topics response. Please try again." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    // #region agent log
    const apiErrorLog = {location:'generate-topics/route.ts:65',message:'Topic generation error',data:{error:(err as Error).message,errorName:(err as Error).name,errorStack:(err as Error).stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(apiErrorLog);
    // #endregion
    console.error("Topic generation error", err);
    
    // Check if error is related to Tavily API key
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("TAVILY_API_KEY") || errorMessage.includes("401") || errorMessage.includes("Incorrect API key")) {
      console.error("Tavily API key error detected:", errorMessage);
      return new Response(
        JSON.stringify({ error: "Failed to generate topics: Tavily API configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(JSON.stringify({ error: "Failed to generate topics" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
