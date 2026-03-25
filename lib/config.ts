// lib/config.ts
// Centralized API configuration - Single source of truth for all API keys
// Add your API keys ONLY in .env.local file in the root directory

import OpenAI from "openai";

/**
 * Get and validate OpenAI API key
 * @returns OpenAI API key
 * @throws Error if key is missing or invalid
 */
export function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = "Missing OPENAI_API_KEY environment variable. Please add it to .env.local file in the root directory.";
    console.error(error);
    throw new Error(error);
  }

  // Critical validation: OpenAI key must start with "sk-" (not Tavily key "tvly-")
  if (!apiKey.startsWith("sk-")) {
    const keyPrefix = apiKey.slice(0, 10);
    const error = `Invalid OPENAI_API_KEY format. OpenAI keys must start with "sk-", but got prefix "${keyPrefix}". Please check your .env.local file - you might have set TAVILY_API_KEY value as OPENAI_API_KEY.`;
    console.error(error);
    throw new Error(error);
  }

  return apiKey;
}

/**
 * Get and validate Tavily API key
 * @returns Tavily API key
 * @throws Error if key is missing or invalid
 */
export function getTavilyApiKey(): string {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    const error = "Missing TAVILY_API_KEY environment variable. Please add it to .env.local file in the root directory.";
    console.error(error);
    throw new Error(error);
  }

  // Validate Tavily key format (must start with "tvly-")
  if (!apiKey.startsWith("tvly-")) {
    const keyPrefix = apiKey.slice(0, 10);
    const error = `Invalid TAVILY_API_KEY format. Tavily keys must start with "tvly-", but got prefix "${keyPrefix}". Please check your .env.local file.`;
    console.error(error);
    throw new Error(error);
  }

  return apiKey;
}

/**
 * Get OpenAI client instance (pre-configured with validated API key)
 * @returns OpenAI client
 */
export function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: getOpenAIApiKey(),
  });
}

/**
 * Safe debug log for API keys (only prefix, never full key)
 * Use this for logging API key status without exposing the full key
 */
export function logApiKeyStatus(): void {
  const openaiKey = process.env.OPENAI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  console.log(
    "OPENAI_API_KEY prefix in runtime:",
    (openaiKey || "undefined").slice(0, 10)
  );
  console.log(
    "TAVILY_API_KEY prefix in runtime:",
    (tavilyKey || "undefined").slice(0, 10)
  );
}

/**
 * Validate all required API keys are present and correctly formatted
 * @returns true if all keys are valid, throws error otherwise
 */
export function validateApiKeys(): boolean {
  try {
    getOpenAIApiKey();
    getTavilyApiKey();
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Get Undetectable.AI Humanizer API key
 * @returns API key for Humanization API v2
 * @throws Error if key is missing
 */
export function getHumanizerApiKey(): string {
  const apiKey = process.env.UNDETECTABLE_HUMANIZER_API_KEY;

  if (!apiKey) {
    const error =
      "Missing UNDETECTABLE_HUMANIZER_API_KEY. Add it to .env.local (see https://help.undetectable.ai/en/article/humanization-api-v2-p28b2n/)";
    console.error(error);
    throw new Error(error);
  }

  return apiKey;
}

/**
 * Undetectable.AI Humanizer config (optional overrides via env)
 */
export function getHumanizerConfig(): {
  baseUrl: string;
  apiKey: string;
  model: "v2" | "v11" | "v11sr";
  readability: "High School" | "University" | "Doctorate" | "Journalist" | "Marketing";
  purpose: "General Writing" | "Essay" | "Article" | "Marketing Material" | "Story" | "Cover Letter" | "Report" | "Business Material" | "Legal Material";
  strength: "Quality" | "Balanced" | "More Human";
} {
  const baseUrl =
    process.env.UNDETECTABLE_HUMANIZER_BASE_URL || "https://humanize.undetectable.ai";
  const model = (process.env.UNDETECTABLE_HUMANIZER_MODEL || "v11") as "v2" | "v11" | "v11sr";
  const readability = (process.env.UNDETECTABLE_HUMANIZER_READABILITY ||
    "University") as "High School" | "University" | "Doctorate" | "Journalist" | "Marketing";
  const purpose = (process.env.UNDETECTABLE_HUMANIZER_PURPOSE ||
    "Article") as "General Writing" | "Essay" | "Article" | "Marketing Material" | "Story" | "Cover Letter" | "Report" | "Business Material" | "Legal Material";
  const strength = (process.env.UNDETECTABLE_HUMANIZER_STRENGTH ||
    "More Human") as "Quality" | "Balanced" | "More Human";

  return {
    baseUrl,
    apiKey: getHumanizerApiKey(),
    model,
    readability,
    purpose,
    strength,
  };
}

/**
 * Feature flag for Writing Mode (SEO Mode + Human Mode)
 * When false: Only SEO Mode is available, system behaves exactly as current production
 * When true: UI shows SEO/Human toggle and backend supports Human Mode
 *
 * Now enabled by default - Human Mode is always available
 */
export const HUMAN_MODE_EXPERIMENT = true;












