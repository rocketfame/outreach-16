// app/api/generate-topics/route.ts

import OpenAI from "openai";
import { buildTopicPrompt } from "@/lib/topicPrompt";
import { shouldUseBrowsing, browseForTopics } from "@/lib/topicBrowsing";
import { appendFileSync } from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  // Log Tavily API key prefix for debugging (without exposing full key)
  console.log(
    "TAVILY_API_KEY prefix in prod:",
    (process.env.TAVILY_API_KEY || "undefined").slice(0, 10)
  );

  // #region agent log
  const logPath = '/Users/serhiosider/Downloads/outreach-articles-app-main 2/.cursor/debug.log';
  const logEntry = {location:'generate-topics/route.ts:12',message:'POST /api/generate-topics called',data:{hasApiKey:!!process.env.OPENAI_API_KEY,routeExists:true},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
  try { appendFileSync(logPath, JSON.stringify(logEntry) + '\n'); } catch (e) { console.error('Log write error:', e); }
  // #endregion

  if (!process.env.OPENAI_API_KEY) {
    // #region agent log
    const errorLog = {location:'generate-topics/route.ts:17',message:'Missing API key',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    try { appendFileSync(logPath, JSON.stringify(errorLog) + '\n'); } catch {}
    // #endregion
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable." }), {
      status: 500,
    });
  }

  try {
    const { brief } = await req.json();
    
    // #region agent log
    const bodyLog = {location:'generate-topics/route.ts:25',message:'Request body parsed',data:{hasBrief:!!brief,niche:brief?.niche,platform:brief?.platform,anchorText:brief?.anchorText,anchorUrl:brief?.anchorUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    try { appendFileSync(logPath, JSON.stringify(bodyLog) + '\n'); } catch {}
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
    try { appendFileSync(logPath, JSON.stringify(browsingDecisionLog) + '\n'); } catch {}
    // #endregion

    // Step 2: Perform browsing if needed
    let browsingData;
    if (needsBrowsing) {
      // #region agent log
      const browsingStartLog = {location:'generate-topics/route.ts:42',message:'Starting browsing for topics',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'topic-browsing'};
      try { appendFileSync(logPath, JSON.stringify(browsingStartLog) + '\n'); } catch {}
      // #endregion

      browsingData = await browseForTopics({
        niche: brief.niche || "",
        platform: brief.platform || "",
        contentPurpose: brief.contentPurpose || "",
        anchorText: brief.anchorText || "",
        anchorUrl: brief.anchorUrl || "",
      });

      // #region agent log
      const browsingCompleteLog = {location:'generate-topics/route.ts:52',message:'Browsing completed',data:{serpCount:browsingData.serpResults.length,officialCount:browsingData.officialResources.length,competitorCount:browsingData.competitorContent.length,dataCount:browsingData.recentData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'topic-browsing'};
      try { appendFileSync(logPath, JSON.stringify(browsingCompleteLog) + '\n'); } catch {}
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
    try { appendFileSync(logPath, JSON.stringify(promptLog) + '\n'); } catch {}
    // #endregion

    // #region agent log
    const apiCallLog = {location:'generate-topics/route.ts:40',message:'Calling OpenAI API',data:{model:'gpt-5.1'},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    try { appendFileSync(logPath, JSON.stringify(apiCallLog) + '\n'); } catch {}
    // #endregion

    // Use Thinking mode (reasoning_effort) for better quality topic generation
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-5.1",
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
        reasoning_effort: "high", // Enable Thinking mode for better quality
      });
    } catch (reasoningError: any) {
      // If reasoning_effort is not supported, fall back to standard call
      // #region agent log
      const reasoningErrorLog = {location:'generate-topics/route.ts:55',message:'reasoning_effort not supported, using standard mode',data:{error:(reasoningError as Error).message,errorCode:reasoningError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'thinking-mode'};
      try { appendFileSync(logPath, JSON.stringify(reasoningErrorLog) + '\n'); } catch {}
      // #endregion
      completion = await openai.chat.completions.create({
        model: "gpt-5.1",
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
    }

    const content = completion.choices[0]?.message?.content ?? "";

    // #region agent log
    const successLog = {location:'generate-topics/route.ts:58',message:'OpenAI API success',data:{contentLength:content.length,hasContent:!!content},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    try { appendFileSync(logPath, JSON.stringify(successLog) + '\n'); } catch {}
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
        try { appendFileSync(logPath, JSON.stringify(warningLog) + '\n'); } catch {}
        // #endregion
      } else if (parsedData.topics.length < 5) {
        // If less than 5, we'll accept what we have but log a warning
        // #region agent log
        const warningLog = {location:'generate-topics/route.ts:97',message:'Warning: Less than 5 topics returned',data:{topicsCount:parsedData.topics.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
        try { appendFileSync(logPath, JSON.stringify(warningLog) + '\n'); } catch {}
        // #endregion
      }

      // Add unique IDs to each topic
      parsedData.topics = parsedData.topics.map((topic: any, index: number) => ({
        ...topic,
        id: `topic-${Date.now()}-${index}`,
      }));

      // #region agent log
      const parseLog = {location:'generate-topics/route.ts:85',message:'Topics parsed successfully',data:{topicsCount:parsedData.topics.length,hasOverview:!!parsedData.overview},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
      try { appendFileSync(logPath, JSON.stringify(parseLog) + '\n'); } catch {}
      // #endregion

      return new Response(JSON.stringify({ overview: parsedData.overview, topics: parsedData.topics }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (parseError) {
      // #region agent log
      const parseErrorLog = {location:'generate-topics/route.ts:92',message:'JSON parse error',data:{error:(parseError as Error).message,contentPreview:content.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
      try { appendFileSync(logPath, JSON.stringify(parseErrorLog) + '\n'); } catch {}
      // #endregion
      console.error("JSON parse error:", parseError);
      return new Response(JSON.stringify({ error: "Failed to parse topics response. Please try again." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    // #region agent log
    const apiErrorLog = {location:'generate-topics/route.ts:65',message:'Topic generation error',data:{error:(err as Error).message,errorName:(err as Error).name},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    try { appendFileSync(logPath, JSON.stringify(apiErrorLog) + '\n'); } catch {}
    // #endregion
    console.error("Topic generation error", err);
    return new Response(JSON.stringify({ error: "Failed to generate topics" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

