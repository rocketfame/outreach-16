/**
 * AIHumanize.io API client
 */

export interface HumanizeRequest {
  text: string;
  model: number; // 0: quality, 1: balance, 2: enhanced
  registeredEmail: string;
}

export interface HumanizeResponse {
  text: string;
  wordsUsed: number;
  remainingWords: number;
}

export interface HumanizeError {
  code: number;
  message: string;
  userMessage: string;
}

/**
 * Humanizes text using AIHumanize.io API
 */
export async function humanizeText(
  apiKey: string,
  request: HumanizeRequest
): Promise<HumanizeResponse> {
  const { text, model, registeredEmail } = request;

  // Validate text length (100-10000 characters)
  if (text.length < 100) {
    throw new Error("Text must be at least 100 characters");
  }
  if (text.length > 10000) {
    throw new Error("Text must be at most 10000 characters. Please chunk the text first.");
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
    const error = mapErrorCode(json.code, json.msg);
    throw error;
  }

  return {
    text: json.data as string,
    wordsUsed: json.words_used || 0,
    remainingWords: json.remaining_words || 0
  };
}

/**
 * Gets remaining word balance from AIHumanize
 */
export async function getHumanizeBalance(
  apiKey: string,
  registeredEmail: string
): Promise<number> {
  const response = await fetch("https://aihumanize.io/api/v1/surplus", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ mail: registeredEmail })
  });

  const json = await response.json();

  if (json.code !== 200) {
    const error = mapErrorCode(json.code, json.msg);
    throw error;
  }

  return json.data as number;
}

/**
 * Maps AIHumanize error codes to user-friendly messages
 */
function mapErrorCode(code: number, msg: string): HumanizeError {
  const errorMessages: Record<number, string> = {
    1001: "Humanize service is not configured. Please contact support.",
    1002: "Too many requests. Try again in a few minutes.",
    1003: "Invalid API key. Please check your configuration.",
    1004: "Invalid request parameters. Please try again.",
    1005: "Humanizing works only for English text right now.",
    1006: "Your Humanize balance is empty. Please top up or switch off Humanize.",
    1007: "Humanize service is temporarily unavailable. Please try again later.",
    1008: "Invalid email configuration. Please check your settings."
  };

  return {
    code,
    message: msg || "Unknown error",
    userMessage: errorMessages[code] || "An error occurred while humanizing text. Please try again."
  };
}

/**
 * Chunks text into multiple requests if needed (100-10000 chars per chunk)
 * Splits by paragraph boundaries to preserve structure
 */
export function chunkTextForHumanization(text: string): string[] {
  const maxChunkSize = 9000; // Leave some margin
  const minChunkSize = 1000; // Ensure chunks are meaningful
  
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const para of paragraphs) {
    const paraWithNewlines = para + '\n\n';
    
    // If adding this paragraph would exceed max size, start a new chunk
    if (currentChunk.length + paraWithNewlines.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = paraWithNewlines;
    } else {
      currentChunk += paraWithNewlines;
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length >= 100); // Filter out chunks that are too small
}

