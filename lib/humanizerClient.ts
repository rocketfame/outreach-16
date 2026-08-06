// lib/humanizerClient.ts
// Undetectable.AI Humanization API v2 client
// Docs: https://help.undetectable.ai/en/article/humanization-api-v2-p28b2n/

import { getHumanizerConfig, getOpenAIClient } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";
import {
  BETTERWORDS_REWRITE_SYSTEM_PROMPT,
  buildBetterWordsRewriteInput,
} from "@/lib/betterwordsPrompt";

export interface HumanizeOptions {
  /** Legacy model: 0=Quality, 1=Balanced, 2=More Human */
  model?: number;
  /** Writing style hint (for logging; Undetectable uses purpose/readability) */
  style?: string;
  /** Basic or Autopilot (for logging; not used by Undetectable) */
  mode?: "Basic" | "Autopilot";
}

export interface HumanizeResult {
  text: string;
  wordsUsed: number;
  provider: "undetectable" | "betterwords";
}

/** Single interface for humanization - swap providers without changing callers */
export interface HumanizerService {
  humanize(text: string, options?: HumanizeOptions): Promise<HumanizeResult>;
}

const MIN_TEXT_LENGTH = 50;
const MAX_TEXT_LENGTH = 10000;
const POLL_INTERVAL_MS = 6000;
const MAX_POLL_ATTEMPTS = 40; // ~4 min max wait (must stay under Vercel 300s maxDuration)
const BETTERWORDS_MODEL = "gpt-5.5";

export class HumanizerInsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "HumanizerInsufficientCreditsError";
  }
}

function hasInsufficientCreditsMessage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "insufficient credits";
}

export function isInsufficientCreditsError(error: unknown): boolean {
  return error instanceof HumanizerInsufficientCreditsError ||
    (error instanceof Error && hasInsufficientCreditsMessage(error.message));
}

function modelToStrength(model?: number): "Quality" | "Balanced" | "More Human" {
  if (model === 0) return "Quality";
  if (model === 2) return "More Human";
  return "Balanced";
}

/**
 * Undetectable.AI Humanization API v2 client.
 * Submit → poll /document until output is ready.
 */
export class UndetectableHumanizerClient implements HumanizerService {
  async humanize(text: string, options?: HumanizeOptions): Promise<HumanizeResult> {
    const trimmed = text.trim();
    if (trimmed.length < MIN_TEXT_LENGTH) {
      throw new Error(`Text must be at least ${MIN_TEXT_LENGTH} characters for humanization`);
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text must be at most ${MAX_TEXT_LENGTH} characters. Chunk the text first.`);
    }

    const config = getHumanizerConfig();
    const strength = modelToStrength(options?.model);

    const submitRes = await fetch(`${config.baseUrl}/submit`, {
      method: "POST",
      headers: {
        apikey: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: trimmed,
        readability: config.readability,
        purpose: config.purpose,
        strength,
        model: config.model,
      }),
    });

    const submitJson = await submitRes.json();

    if (!submitRes.ok) {
      const errMsg =
        submitJson?.error || submitJson?.message || submitRes.statusText || "Submit failed";
      if (hasInsufficientCreditsMessage(errMsg)) {
        throw new HumanizerInsufficientCreditsError();
      }
      if (submitRes.status === 401) {
        throw new Error("Invalid API key");
      }
      throw new Error(errMsg);
    }

    const docId = submitJson?.id;
    if (!docId) {
      throw new Error("No document ID returned from humanizer");
    }

    let output: string | undefined;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const docRes = await fetch(`${config.baseUrl}/document`, {
        method: "POST",
        headers: {
          apikey: config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: docId }),
      });

      const docJson = await docRes.json();

      if (!docRes.ok) {
        const documentError = docJson?.error || docJson?.message || "Failed to retrieve document";
        if (hasInsufficientCreditsMessage(documentError)) {
          throw new HumanizerInsufficientCreditsError();
        }
        console.error("[humanizer] Document fetch failed with status:", docRes.status);
        throw new Error(documentError);
      }

      if (docJson.output != null && docJson.output !== "") {
        output = docJson.output;
        break;
      }
    }

    if (output == null || output === "") {
      throw new Error("Humanization timed out - no output received");
    }

    const wordsUsed = output.split(/\s+/).filter(Boolean).length;
    return { text: output, wordsUsed, provider: "undetectable" };
  }
}

/** OpenAI-backed BetterWords 2.1.2 quality rewrite fallback. */
export class BetterWordsHumanizerClient implements HumanizerService {
  async humanize(text: string): Promise<HumanizeResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { text, wordsUsed: 0, provider: "betterwords" };
    }

    const inputWords = trimmed.match(/[\p{L}\p{N}]+(?:[’'ʼ-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    const maxCompletionTokens = Math.min(4000, Math.max(1200, inputWords * 5));
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: BETTERWORDS_MODEL,
      messages: [
        { role: "system", content: BETTERWORDS_REWRITE_SYSTEM_PROMPT },
        { role: "user", content: buildBetterWordsRewriteInput(trimmed) },
      ],
      max_completion_tokens: maxCompletionTokens,
    });

    const output = completion.choices[0]?.message?.content?.trim() || "";
    if (!output) {
      throw new Error("BetterWords fallback returned empty content");
    }

    const requiredTokens = new Set(
      trimmed.match(/\b(?:LINKREF|QUOTEREF|BRANDREF)\d{3}\b/g) ?? []
    );
    const missingTokens = Array.from(requiredTokens).filter((token) => !output.includes(token));
    if (missingTokens.length > 0) {
      throw new Error("BetterWords fallback dropped protected reference tokens");
    }

    const usage = completion.usage as {
      prompt_tokens?: number;
      completion_tokens?: number;
    } | undefined;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    if (inputTokens > 0 || outputTokens > 0) {
      getCostTracker().trackOpenAIChat(BETTERWORDS_MODEL, inputTokens, outputTokens);
    }

    const wordsUsed = output.match(/[\p{L}\p{N}]+(?:[’'ʼ-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    return { text: output, wordsUsed, provider: "betterwords" };
  }
}

class ResilientHumanizerService implements HumanizerService {
  private creditsExhausted = false;
  private fallbackNoticeLogged = false;

  constructor(
    private readonly primary: HumanizerService,
    private readonly fallback: HumanizerService,
  ) {}

  async humanize(text: string, options?: HumanizeOptions): Promise<HumanizeResult> {
    if (this.creditsExhausted) {
      return this.fallback.humanize(text, options);
    }

    try {
      const result = await this.primary.humanize(text, options);
      return result;
    } catch (error) {
      if (!isInsufficientCreditsError(error)) throw error;
      this.creditsExhausted = true;
      if (!this.fallbackNoticeLogged) {
        console.warn("[humanizer] Undetectable.AI credits exhausted; using BetterWords 2.1.2 fallback.");
        this.fallbackNoticeLogged = true;
      }
      return this.fallback.humanize(text, options);
    }
  }
}

export function createResilientHumanizerService(
  primary: HumanizerService,
  fallback: HumanizerService,
): HumanizerService {
  return new ResilientHumanizerService(primary, fallback);
}

/** Create one fallback circuit for one request/job. */
export function createHumanizerService(): HumanizerService {
  return createResilientHumanizerService(
    new UndetectableHumanizerClient(),
    new BetterWordsHumanizerClient()
  );
}

let humanizerInstance: HumanizerService | null = null;

export function getHumanizerService(): HumanizerService {
  if (!humanizerInstance) {
    humanizerInstance = createHumanizerService();
  }
  return humanizerInstance;
}
