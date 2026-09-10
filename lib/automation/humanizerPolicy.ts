import { estimateHumanizeCost } from "@/lib/costTracker";
import { getUndetectableCredits, isUndetectableConfigured } from "@/lib/undetectableCredits";
import type {
  AutomationGenerateRequest,
  AutomationHumanizerResolved,
} from "@/lib/automation/types";

export interface HumanizerResolution {
  resolved: AutomationHumanizerResolved;
  /** Words the humanizer is expected to bill for this request (upper bound). */
  wordsNeeded: number;
  /** Live Undetectable.AI balance, null when unknown (no key / lookup failed). */
  undetectableCredits: number | null;
  /** Set when the request cannot be honoured as asked — reject before queueing. */
  error?: { code: string; message: string };
}

/** Safety margin over maxWords: headings, list items and repairs add a little. */
const WORDS_MARGIN = 1.1;

/**
 * Decide which rewrite provider a human-mode job will use BEFORE it is
 * queued, from the live Undetectable.AI balance:
 *
 * - `betterwords`   → never touches Undetectable.
 * - `undetectable`  → must be configured and funded for the whole article,
 *                     otherwise `humanizer_credits_insufficient` (nothing queued).
 * - `auto`          → Undetectable when funded, BetterWords otherwise.
 *
 * The decision is stored on the job (`humanizerResolved`) so the runtime
 * never re-decides per block and the cost estimate matches what runs.
 */
export async function resolveHumanizerForRequest(
  request: AutomationGenerateRequest
): Promise<HumanizerResolution> {
  const wordsNeeded = Math.ceil((request.maxWords || 1800) * WORDS_MARGIN);
  if (request.mode !== "human") {
    return { resolved: "none", wordsNeeded: 0, undetectableCredits: null };
  }
  if (request.humanizer === "betterwords") {
    return { resolved: "betterwords", wordsNeeded, undetectableCredits: null };
  }

  const configured = isUndetectableConfigured();
  const balance = configured ? await getUndetectableCredits() : null;
  const credits = balance?.credits ?? null;
  const funded = credits !== null && credits >= wordsNeeded;

  if (request.humanizer === "undetectable") {
    if (!configured) {
      return {
        resolved: "undetectable",
        wordsNeeded,
        undetectableCredits: null,
        error: {
          code: "humanizer_not_configured",
          message: "humanizer: \"undetectable\" requires UNDETECTABLE_HUMANIZER_API_KEY on the server. Nothing was queued.",
        },
      };
    }
    if (credits === null) {
      return {
        resolved: "undetectable",
        wordsNeeded,
        undetectableCredits: null,
        error: {
          code: "humanizer_balance_unavailable",
          message: "Undetectable.AI balance could not be verified. Retry, or use humanizer: \"auto\" / \"betterwords\". Nothing was queued.",
        },
      };
    }
    if (!funded) {
      return {
        resolved: "undetectable",
        wordsNeeded,
        undetectableCredits: credits,
        error: {
          code: "humanizer_credits_insufficient",
          message: `Undetectable.AI balance is ${credits} words; this job needs about ${wordsNeeded} (maxWords × ${WORDS_MARGIN}, ~$${estimateHumanizeCost(wordsNeeded).toFixed(2)}). Top up, lower maxWords, or use humanizer: "betterwords". Nothing was queued.`,
        },
      };
    }
    return { resolved: "undetectable", wordsNeeded, undetectableCredits: credits };
  }

  // auto
  return {
    resolved: funded ? "undetectable" : "betterwords",
    wordsNeeded,
    undetectableCredits: credits,
  };
}
