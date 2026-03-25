// lib/humanizerClient.ts
// Undetectable.AI Humanization API v2 client
// Docs: https://help.undetectable.ai/en/article/humanization-api-v2-p28b2n/

import { getHumanizerConfig } from "@/lib/config";

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
}

/** Single interface for humanization - swap providers without changing callers */
export interface HumanizerService {
  humanize(text: string, options?: HumanizeOptions): Promise<HumanizeResult>;
}

const MIN_TEXT_LENGTH = 50;
const MAX_TEXT_LENGTH = 10000;
const POLL_INTERVAL_MS = 6000;
const MAX_POLL_ATTEMPTS = 40; // ~4 min max wait (must stay under Vercel 300s maxDuration)

function modelToStrength(model?: number): "Quality" | "Balanced" | "More Human" {
  if (model === 0) return "Quality";
  if (model === 2) return "More Human";
  return "Balanced";
}

/**
 * Undetectable.AI Humanization API v2 client.
 * Submit → poll /document until output is ready.
 */
class UndetectableHumanizerClient implements HumanizerService {
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
      if (submitRes.status === 402) {
        throw new Error("Insufficient credits");
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
        console.error("[humanizer] Document fetch error:", docRes.status, docJson);
        throw new Error(docJson?.error || docJson?.message || "Failed to retrieve document");
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
    return { text: output, wordsUsed };
  }
}

let humanizerInstance: HumanizerService | null = null;

export function getHumanizerService(): HumanizerService {
  if (!humanizerInstance) {
    humanizerInstance = new UndetectableHumanizerClient();
  }
  return humanizerInstance;
}
