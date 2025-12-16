import OpenAI from "openai";

// Simple debug logger that works in both local and production (Vercel)
const debugLog = (...args: any[]) => {
  console.log("[generate-api-debug]", ...args);
};

type Brief = {
  niche: string;
  clientSite: string;
  language: string;
  wordCount: string;
};

type GenerateRequest = {
  type: "topics" | "outline" | "draft";
  brief: Brief;
  selectedTopic?: string;
  outline?: string;
};

type PromptPair = {
  systemPrompt: string;
  userPrompt: string;
};

export async function POST(req: Request) {
  // Safe debug log for OpenAI API key (only prefix, never full key)
  console.log(
    "OPENAI_API_KEY prefix in runtime:",
    (process.env.OPENAI_API_KEY || "undefined").slice(0, 10)
  );

  // #region agent log
  const logEntry = {location:'route.ts:23',message:'POST /api/generate called',data:{hasApiKey:!!process.env.OPENAI_API_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
  debugLog(logEntry);
  // #endregion
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    // #region agent log
    const errorLog = {location:'route.ts:28',message:'Missing API key',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(errorLog);
    // #endregion
    return Response.json(
      { error: "Missing OPENAI_API_KEY environment variable." },
      { status: 500 },
    );
  }

  // Critical validation: OpenAI key must start with "sk-" (not Tavily key "tvly-")
  if (!openaiApiKey.startsWith("sk-")) {
    const keyPrefix = openaiApiKey.slice(0, 10);
    console.error(`OPENAI_API_KEY has invalid prefix: ${keyPrefix}. OpenAI keys must start with "sk-". This might be a Tavily key (tvly-) mistakenly set as OPENAI_API_KEY.`);
    return Response.json(
      { 
        error: `Invalid OPENAI_API_KEY format. OpenAI keys must start with "sk-", but got prefix "${keyPrefix}". Please check your Vercel Environment Variables - you might have set TAVILY_API_KEY value as OPENAI_API_KEY.` 
      },
      { status: 500 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
    // #region agent log
    const bodyLog = {location:'route.ts:35',message:'Request body parsed',data:{type:body.type,hasBrief:!!body.brief,hasSelectedTopic:!!body.selectedTopic,hasOutline:!!body.outline},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(bodyLog);
    // #endregion
  } catch (error) {
    // #region agent log
    const parseErrorLog = {location:'route.ts:37',message:'JSON parse error',data:{error:(error as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(parseErrorLog);
    // #endregion
    console.error("Invalid JSON payload", error);
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { type, brief, selectedTopic = "", outline = "" } = body;
  if (!type || !brief) {
    // #region agent log
    const validationErrorLog = {location:'route.ts:42',message:'Validation error - missing type or brief',data:{type,hasBrief:!!brief},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(validationErrorLog);
    // #endregion
    return Response.json({ error: "Missing type or brief." }, { status: 400 });
  }

  if (type === "outline" && !selectedTopic.trim()) {
    // #region agent log
    const outlineErrorLog = {location:'route.ts:45',message:'Validation error - missing selectedTopic for outline',data:{type,selectedTopic},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(outlineErrorLog);
    // #endregion
    return Response.json(
      { error: "selectedTopic is required for outline generation." },
      { status: 400 },
    );
  }

  if (type === "draft" && !outline.trim()) {
    // #region agent log
    const draftErrorLog = {location:'route.ts:51',message:'Validation error - missing outline for draft',data:{type,outlineLength:outline.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(draftErrorLog);
    // #endregion
    return Response.json(
      { error: "outline is required for draft generation." },
      { status: 400 },
    );
  }

  const prompts = buildPrompts(type, brief, selectedTopic, outline);
  // #region agent log
  const promptsLog = {location:'route.ts:58',message:'Prompts built',data:{type,systemPromptLength:prompts.systemPrompt.length,userPromptLength:prompts.userPrompt.length},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
  debugLog(promptsLog);
  // #endregion

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // #region agent log
    const apiCallLog = {location:'route.ts:63',message:'Calling OpenAI API',data:{model:'gpt-5.1',type},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(apiCallLog);
    // #endregion
    const completion = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      max_completion_tokens: 1200,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    // #region agent log
    const successLog = {location:'route.ts:72',message:'OpenAI API success',data:{textLength:text.length,hasText:!!text},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(successLog);
    // #endregion
    return Response.json({ text });
  } catch (error) {
    // #region agent log
    const apiErrorLog = {location:'route.ts:75',message:'OpenAI API error',data:{error:(error as Error).message,errorName:(error as Error).name,errorStack:(error as Error).stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'api-debug',hypothesisId:'api-route'};
    debugLog(apiErrorLog);
    // #endregion
    console.error("OpenAI API error", error);
    
    // Provide more specific error messages
    const errorMessage = (error as Error).message || "";
    let userFriendlyError = "Failed to generate content. Please try again.";
    
    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      userFriendlyError = "OpenAI API quota exceeded. Please check your billing and plan details at https://platform.openai.com/account/billing";
    } else if (errorMessage.includes("401") || errorMessage.includes("Invalid API key")) {
      userFriendlyError = "Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.";
    } else if (errorMessage.includes("model")) {
      userFriendlyError = "Invalid model name. Please check your OpenAI API configuration.";
    }
    
    return Response.json(
      { error: userFriendlyError },
      { status: 500 },
    );
  }
}

function buildPrompts(
  type: GenerateRequest["type"],
  brief: Brief,
  selectedTopic: string,
  outline: string,
): PromptPair {
  const sharedBrief = [
    `Niche: ${brief.niche || "Not specified"}`,
    `Client site: ${brief.clientSite || "Not provided"}`,
    `Language: ${brief.language || "English"}`,
    `Target word count: ${brief.wordCount || "Not specified"}`,
  ].join("\n");

  if (type === "topics") {
    return {
      systemPrompt: "You are an assistant that generates SEO-friendly outreach article topic ideas.",
      userPrompt: `${sharedBrief}

Please provide roughly 10 specific and practical outreach article topics relevant to the brief above. 
Return one topic per line and avoid numbering.`,
    };
  }

  if (type === "outline") {
    return {
      systemPrompt: "You create detailed article outlines for outreach / SEO articles.",
      userPrompt: `Selected topic: ${selectedTopic}
Language: ${brief.language || "English"}

Create a clear H2/H3 outline as plain text for the selected topic. Include descriptive headings and bullet-friendly talking points.`,
    };
  }

  return {
    systemPrompt: "You write well-structured, natural, human-like outreach articles.",
    userPrompt: `Outline:
${outline}

${sharedBrief}

Write a full outreach article draft that follows the outline above. Include headings and natural paragraphs, stay within the desired tone for outreach, and hit the target word count as closely as possible.`,
  };
}
