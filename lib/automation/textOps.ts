// lib/automation/textOps.ts
// Block-level text operations for the automation API: selective humanization
// and AI detection of caller-supplied paragraphs. Both run synchronously
// (no queue), under the same per-call cost cap, daily/monthly usage limits
// and Undetectable.AI balance rules as generation jobs.

import { AutomationValidationError } from "@/lib/automation/validate";
import {
  HARD_JOB_COST_CEILING_USD,
  cancelAutomationCostReservation,
  maxJobCostUsd,
  reserveAutomationCost,
  rethrowAutomationBudgetError,
  runWithAutomationBudget,
  settleAutomationCost,
} from "@/lib/automation/budget";
import { estimateHumanizeCost, getCostTracker, runWithIsolatedCostTracker } from "@/lib/costTracker";
import { getUndetectableCredits, isUndetectableConfigured } from "@/lib/undetectableCredits";
import { detectText, estimateDetectCost, type DetectionResult } from "@/lib/undetectableDetector";
import { humanizeSectionText } from "@/lib/sectionHumanize";
import { BetterWordsHumanizerClient, createHumanizerService } from "@/lib/humanizerClient";
import { calculateOpenAIChatCost } from "@/lib/costTracker";
import { getTextProviderConfig } from "@/lib/textProvider";
import type { AutomationHumanizerPreference } from "@/lib/automation/types";

export const TEXT_OPS_MAX_BLOCKS = 60;
export const TEXT_OPS_MAX_BLOCK_CHARS = 10_000;
export const TEXT_OPS_MAX_TOTAL_WORDS = 6_000;
/** Blocks shorter than this are skipped by the humanizer (same rule as generation). */
export const HUMANIZE_MIN_BLOCK_CHARS = 100;
/** Detector accuracy drops sharply below this; the result is flagged, not withheld. */
export const DETECT_RELIABLE_MIN_WORDS = 50;
const WORDS_MARGIN = 1.1;

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:[’'ʼ-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function parseBlocks(body: Record<string, unknown>): string[] {
  const raw = body.blocks;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AutomationValidationError("Missing required field: blocks (non-empty array of strings).", { field: "blocks" });
  }
  if (raw.length > TEXT_OPS_MAX_BLOCKS) {
    throw new AutomationValidationError(`Too many blocks. Maximum is ${TEXT_OPS_MAX_BLOCKS} per call.`, { field: "blocks" });
  }
  const blocks = raw.map((value, index) => {
    if (typeof value !== "string") {
      throw new AutomationValidationError(`blocks[${index}] must be a string.`, { field: "blocks" });
    }
    if (value.length > TEXT_OPS_MAX_BLOCK_CHARS) {
      throw new AutomationValidationError(`blocks[${index}] exceeds ${TEXT_OPS_MAX_BLOCK_CHARS} characters. Split it by paragraphs.`, { field: "blocks" });
    }
    return value;
  });
  const totalWords = blocks.reduce((sum, block) => sum + countWords(block), 0);
  if (totalWords > TEXT_OPS_MAX_TOTAL_WORDS) {
    throw new AutomationValidationError(`Total words ${totalWords} exceed the ${TEXT_OPS_MAX_TOTAL_WORDS}-word limit per call.`, { field: "blocks" });
  }
  return blocks;
}

function parseCap(body: Record<string, unknown>): number {
  if (body.maxCostUsd === undefined || body.maxCostUsd === null) return maxJobCostUsd();
  const requested = Number(body.maxCostUsd);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new AutomationValidationError("Invalid maxCostUsd. Expected a positive number of USD.", { field: "maxCostUsd" });
  }
  if (requested > HARD_JOB_COST_CEILING_USD) {
    throw new AutomationValidationError(`Invalid maxCostUsd. The server-side ceiling is $${HARD_JOB_COST_CEILING_USD.toFixed(2)} per call.`, { field: "maxCostUsd" });
  }
  return requested;
}

