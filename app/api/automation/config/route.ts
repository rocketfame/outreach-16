import { requireAutomationAuth } from "@/lib/automation/auth";
import {
  HARD_JOB_COST_CEILING_USD,
  maxJobCostUsd,
  maxRetriesPerJob,
} from "@/lib/automation/budget";
import { SOURCE_STAGE_MAX_USD } from "@/lib/automation/costEstimate";
import { dailyCostLimitUsd, monthlyCostLimitUsd } from "@/lib/automation/usageStore";
import {
  estimateHumanizeCost,
  estimateOpenAIChatCost,
  estimateOpenAIImageCost,
  estimateTavilySearchCost,
} from "@/lib/costTracker";
import { getTextProviderConfig } from "@/lib/textProvider";
import { AUTOMATION_LANGUAGE_VALUES } from "@/config/languages";
import {
  AUTOMATION_ARTICLE_FORMATS,
  AUTOMATION_HUMANIZER_VALUES,
  KNOWN_AUTOMATION_CATEGORIES,
} from "@/lib/automation/types";
import { getUndetectableCredits, isUndetectableConfigured } from "@/lib/undetectableCredits";
import { IMAGE_BOX_PROMPTS } from "@/lib/imageBoxPrompts";

/**
 * GET /api/automation/config — the automation API's actual limits and stage
 * pricing, straight from the same functions the runtime enforces with. Lets
 * an orchestrator see every constraint before submitting instead of
 * reverse-engineering them from error codes.
 */
export async function GET(req: Request) {
  const authError = requireAutomationAuth(req);
  if (authError) {
    return Response.json(authError, { status: authError.code === "unauthorized" ? 401 : 500 });
  }

  let textModel = "unconfigured";
  try {
    textModel = getTextProviderConfig().model;
  } catch {
    // Config endpoint must still answer when the provider env is incomplete.
  }

  const undetectable = await getUndetectableCredits();

  return Response.json({
    status: "ok",
    /**
     * Live humanizer state. `undetectableCredits` is words (1 credit = 1 word);
     * a human-mode job needs ~maxWords × 1.1. With humanizer "auto" the job
     * resolves to BetterWords when the balance is short — check this before
     * a batch if Undetectable.AI is required.
     */
    humanizer: {
      options: AUTOMATION_HUMANIZER_VALUES,
      default: "auto",
      undetectableConfigured: isUndetectableConfigured(),
      undetectableCredits: undetectable?.credits ?? null,
      undetectableCheckedAt: undetectable ? new Date(undetectable.checkedAt).toISOString() : null,
      wordsMarginFactor: 1.1,
      /** Undetectable.AI detector bills 0.1 credit per word from the same balance. */
      detectCreditsPerWord: 0.1,
      textOps: {
        humanize: "POST /api/automation/humanize — selective humanization of supplied blocks (sync)",
        detect: "POST /api/automation/detect — per-block AI detection score (sync)",
        maxBlocks: 60,
        maxTotalWords: 6000,
        maxBlockChars: 10000,
      },
    },
    cost: {
      defaultMaxCostUsd: maxJobCostUsd(),
      hardCeilingUsd: HARD_JOB_COST_CEILING_USD,
      dailyLimitUsd: dailyCostLimitUsd(),
      monthlyLimitUsd: monthlyCostLimitUsd(),
      /** estimatedCostUsd in responses is {min,max}; the runtime meter is authoritative. */
      stagePricingUsd: {
        sourceSearchPerQuery: estimateTavilySearchCost("basic"),
        sourceStageMax: SOURCE_STAGE_MAX_USD,
        sourceCacheTtlDays: 7,
        textInputPerMTokens: estimateOpenAIChatCost(textModel, 1_000_000, 0),
        textOutputPerMTokens: estimateOpenAIChatCost(textModel, 0, 1_000_000),
        humanizePerWord: estimateHumanizeCost(1),
        imageByQuality: {
          low: estimateOpenAIImageCost("gpt-image-2", "1536x864", "low"),
          medium: estimateOpenAIImageCost("gpt-image-2", "1536x864", "medium"),
          high: estimateOpenAIImageCost("gpt-image-2", "1536x864", "high"),
        },
      },
    },
    limits: {
      minWords: { min: 500 },
      maxWords: { max: 3000 },
      briefMaxChars: 2000,
      categoryMaxChars: 60,
      brandMaxChars: 80,
      seoTitleMaxChars: { min: 30, max: 120, default: 65 },
      maxRetriesPerJob: maxRetriesPerJob(),
      batchMaxJobs: 20,
      maxSearchesPerJob: 2,
    },
    request: {
      requiredFields: ["niche"],
      pairedFields: [["anchor", "anchorUrl"]],
      modes: ["human", "standard"],
      humanizers: AUTOMATION_HUMANIZER_VALUES,
      formats: AUTOMATION_ARTICLE_FORMATS,
      defaults: {
        mode: "human",
        humanizer: "auto",
        format: "article",
        language: "English",
        image: true,
        imageQuality: (process.env.HERO_IMAGE_QUALITY || "medium").trim().toLowerCase(),
        coverFormat: "webp",
        minWords: 1200,
        maxWords: 1800,
        maxCostUsd: maxJobCostUsd(),
      },
    },
    languages: AUTOMATION_LANGUAGE_VALUES,
    categoriesWithCuratedSources: KNOWN_AUTOMATION_CATEGORIES,
    imageStyles: IMAGE_BOX_PROMPTS.map((box) => box.id),
    textModel,
  });
}
