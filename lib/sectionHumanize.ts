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

  // Build request body with optional style and mode parameters
  const requestBody: any = {
    model,
    mail: registeredEmail,
    data: text
  };

  // Add style if provided
  if (style) {
    requestBody.style = style.toLowerCase(); // AIHumanize expects lowercase
  }

  // Add mode if provided (Autopilot mode)
  if (mode === "Autopilot") {
    requestBody.mode = "autopilot";
  }

  const response = await fetch("https://aihumanize.io/api/v1/rewrite", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const json = await response.json();

  if (json.code !== 200) {
    // Map error codes to user-friendly messages
    const errorMessages: Record<number, string> = {
      1001: "API key not configured",
      1002: "Invalid API key",
      1003: "Email not registered",
      1004: "Insufficient balance",
      1005: "Text too short (minimum 100 characters)",
      1006: "Text too long (maximum 10000 characters)",
      1007: "Invalid model parameter",
    };
    
    const errorMessage = errorMessages[json.code] || json.msg || "Humanization failed";
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

