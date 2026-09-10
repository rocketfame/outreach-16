import { requireAutomationAuth } from "@/lib/automation/auth";
import { AutomationValidationError } from "@/lib/automation/validate";
import type { AutomationErrorResponse } from "@/lib/automation/types";
import { AutomationCostCapError } from "@/lib/automation/budget";
import {
  automationApiKeyId,
  finalizeAutomationUsage,
  releaseAutomationUsageReservation,
  reserveAutomationUsage,
} from "@/lib/automation/usageStore";
import { getUndetectableCredits, isUndetectableConfigured } from "@/lib/undetectableCredits";
import { estimateDetectCost } from "@/lib/undetectableDetector";
import {
  DETECT_RELIABLE_MIN_WORDS,
  countWords,
  runDetectBlocks,
  validateDetectBlocksRequest,
} from "@/lib/automation/textOps";

export const maxDuration = 300;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * POST /api/automation/detect — Undetectable.AI text detection per block.
 * Billed from the same word balance as the humanizer at 0.1 credit per word
 * (~$0.00005). Use it to decide WHICH paragraphs need paid humanization.
 * Blocks under 50 words come back with `unreliable: true`; group short
 * paragraphs by section before checking.
 */
export async function POST(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) return json(authError, authError.code === "unauthorized" ? 401 : 500);

  let request;
  try {
    request = validateDetectBlocksRequest(await req.json());
  } catch (error) {
    const body: AutomationErrorResponse = {
      status: "error",
      code: "invalid_request",
      message: error instanceof Error ? error.message : "Invalid request.",
    };
    if (error instanceof AutomationValidationError) {
      if (error.field) body.field = error.field;
      if (error.allowed) body.allowed = error.allowed;
    }
    return json(body, 400);
  }

  if (!isUndetectableConfigured()) {
    return json({ status: "error", code: "detector_not_configured", message: "UNDETECTABLE_HUMANIZER_API_KEY is not set on the server." }, 503);
  }
  const words = request.blocks.reduce((sum, block) => sum + countWords(block), 0);
  const creditsNeeded = Math.ceil(words / 10);
  const balance = await getUndetectableCredits();
  if (balance && balance.credits < creditsNeeded) {
    return json({
      status: "error",
      code: "detector_credits_insufficient",
      message: `Undetectable.AI balance is ${balance.credits} words; checking ${words} words needs ${creditsNeeded} credits (0.1 per word). Nothing was charged.`,
      undetectableCredits: balance.credits,
    }, 422);
  }
  const estimated = estimateDetectCost(words);
  if (estimated > request.maxCostUsd) {
    return json({ status: "error", code: "estimated_cost_exceeds_cap", message: `Estimated $${estimated.toFixed(3)} exceeds the $${request.maxCostUsd.toFixed(2)} cap. Nothing was charged.` }, 422);
  }

  const callId = `det_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const usage = await reserveAutomationUsage(automationApiKeyId(req), callId, Math.min(request.maxCostUsd, Math.max(estimated, 0.01)));
  if (!usage.ok) return json({ status: "error", code: usage.code, message: usage.message }, 429);

  let outcome;
  try {
    outcome = await runDetectBlocks(callId, request);
  } catch (error) {
    await releaseAutomationUsageReservation(callId);
    console.error("[automationDetect] Unexpected failure:", error);
    return json({ status: "error", code: "detect_failed", message: "Detection failed before any block was processed." }, 500);
  }
  await finalizeAutomationUsage(callId, outcome.costUsd);

  if (outcome.error) {
    const error = outcome.error;
    return json({
      status: "error",
      code: error instanceof AutomationCostCapError ? error.code : "detect_failed",
      message: error instanceof Error ? error.message : "Detection failed.",
      costUsd: outcome.costUsd,
      blocks: outcome.blocks,
    }, error instanceof AutomationCostCapError ? 422 : 500);
  }

  const after = await getUndetectableCredits({ fresh: true });
  return json({
    status: "ok",
    callId,
    blocks: outcome.blocks,
    meta: {
      blocksTotal: outcome.blocks.length,
      blocksFlagged: outcome.blocks.filter((block) => block.flagged).length,
      blocksUnreliable: outcome.blocks.filter((block) => block.unreliable && block.score !== null).length,
      reliableMinWords: DETECT_RELIABLE_MIN_WORDS,
      threshold: 60,
      wordsChecked: outcome.wordsChecked,
      creditsUsed: outcome.creditsUsed,
      costUsd: outcome.costUsd,
      undetectableCreditsAfter: after?.credits ?? null,
    },
  }, 200);
}
