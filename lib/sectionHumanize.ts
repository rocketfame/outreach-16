// lib/sectionHumanize.ts
// Section-level humanization using AIHumanize.io API

export interface HumanizeTextRequest {
  text: string;
  model?: number; // 0: quality, 1: balance (default), 2: enhanced
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
  const { text, model = 1, registeredEmail } = request;

  if (text.length < 100 || text.length > 10000) {
    throw new Error("Text must be between 100 and 10000 characters for humanization.");
  }

  const apiKey = process.env.AIHUMANIZE_API_KEY;
  if (!apiKey) {
    throw new Error("AIHumanize API key is not configured");
  }

  const response = await fetch("https://aihumanize.io/api/v1/rewrite", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      mail: registeredEmail,
      data: text
    })
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

