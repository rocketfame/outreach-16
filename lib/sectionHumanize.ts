// lib/sectionHumanize.ts
// Section-level humanization using AIHumanize.io API

export interface HumanizeTextRequest {
  text: string;
  model?: number; // 0: quality, 1: balance (default), 2: enhanced
  style?: string; // General, Blog, Formal, Informal, Academic, Expand, Simplify
  mode?: "Basic" | "Autopilot"; // Basic or Autopilot
  registeredEmail: string;
}

export interface HumanizeTextResponse {
  text: string;
  wordsUsed: number;
  remainingWords: number;
}

/**
 * Humanizes plain text using AIHumanize.io API
 * Text must be between 100 and 10000 characters
 */
export async function humanizeText(request: HumanizeTextRequest): Promise<HumanizeTextResponse> {
  const { text, model = 1, style, mode, registeredEmail } = request;

  if (text.length < 100 || text.length > 10000) {
    throw new Error("Text must be between 100 and 10000 characters for humanization.");
  }

  const apiKey = process.env.AIHUMANIZE_API_KEY;
  if (!apiKey) {
    throw new Error("AIHumanize API key is not configured");
  }

  // Validate that email is not empty
  if (!registeredEmail || registeredEmail.trim().length === 0) {
    throw new Error("Registered email is required for humanization");
  }

  // Build request body with optional style and mode parameters
  // CRITICAL: According to AIHumanize API documentation, model must be a STRING ("0", "1", or "2"), not a number!
  // API expects: { model: "0" | "1" | "2", mail: string, data: string }
  // This was working this morning before our updates - the issue is that we changed model to number instead of string!
  
  // Validate and convert model to string
  const modelNum = Number(model);
  let modelString: string;
  if (isNaN(modelNum) || modelNum < 0 || modelNum > 2) {
    console.warn(`[humanizeText] Invalid model value: ${model}, defaulting to "1" (Balance)`);
    modelString = "1"; // Default to Balance model as string
  } else {
    modelString = String(modelNum); // Convert to string: "0", "1", or "2"
  }
  
  // Build request body according to AIHumanize API documentation
  // API only supports: model (string), mail (string), data (string)
  // NOTE: style and mode parameters are NOT supported by the API according to official documentation
  // These were added in our updates but are not part of the official API spec
  const requestBody: any = {
    model: modelString, // CRITICAL: Must be string "0", "1", or "2", not number!
    mail: String(registeredEmail).trim(),
    data: String(text)
  };

  // NOTE: According to official AIHumanize API documentation, only model, mail, and data are supported
  // style and mode parameters are NOT part of the official API and may cause "Missing required parameters" errors
  // Removed style and mode to match the working version from this morning

  // Log request details for debugging (without sensitive data)
  console.log("[humanizeText] Calling AIHumanize API", {
    hasEmail: !!registeredEmail,
    emailPrefix: registeredEmail ? registeredEmail.substring(0, 3) + "***" : "none",
    emailLength: registeredEmail?.length || 0,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    textLength: text.length,
    model,
    style,
    mode,
    requestBodyKeys: Object.keys(requestBody),
    hasModel: 'model' in requestBody,
    hasMail: 'mail' in requestBody,
    hasData: 'data' in requestBody,
  });

  // Log the actual request body structure (without sensitive data)
  const logRequestBody = {
    hasModel: 'model' in requestBody,
    modelValue: requestBody.model,
    hasMail: 'mail' in requestBody,
    mailValue: requestBody.mail ? (requestBody.mail.substring(0, 3) + "***") : null,
    mailLength: requestBody.mail?.length || 0,
    hasData: 'data' in requestBody,
    dataLength: requestBody.data?.length || 0,
    hasStyle: 'style' in requestBody,
    styleValue: requestBody.style,
    hasMode: 'mode' in requestBody,
    modeValue: requestBody.mode,
    allKeys: Object.keys(requestBody),
  };
  console.log("[humanizeText] Request body structure:", logRequestBody);

  const response = await fetch("https://aihumanize.io/api/v1/rewrite", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const json = await response.json();

  // Log response for debugging
  console.log("[humanizeText] AIHumanize API response", {
    code: json.code,
    msg: json.msg,
    hasData: !!json.data,
    wordsUsed: json.words_used,
    remainingWords: json.remaining_words,
  });

  if (json.code !== 200) {
    // Map error codes to user-friendly messages
    // NOTE: Code 1004 can mean different things - check the actual message
    let errorMessage: string;
    
    // Map error codes according to AIHumanize API documentation
    const errorMessages: Record<number, string> = {
      1001: "Missing API key - please check AIHUMANIZE_API_KEY in .env.local",
      1002: "Rate limit exceeded - try again in a few minutes",
      1003: "Invalid API Key - please check AIHUMANIZE_API_KEY in .env.local",
      1004: "Request parameter error - please check that model, mail, and data are correctly formatted",
      1005: "Text language not supported - humanization works only for English text",
      1006: "You don't have enough words - please check your AIHumanize account balance",
      1007: "Server Error - AIHumanize service is temporarily unavailable, try again later",
      1008: "Wrong email address - please check NEXT_PUBLIC_AIHUMANIZE_EMAIL in .env.local",
    };
    
    errorMessage = errorMessages[json.code] || json.msg || "Humanization failed";
    
    // Add more context for parameter errors
    if (json.code === 1004) {
      errorMessage += `. Check that model is a string ("0", "1", or "2"), mail is a valid email, and data is between 100-10000 characters.`;
    }
    
    // Log detailed error for debugging
    console.error("[humanizeText] AIHumanize API error", {
      code: json.code,
      message: errorMessage,
      apiMsg: json.msg,
      emailPrefix: registeredEmail ? registeredEmail.substring(0, 3) + "***" : "none",
      emailLength: registeredEmail?.length || 0,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      requestBodyKeys: Object.keys(requestBody),
      requestBodyHasModel: 'model' in requestBody,
      requestBodyHasMail: 'mail' in requestBody,
      requestBodyHasData: 'data' in requestBody,
    });
    
    throw new Error(errorMessage);
  }

  return {
    text: json.data as string,
    wordsUsed: json.words_used || 0,
    remainingWords: json.remaining_words || 0
  };
}

/**
 * Chunks text for humanization if it exceeds 10000 characters
 * Splits by paragraphs (double newlines) to preserve structure
 */
export function chunkTextForHumanization(text: string): string[] {
  if (text.length <= 10000) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed limit, save current chunk and start new one
    if (currentChunk && (currentChunk.length + trimmed.length + 2) > 10000) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Humanizes a single section of plain text using AIHumanize.io.
 * Includes fallback to original text if humanization fails.
 * @param text The plain text section to humanize.
 * @param model The AIHumanize model to use (0: quality, 1: balance, 2: enhanced).
 * @param registeredEmail The registered email for AIHumanize API.
 * @param frozenPhrases Phrases to protect from alteration (e.g., brand names, anchor text).
 *   Note: Currently not used as AIHumanize API doesn't support frozen phrases directly.
 *   Placeholders like [A1], [T1] are already short tokens that should survive humanization.
 * @param style Optional writing style (General, Blog, Formal, Informal, Academic, Expand, Simplify).
 * @param mode Optional mode (Basic or Autopilot).
 * @returns The humanized text, or the original text on error.
 */
export async function humanizeSectionText(
  text: string,
  model: number,
  registeredEmail: string,
  frozenPhrases: string[] = [],
  style?: string,
  mode?: "Basic" | "Autopilot"
): Promise<{ humanizedText: string; wordsUsed: number }> {
  if (!text || text.trim().length === 0) {
    return { humanizedText: text, wordsUsed: 0 };
  }

  // If text is too short, skip humanization (API requires 100+ chars)
  if (text.length < 100) {
    return { humanizedText: text, wordsUsed: 0 };
  }

  const apiKey = process.env.AIHUMANIZE_API_KEY;
  if (!apiKey) {
    console.error("[humanizeSectionText] AIHumanize API key not configured");
    return { humanizedText: text, wordsUsed: 0 };
  }

  try {
    // Use the local humanizeText function (which calls AIHumanize API)
    // For now, send text as-is if it's within limits
    // Future: implement chunking here if needed for very long sections
    if (text.length > 10000) {
      // Chunk the text
      const chunks = chunkTextForHumanization(text);
      let totalWordsUsed = 0;
      const humanizedChunks: string[] = [];

      for (const chunk of chunks) {
        const result = await humanizeText({
          text: chunk,
          model,
          style,
          mode,
          registeredEmail
        });
        humanizedChunks.push(result.text);
        totalWordsUsed += result.wordsUsed;
      }

      return { 
        humanizedText: humanizedChunks.join('\n\n'), 
        wordsUsed: totalWordsUsed 
      };
    } else {
      const result = await humanizeText({
        text,
        model,
        style,
        mode,
        registeredEmail
      });

      return { 
        humanizedText: result.text, 
        wordsUsed: result.wordsUsed 
      };
    }
  } catch (error) {
    console.error("[humanizeSectionText] Humanization failed for section, falling back to original text:", error);
    return { humanizedText: text, wordsUsed: 0 }; // Fallback to original text
  }
}