function parseStringList(body: Record<string, unknown>, field: string, maxItems: number): string[] {
  const raw = body[field];
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) {
    throw new AutomationValidationError(`Invalid ${field}. Expected an array of strings.`, { field });
  }
  if (raw.length > maxItems) {
    throw new AutomationValidationError(`Invalid ${field}. Maximum ${maxItems} entries.`, { field });
  }
  return (raw as string[]).map((v) => v.trim()).filter(Boolean);
}

// ───────────────────────────── Humanize ─────────────────────────────

export interface HumanizeBlocksRequest {
  blocks: string[];
  humanizer: AutomationHumanizerPreference;
  frozenPhrases: string[];
  /** 0 Quality, 1 Balanced, 2 More Human (default). */
  model: number;
  maxCostUsd: number;
}

export function validateHumanizeBlocksRequest(input: unknown): HumanizeBlocksRequest {
  const body = (input && typeof input === "object" ? input : null) as Record<string, unknown> | null;
  if (!body) throw new AutomationValidationError("Request body must be a JSON object.");
  const blocks = parseBlocks(body);
  const humanizer = body.humanizer === undefined || body.humanizer === null ? "auto" : body.humanizer;
  if (humanizer !== "auto" && humanizer !== "undetectable" && humanizer !== "betterwords") {
    throw new AutomationValidationError('Invalid humanizer. Expected "auto", "undetectable", or "betterwords".', {
      field: "humanizer",
      allowed: ["auto", "undetectable", "betterwords"],
    });
  }
  const frozenPhrases = parseStringList(body, "frozenPhrases", 40);
  for (const field of ["brand", "anchor"]) {
    const value = body[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== "string") throw new AutomationValidationError(`Invalid ${field}. Expected a string.`, { field });
      if (value.trim()) frozenPhrases.push(value.trim());
    }
  }
  const model = body.model === undefined || body.model === null ? 2 : Number(body.model);
  if (![0, 1, 2].includes(model)) {
    throw new AutomationValidationError("Invalid model. Expected 0 (Quality), 1 (Balanced) or 2 (More Human).", { field: "model" });
  }
  return { blocks, humanizer, frozenPhrases: [...new Set(frozenPhrases)], model, maxCostUsd: parseCap(body) };
}

export interface HumanizeBlocksPreflight {
  resolved: "undetectable" | "betterwords";
  wordsToHumanize: number;
  wordsNeeded: number;
  estimatedCostUsd: { min: number; max: number };
  undetectableCredits: number | null;
  error?: { code: string; message: string };
}

/** Same balance/credit rules as generation, applied to the blocks' real word count. */
export async function preflightHumanizeBlocks(request: HumanizeBlocksRequest): Promise<HumanizeBlocksPreflight> {
  const wordsToHumanize = request.blocks
    .filter((block) => block.trim().length >= HUMANIZE_MIN_BLOCK_CHARS)
    .reduce((sum, block) => sum + countWords(block), 0);
  const wordsNeeded = Math.ceil(wordsToHumanize * WORDS_MARGIN);
  const betterWordsEstimate = calculateOpenAIChatCost(
    getTextProviderConfig().model,
    Math.ceil(wordsToHumanize * 1.6),
    Math.ceil(wordsToHumanize * 1.5),
    0
  );
  const base = { wordsToHumanize, wordsNeeded };

  if (request.humanizer === "betterwords") {
    return { ...base, resolved: "betterwords", undetectableCredits: null, estimatedCostUsd: { min: betterWordsEstimate, max: betterWordsEstimate } };
  }
  const configured = isUndetectableConfigured();
  const balance = configured ? await getUndetectableCredits() : null;
  const credits = balance?.credits ?? null;
  const funded = credits !== null && credits >= wordsNeeded;
  const undetectableEstimate = estimateHumanizeCost(wordsNeeded);

  if (request.humanizer === "undetectable") {
    if (!configured) {
      return { ...base, resolved: "undetectable", undetectableCredits: null, estimatedCostUsd: { min: undetectableEstimate, max: undetectableEstimate }, error: { code: "humanizer_not_configured", message: 'humanizer: "undetectable" requires UNDETECTABLE_HUMANIZER_API_KEY on the server. Nothing was charged.' } };
    }
    if (credits === null) {
      return { ...base, resolved: "undetectable", undetectableCredits: null, estimatedCostUsd: { min: undetectableEstimate, max: undetectableEstimate }, error: { code: "humanizer_balance_unavailable", message: "Undetectable.AI balance could not be verified. Retry, or use humanizer: \"auto\" / \"betterwords\". Nothing was charged." } };
    }
    if (!funded) {
      return { ...base, resolved: "undetectable", undetectableCredits: credits, estimatedCostUsd: { min: undetectableEstimate, max: undetectableEstimate }, error: { code: "humanizer_credits_insufficient", message: `Undetectable.AI balance is ${credits} words; these blocks need about ${wordsNeeded}. Top up, send fewer blocks, or use humanizer: "betterwords". Nothing was charged.` } };
    }
    return { ...base, resolved: "undetectable", undetectableCredits: credits, estimatedCostUsd: { min: undetectableEstimate, max: undetectableEstimate } };
  }
  // auto
  return funded
    ? { ...base, resolved: "undetectable", undetectableCredits: credits, estimatedCostUsd: { min: undetectableEstimate, max: undetectableEstimate } }
    : { ...base, resolved: "betterwords", undetectableCredits: credits, estimatedCostUsd: { min: betterWordsEstimate, max: betterWordsEstimate } };
}

