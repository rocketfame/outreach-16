import {
  calculateOpenAIChatCost,
  estimateHumanizeCost,
  estimateOpenAIChatCost,
  estimateOpenAIImageCost,
  estimateTavilySearchCost,
  estimateTextTokens,
} from "@/lib/costTracker";
import { getTextProviderConfig } from "@/lib/textProvider";
import { buildArticlePrompt } from "@/lib/articlePrompt";
import type {
  AutomationCostEstimate,
  AutomationCoverRequest,
  AutomationGenerateRequest,
} from "@/lib/automation/types";

function round(value: number): number {
  return Number(value.toFixed(4));
}

function resolvedImageQuality(value: string): "low" | "medium" | "high" {
  const requested = value.trim().toLowerCase();
  if (requested === "low" || requested === "medium" || requested === "high") {
    return requested;
  }
  const configured = (process.env.HERO_IMAGE_QUALITY || "medium").trim().toLowerCase();
  return configured === "low" || configured === "high" ? configured : "medium";
}

/** Two basic-depth Tavily searches; $0.00 when the 7-day source cache hits. */
export const SOURCE_STAGE_MAX_USD = round(estimateTavilySearchCost("basic", 2));

/** Small-model source-policy classification of up to 6 candidates. */
const CLASSIFICATION_MIN_USD = 0.005;
const CLASSIFICATION_MAX_USD = 0.03;

/** Approximate size of the article route's system message. */
const SYSTEM_MESSAGE_APPROX_CHARS = 2200;
/** Placeholder trust source mirroring the pipeline's 400-char snippet cap. */
const SYNTHETIC_SOURCE = `Example Research Source|https://example-research-source.org/reports/annual|${"x".repeat(400)}`;

/**
 * Mirror of the article route's completion budget
 * (app/api/articles/route.ts): ~1.5 tokens/word for Latin scripts, 2.5
 * otherwise, 3x headroom for reasoning/JSON, floor 6000. Keep in sync.
 */
function generationTokenBudget(targetWords: number, language: string): {
  contentBudget: number;
  dynamicMaxTokens: number;
} {
  const tokensPerWord = /^(English|Spanish|French|Italian|Portuguese)$/i.test(language) ? 1.5 : 2.5;
  const contentBudget = Math.ceil(targetWords * tokensPerWord);
  return { contentBudget, dynamicMaxTokens: Math.max(6000, Math.ceil(contentBudget * 3)) };
}

/** Input-token estimate for the generation call, built from the REAL prompt template. */
function generationInputTokens(request: AutomationGenerateRequest, targetWords: number): number {
  let promptChars: number;
  try {
    const prompt = buildArticlePrompt({
      topicTitle: request.topic || `How to grow on ${request.category} in the ${request.niche} niche`,
      topicBrief: `${request.topic || ""}\n${request.brief || ""}`.trim() || "Practical growth guide.",
      mainPlatform: request.category,
      niche: request.niche,
      contentPurpose: "Guest post / outreach",
      anchorText: request.anchor,
      anchorUrl: request.anchorUrl,
      brandName: request.brand || "NONE",
      keywordList: [],
      trustSourcesList: Array.from({ length: 6 }, () => SYNTHETIC_SOURCE),
      language: request.language,
      targetAudience: "creators",
      wordCount: String(targetWords),
      writingMode: request.mode === "human" ? "human" : "seo",
    });
    promptChars = prompt.length;
  } catch {
    // The estimator must never block submission — fall back to the measured
    // template magnitude if prompt construction rejects an edge-case input.
    promptChars = 160_000 + (request.brief?.length || 0);
  }
  return estimateTextTokens("x".repeat(promptChars + SYSTEM_MESSAGE_APPROX_CHARS));
}

/**
 * Honest pre-queue forecast: `max` mirrors the runtime worst-case
 * reservations (uncached input, full completion ceiling, Undetectable.AI
 * humanization at metered price), `min` is a realistic cheap run (warm
 * source cache, warm OpenAI prompt cache, BetterWords-class humanization).
 * The runtime meter remains authoritative.
 */
export function estimateAutomationRequestCost(
  request: AutomationGenerateRequest
): AutomationCostEstimate {
  // The humanizer is resolved at submit time (lib/automation/humanizerPolicy.ts).
  // Legacy stored jobs without humanizerResolved are estimated at the
  // Undetectable price — the honest worst case.
  const humanizer = request.mode === "human"
    ? (request.humanizerResolved && request.humanizerResolved !== "none" ? request.humanizerResolved : "undetectable")
    : "none";
  const model = getTextProviderConfig().model;
  const targetWords = Math.round((request.minWords + (request.maxWords || 1800)) / 2);
  const inputTokens = generationInputTokens(request, targetWords);
  const { contentBudget, dynamicMaxTokens } = generationTokenBudget(targetWords, request.language);

  // Worst case = exactly what reserveAutomationCost will demand.
  const generationMax = estimateOpenAIChatCost(model, inputTokens, dynamicMaxTokens);
  // Cheap case: fully cached prompt prefix, content plus modest reasoning.
  const expectedOutputTokens = Math.ceil(contentBudget * 1.3);
  const generationMin = calculateOpenAIChatCost(model, inputTokens, expectedOutputTokens, inputTokens);

  let humanizeMin = 0;
  let humanizeMax = 0;
  if (humanizer === "undetectable") {
    // Undetectable.AI meters ~$0.0005/word on the humanizable body. Both
    // bounds use the metered price: a job that resolved to Undetectable must
    // be able to afford it, otherwise the cap would kill it mid-humanization
    // AFTER credits were spent on the first blocks.
    humanizeMin = estimateHumanizeCost(targetWords);
    humanizeMax = estimateHumanizeCost(request.maxWords || 1800);
  } else if (humanizer === "betterwords") {
    // BetterWords re-generates the text through the text provider instead.
    humanizeMin = calculateOpenAIChatCost(
      model,
      Math.ceil(request.minWords * 1.6),
      Math.ceil(request.minWords * 1.5),
      0
    );
    humanizeMax = calculateOpenAIChatCost(
      model,
      Math.ceil((request.maxWords || 1800) * 1.6),
      Math.ceil((request.maxWords || 1800) * 1.5),
      0
    );
  }

  const image = request.image
    ? estimateOpenAIImageCost("gpt-image-2", "1536x864", resolvedImageQuality(request.imageQuality))
    : 0;

  return {
    min: round(CLASSIFICATION_MIN_USD + generationMin + humanizeMin + image),
    max: round(SOURCE_STAGE_MAX_USD + CLASSIFICATION_MAX_USD + generationMax + humanizeMax + image),
  };
}

export function estimateCoverRequestCost(request: AutomationCoverRequest): number {
  return round(
    estimateOpenAIImageCost("gpt-image-2", "1536x864", resolvedImageQuality(request.imageQuality))
  );
}
