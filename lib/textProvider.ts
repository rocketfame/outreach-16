import OpenAI from "openai";
import {
  estimateOpenAIChatCost,
  estimateTextTokens,
  getCostTracker,
} from "@/lib/costTracker";
import {
  cancelAutomationCostReservation,
  claimAutomationRetry,
  reserveAutomationCost,
} from "@/lib/automation/budget";

export interface TextProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  smallModel: string;
  visionModel: string;
  name: string;
  kind: "openai" | "external";
}

export type TextTokenLimit =
  | { max_completion_tokens: number; max_tokens?: never }
  | { max_tokens: number; max_completion_tokens?: never };

/** OpenAI GPT-5 uses max_completion_tokens; compatible external APIs commonly use max_tokens. */
export function textTokenLimit(
  provider: Pick<TextProviderConfig, "kind">,
  tokens: number
): TextTokenLimit {
  return provider.kind === "openai"
    ? { max_completion_tokens: tokens }
    : { max_tokens: tokens };
}

export type TextReasoningEffort = "minimal" | "low" | "medium" | "high";

/** Reasoning controls are OpenAI-specific; omit them for compatible providers. */
export function textReasoningEffort(
  provider: Pick<TextProviderConfig, "kind">,
  effort: TextReasoningEffort
): { reasoning_effort?: TextReasoningEffort } {
  return provider.kind === "openai" ? { reasoning_effort: effort } : {};
}

/** Only retry without JSON mode when that exact optional feature is rejected. */
export function isResponseFormatUnsupported(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return status === 400 && message.includes("response_format");
}

export class UpstreamNoCreditsError extends Error {
  readonly code = "upstream_no_credits";

  constructor(message = "The text provider has no credits remaining.") {
    super(message);
    this.name = "UpstreamNoCreditsError";
  }
}

export function isUpstreamNoCreditsError(error: unknown): boolean {
  if (error instanceof UpstreamNoCreditsError) return true;
  const status = (error as { status?: unknown })?.status;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return status === 429 && /insufficient[_\s-]*(quota|credits)|no credits|credits remaining|billing quota/.test(message);
}

type TextCompletionParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

/** One metered text call with job-cap reservation and normalized credit errors. */
export async function createTextCompletion(
  client: OpenAI,
  provider: TextProviderConfig,
  params: TextCompletionParams,
  options: { step: string; isRetry?: boolean }
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const maxOutputTokens = params.max_completion_tokens ?? params.max_tokens ?? 0;
  const model = String(params.model || provider.model);
  const inputTokensEstimate = estimateTextTokens(params.messages);
  const estimatedCost = estimateOpenAIChatCost(
    model,
    inputTokensEstimate,
    maxOutputTokens
  );
  if (options.isRetry) claimAutomationRetry(options.step, estimatedCost);
  const reservationId = reserveAutomationCost(options.step, estimatedCost);

  try {
    const completion = await client.chat.completions.create(params);
    const usage = completion.usage as {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    } | undefined;
    // Cached prompt tokens are billed at ~10% of the input rate. The article
    // prompt template dominates input, so repeat jobs settle far below the
    // reservation once OpenAI's prefix cache is warm.
    getCostTracker().trackOpenAIChat(
      model,
      usage?.prompt_tokens || 0,
      usage?.completion_tokens || 0,
      reservationId,
      options.step,
      usage?.prompt_tokens_details?.cached_tokens || 0
    );
    return completion;
  } catch (error) {
    cancelAutomationCostReservation(reservationId);
    if (isUpstreamNoCreditsError(error)) {
      throw new UpstreamNoCreditsError(
        error instanceof Error ? error.message : "The text provider has no credits remaining."
      );
    }
    throw error;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Text generation is not configured. Add ${name} to the server environment.`
    );
  }
  return value;
}

function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEXT_API_BASE_URL must be a valid http(s) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("TEXT_API_BASE_URL must use http or https.");
  }

  return value.replace(/\/+$/, "");
}

export function getTextProviderConfig(): TextProviderConfig {
  const externalBaseURL = process.env.TEXT_API_BASE_URL?.trim();
  const externalModel = process.env.TEXT_MODEL?.trim();
  if (externalBaseURL || externalModel) {
    if (!externalBaseURL || !externalModel) {
      throw new Error(
        "TEXT_API_BASE_URL and TEXT_MODEL must be configured together, or both omitted to use OpenAI."
      );
    }
    return {
      baseURL: validateBaseUrl(externalBaseURL),
      apiKey: process.env.TEXT_API_KEY?.trim() || "local-text-provider",
      model: externalModel,
      smallModel: process.env.TEXT_SMALL_MODEL?.trim() || externalModel,
      visionModel: process.env.TEXT_VISION_MODEL?.trim() || externalModel,
      name: process.env.TEXT_PROVIDER_NAME?.trim() || "external",
      kind: "external",
    };
  }

  const apiKey = requiredEnv("OPENAI_API_KEY");
  if (!apiKey.startsWith("sk-")) {
    throw new Error("OPENAI_API_KEY has an invalid format.");
  }
  const model = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-5.5";
  return {
    baseURL: "https://api.openai.com/v1",
    apiKey,
    model,
    smallModel: process.env.OPENAI_SMALL_MODEL?.trim() || model,
    visionModel: process.env.OPENAI_VISION_MODEL?.trim() || model,
    name: "openai",
    kind: "openai",
  };
}

export function getTextGenerationClient(): OpenAI {
  const config = getTextProviderConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    // Application retries are budget-aware. Disable hidden SDK retries so a
    // provider call cannot run again outside MAX_RETRIES_PER_JOB accounting.
    maxRetries: 0,
  });
}

export function validateTextProvider(): true {
  getTextProviderConfig();
  return true;
}