export interface HumanizedBlock {
  index: number;
  text: string;
  humanized: boolean;
  provider: "undetectable" | "betterwords" | null;
  wordsUsed: number;
  /** Set when the block was skipped or failed and the original text is returned. */
  reason?: "too_short" | "empty" | "humanizer_error";
}

export interface HumanizeBlocksOutcome {
  blocks: HumanizedBlock[];
  costUsd: number;
  undetectableWordsUsed: number;
  betterWordsWordsUsed: number;
  error?: unknown;
}

export async function runHumanizeBlocks(
  callId: string,
  request: HumanizeBlocksRequest,
  resolved: "undetectable" | "betterwords"
): Promise<HumanizeBlocksOutcome> {
  const humanizer = resolved === "betterwords" ? new BetterWordsHumanizerClient() : createHumanizerService();
  const results: HumanizedBlock[] = new Array(request.blocks.length);
  const BATCH_SIZE = 5;

  const budgetRun = await runWithAutomationBudget(callId, () => runWithIsolatedCostTracker(async () => {
    // Probe: the whole call must fit the cap before the first paid submit.
    const probe = reserveAutomationCost(
      "undetectable_humanize_total",
      resolved === "undetectable"
        ? estimateHumanizeCost(request.blocks.reduce((sum, block) => sum + countWords(block), 0))
        : 0
    );
    cancelAutomationCostReservation(probe);

    const tasks = request.blocks.map((block, index) => async () => {
      const text = block.trim();
      if (!text) {
        results[index] = { index, text: block, humanized: false, provider: null, wordsUsed: 0, reason: "empty" };
        return;
      }
      if (text.length < HUMANIZE_MIN_BLOCK_CHARS) {
        results[index] = { index, text: block, humanized: false, provider: null, wordsUsed: 0, reason: "too_short" };
        return;
      }
      try {
        const result = await humanizeSectionText(text, request.model, "", request.frozenPhrases, "Blog", "Autopilot", undefined, humanizer);
        const changed = result.wordsUsed > 0 && result.humanizedText.trim() !== text;
        results[index] = {
          index,
          text: changed ? result.humanizedText : block,
          humanized: changed,
          provider: changed ? (result.undetectableWordsUsed > 0 ? "undetectable" : "betterwords") : null,
          wordsUsed: result.wordsUsed,
          reason: changed ? undefined : "humanizer_error",
        };
      } catch (error) {
        rethrowAutomationBudgetError(error);
        results[index] = { index, text: block, humanized: false, provider: null, wordsUsed: 0, reason: "humanizer_error" };
      }
    });
    for (let start = 0; start < tasks.length; start += BATCH_SIZE) {
      await Promise.all(tasks.slice(start, start + BATCH_SIZE).map((task) => task()));
    }
    return getCostTracker().getTotalCosts().total;
  }), { capUsd: request.maxCostUsd });

  const filled = results.map((r, index) => r ?? { index, text: request.blocks[index], humanized: false, provider: null as null, wordsUsed: 0, reason: "humanizer_error" as const });
  let undetectableWordsUsed = 0;
  let betterWordsWordsUsed = 0;
  for (const block of filled) {
    if (block.provider === "undetectable") undetectableWordsUsed += block.wordsUsed;
    if (block.provider === "betterwords") betterWordsWordsUsed += block.wordsUsed;
  }
  return {
    blocks: filled,
    costUsd: budgetRun.snapshot.costUsd,
    undetectableWordsUsed,
    betterWordsWordsUsed,
    error: budgetRun.error,
  };
}

