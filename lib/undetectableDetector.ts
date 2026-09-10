// lib/undetectableDetector.ts
// Undetectable.AI text detector (submit + poll). Billed from the same word
// balance as the humanizer at 1/10 of the humanize price: 0.1 credit per
// word (verified live 2026-09-10: 100 words → 10 credits).
// Docs: https://help.undetectable.ai/en/article/detector-api-1cf74il/

const DETECT_BASE_URL = "https://ai-detect.undetectable.ai";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 30; // ~90s

/** USD per word: humanize $0.0005 / 10. */
export const DETECT_COST_PER_WORD_USD = 0.00005;

export interface DetectionResult {
  /** 0-100; under 50 human, 50-60 possible AI, over 60 AI (vendor scale). */
  score: number;
  label: "AI" | "HUMAN" | string;
  /** Vendor's human-ness percentage. */
  human: number | null;
  details: Record<string, number> | null;
  /** advanced / standard / free detector tiers, 0-100. */
  categories: Record<string, number> | null;
}

interface DetectQueryJson {
  status?: string;
  result?: number | null;
  label?: string;
  result_details?: Record<string, number> & { human?: number };
  result_categories?: Record<string, number>;
  error?: string;
}

export function estimateDetectCost(words: number): number {
  return Math.max(0, words) * DETECT_COST_PER_WORD_USD;
}

function apiKey(): string {
  const key = process.env.UNDETECTABLE_HUMANIZER_API_KEY;
  if (!key) throw new Error("Missing UNDETECTABLE_HUMANIZER_API_KEY");
  return key;
}

/**
 * Detect one text. Throws on a hard API error; transient poll errors are
 * retried within the attempt budget (the submission is already billed).
 */
export async function detectText(text: string): Promise<DetectionResult> {
  const key = apiKey();
  const submitRes = await fetch(`${DETECT_BASE_URL}/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", apikey: key },
    body: JSON.stringify({ text, key, model: "xlm_ud_detector", retry_count: 0 }),
    signal: AbortSignal.timeout(20_000),
  });
  const submitJson = (await submitRes.json().catch(() => null)) as
    | { id?: string; error?: string; message?: string; status?: string }
    | null;
  if (!submitRes.ok || !submitJson?.id) {
    const message = submitJson?.error || submitJson?.message || `Detector submit failed (${submitRes.status})`;
    throw new Error(message);
  }

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let json: DetectQueryJson | null = null;
    try {
      const res = await fetch(`${DETECT_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", apikey: key },
        body: JSON.stringify({ id: submitJson.id, key }),
        signal: AbortSignal.timeout(15_000),
      });
      json = (await res.json().catch(() => null)) as DetectQueryJson | null;
      if (!res.ok) {
        if (res.status >= 500 || res.status === 429) continue;
        throw new Error(json?.error || `Detector query failed (${res.status})`);
      }
    } catch (error) {
      if (error instanceof Error && /Detector query failed/.test(error.message)) throw error;
      continue; // transient network error — polling is free
    }
    if (json?.status === "done" && typeof json.result === "number") {
      const { human, ...rest } = json.result_details || {};
      return {
        score: json.result,
        label: json.label || (json.result > 60 ? "AI" : "HUMAN"),
        human: typeof human === "number" ? human : null,
        details: Object.keys(rest).length > 0 ? (rest as Record<string, number>) : null,
        categories: json.result_categories || null,
      };
    }
  }
  throw new Error("Detector timed out — no result received");
}
