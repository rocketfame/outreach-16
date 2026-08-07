import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { getTextProviderConfig } from "../lib/textProvider";

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const previous = {
  baseURL: process.env.TEXT_API_BASE_URL,
  model: process.env.TEXT_MODEL,
  providerName: process.env.TEXT_PROVIDER_NAME,
};

try {
  process.env.TEXT_API_BASE_URL = "https://api.openai.com/v1";
  process.env.TEXT_MODEL = "forbidden";
  assert.throws(() => getTextProviderConfig(), /disabled for text generation/);

  process.env.TEXT_API_BASE_URL = "http://127.0.0.1:11434/v1/";
  process.env.TEXT_MODEL = "qwen3:30b";
  process.env.TEXT_PROVIDER_NAME = "ollama";
  const config = getTextProviderConfig();
  assert.equal(config.baseURL, "http://127.0.0.1:11434/v1");
  assert.equal(config.model, "qwen3:30b");
  assert.equal(config.name, "ollama");

  const root = process.cwd();
  const runtimeFiles = [join(root, "app"), join(root, "lib")]
    .flatMap(walk)
    .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
  const allowedOpenAIFiles = new Set([
    join(root, "lib/config.ts"),
    join(root, "lib/costTracker.ts"),
    join(root, "app/api/article-image/route.ts"),
  ]);

  for (const path of runtimeFiles) {
    if (allowedOpenAIFiles.has(path)) continue;
    const source = readFileSync(path, "utf8");
    assert.equal(
      /OPENAI_API_KEY|getOpenAIImageClient|api\.openai\.com\/v1\/chat/.test(source),
      false,
      `OpenAI text boundary violated by ${relative(root, path)}`
    );
  }

  console.log("Text provider boundary smoke tests passed.");
} finally {
  if (previous.baseURL === undefined) delete process.env.TEXT_API_BASE_URL;
  else process.env.TEXT_API_BASE_URL = previous.baseURL;
  if (previous.model === undefined) delete process.env.TEXT_MODEL;
  else process.env.TEXT_MODEL = previous.model;
  if (previous.providerName === undefined) delete process.env.TEXT_PROVIDER_NAME;
  else process.env.TEXT_PROVIDER_NAME = previous.providerName;
}