// ───────────────────────────── Detect ─────────────────────────────

export interface DetectBlocksRequest {
  blocks: string[];
  maxCostUsd: number;
}

export function validateDetectBlocksRequest(input: unknown): DetectBlocksRequest {
  const body = (input && typeof input === "object" ? input : null) as Record<string, unknown> | null;
  if (!body) throw new AutomationValidationError("Request body must be a JSON object.");
  return { blocks: parseBlocks(body), maxCostUsd: parseCap(body) };
}

export interface DetectedBlock {
  index: number;
  words: number;
  /** null when the block was empty or the detector failed for it. */
  score: number | null;
  label: "AI" | "HUMAN" | "unknown";
  /** Vendor threshold: score > 60. */
  flagged: boolean;
  /** Under DETECT_RELIABLE_MIN_WORDS words — treat the score as a hint only. */
  unreliable: boolean;
  human: number | null;
  details: DetectionResult["details"];
  error?: string;
}

export interface DetectBlocksOutcome {
  blocks: DetectedBlock[];
  wordsChecked: number;
  creditsUsed: number;
  costUsd: number;
  error?: unknown;
}

export async function runDetectBlocks(callId: string, request: DetectBlocksRequest): Promise<DetectBlocksOutcome> {
  const results: DetectedBlock[] = new Array(request.blocks.length);
  const BATCH_SIZE = 5;
  let wordsChecked = 0;

  const budgetRun = await runWithAutomationBudget(callId, () => runWithIsolatedCostTracker(async () => {
    const tasks = request.blocks.map((block, index) => async () => {
      const text = block.trim();
      const words = countWords(text);
      if (!text || words === 0) {
        results[index] = { index, words: 0, score: null, label: "unknown", flagged: false, unreliable: true, human: null, details: null, error: "empty" };
        return;
      }
      const reservation = reserveAutomationCost("undetectable_detect", estimateDetectCost(words));
      try {
        const detection = await detectText(text);
        const cost = estimateDetectCost(words);
        getCostTracker().trackHumanize(0, cost);
        settleAutomationCost(reservation, "undetectable_detect", cost);
        wordsChecked += words;
        results[index] = {
          index,
          words,
          score: detection.score,
          label: detection.score > 60 ? "AI" : "HUMAN",
          flagged: detection.score > 60,
          unreliable: words < DETECT_RELIABLE_MIN_WORDS,
          human: detection.human,
          details: detection.details,
        };
      } catch (error) {
        rethrowAutomationBudgetError(error);
        cancelAutomationCostReservation(reservation);
        results[index] = { index, words, score: null, label: "unknown", flagged: false, unreliable: true, human: null, details: null, error: error instanceof Error ? error.message : String(error) };
      }
    });
    for (let start = 0; start < tasks.length; start += BATCH_SIZE) {
      await Promise.all(tasks.slice(start, start + BATCH_SIZE).map((task) => task()));
    }
  }), { capUsd: request.maxCostUsd });

  const filled = results.map((r, index) => r ?? { index, words: countWords(request.blocks[index]), score: null, label: "unknown" as const, flagged: false, unreliable: true, human: null, details: null, error: "not_processed" });
  return {
    blocks: filled,
    wordsChecked,
    creditsUsed: Math.round(wordsChecked / 10),
    costUsd: budgetRun.snapshot.costUsd,
    error: budgetRun.error,
  };
}
