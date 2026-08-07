import OpenAI from "openai";

export interface TextProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  smallModel: string;
  visionModel: string;
  name: string;
  kind: "openai" | "external";
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
    // The SDK retries connection failures, 408/409/429 and 5xx responses.
    // Keep this bounded because concurrency already multiplies throughput.
    maxRetries: 2,
  });
}

export function validateTextProvider(): true {
  getTextProviderConfig();
  return true;
}
