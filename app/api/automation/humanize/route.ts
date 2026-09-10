import { requireAutomationAuth } from "@/lib/automation/auth";
import { AutomationValidationError } from "@/lib/automation/validate";
import type { AutomationErrorResponse } from "@/lib/automation/types";
import { AutomationCostCapError, AutomationRetryLimitError } from "@/lib/automation/budget";
import { UpstreamNoCreditsError } from "@/lib/textProvider";
import {
  automationApiKeyId,
  finalizeAutomationUsage,
  releaseAutomationUsageReservation,
  reserveAutomationUsage,
} from "@/lib/automation/usageStore";
import {
  preflightHumanizeBlocks,
  runHumanizeBlocks,
  validateHumanizeBlocksRequest,
} from "@/lib/automation/textOps";

export const maxDuration = 300;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * POST /api/automation/humanize — selective humanization of caller-supplied
 * paragraphs (e.g. only the ones an AI detector flagged). Synchronous; same
 * Bearer auth, cost cap, usage limits and Undetectable.AI balance rules as
 * generation. Returns every block in order; blocks that were skipped or
 * failed come back unchanged with a `reason`.
 */
export async function POST(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) return json(authError, authError.code === "unauthorized" ? 401 : 500);

  let request;
  try {
    request = validateHumanizeBlocksRequest(await req.json());
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

  const preflight = await preflightHumanizeBlocks(request);
  if (preflight.error) {
    return json({ status: "error", ...preflight.error, undetectableCredits: preflight.undetectableCredits }, 422);
  }
  if (preflight.estimatedCostUsd.min > request.maxCostUsd) {
    return json({
      status: "error",
      code: "estimated_cost_exceeds_cap",
      message: `Estimated cost $${preflight.estimatedCostUsd.min.toFixed(2)} for ${preflight.wordsToHumanize} words exceeds the $${request.maxCostUsd.toFixed(2)} cap. Nothing was charged. Raise maxCostUsd (ceiling $2.00), send fewer blocks, or use humanizer: "betterwords".`,
      estimatedCostUsd: preflight.estimatedCostUsd,
    }, 422);
  }
  if (preflight.wordsToHumanize === 0) {
    return json({
      status: "error",
      code: "nothing_to_humanize",
      message: `Every block is shorter than 100 characters; the humanizer skips such blocks. Nothing was charged.`,
    }, 422);
  }

  const callId = `hum_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const usage = await reserveAutomationUsage(automationApiKeyId(req), callId, request.maxCostUsd);
  if (!usage.ok) return json({ status: "error", code: usage.code, message: usage.message }, 429);

  let outcome;
  try {
    outcome = await runHumanizeBlocks(callId, request, preflight.resolved);
  } catch (error) {
    await releaseAutomationUsageReservation(callId);
    console.error("[automationHumanize] Unexpected failure:", error);
    return json({ status: "error", code: "humanize_failed", message: "Humanization failed before any block was processed." }, 500);
  }
  await finalizeAutomationUsage(callId, outcome.costUsd);

  if (outcome.error) {
    const error = outcome.error;
    const code = error instanceof AutomationCostCapError || error instanceof AutomationRetryLimitError || error instanceof UpstreamNoCreditsError
      ? error.code
      : "humanize_failed";
    return json({
      status: "error",
      code,
      message: error instanceof Error ? error.message : "Humanization failed.",
      costUsd: outcome.costUsd,
      blocks: outcome.blocks,
    }, code === "cost_cap_exceeded" ? 422 : 500);
  }

  return json({
    status: "ok",
    callId,
    blocks: outcome.blocks,
    meta: {
      humanizer: preflight.resolved,
      blocksTotal: outcome.blocks.length,
      blocksHumanized: outcome.blocks.filter((block) => block.humanized).length,
      undetectableWordsUsed: outcome.undetectableWordsUsed,
      betterWordsWordsUsed: outcome.betterWordsWordsUsed,
      costUsd: outcome.costUsd,
      undetectableCreditsBefore: preflight.undetectableCredits,
    },
  }, 200);
}
