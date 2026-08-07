import OpenAI from "openai";

export interface TextProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  smallModel: string;
  visionModel: string;
  name: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Text generation is not configured. Add ${name} to the server environment. OpenAI text fallback is disabled.`
    );
  }
  return value;
}

function validateNonOpenAIBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEXT_API_BASE_URL must be a valid http(s) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("TEXT_API_BASE_URL must use http or https.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "openai.com" || hostname.endsWith(".openai.com")) {
    throw new Error(
      "OpenAI is disabled for text generation. TEXT_API_BASE_URL must point to a non-OpenAI provider."
    );
  }

  return value.replace(/\/+$/, "");
}

export function getTextProviderConfig(): TextProviderConfig {
  const model = requiredEnv("TEXT_MODEL");
  return {
    baseURL: validateNonOpenAIBaseUrl(requiredEnv("TEXT_API_BASE_URL")),
    // Local Ollama-compatible servers do not require a real secret, but the
    // OpenAI SDK requires a non-empty apiKey value.
    apiKey: process.env.TEXT_API_KEY?.trim() || "local-text-provider",
    model,
    smallModel: process.env.TEXT_SMALL_MODEL?.trim() || model,
    visionModel: process.env.TEXT_VISION_MODEL?.trim() || model,
    name: process.env.TEXT_PROVIDER_NAME?.trim() || "external",
  };
}

export function getTextGenerationClient(): OpenAI {
  const config = getTextProviderConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    // The SDK retries connection failures, 408/409/429 and 5xx responses.
    // Keep this bounded because concurrency already multiplies throughput.
    maxRetries: 2,
  });
}

export function validateTextProvider(): true {
  getTextProviderConfig();
  return true;
}
