import assert from "node:assert/strict";
import {
  getTextProviderConfig,
  isResponseFormatUnsupported,
  textReasoningEffort,
  textTokenLimit,
} from "../lib/textProvider";

const previous = {
  baseURL: process.env.TEXT_API_BASE_URL,
  model: process.env.TEXT_MODEL,
  providerName: process.env.TEXT_PROVIDER_NAME,
  openaiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_TEXT_MODEL,
};

try {
  delete process.env.TEXT_API_BASE_URL;
  delete process.env.TEXT_MODEL;
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_TEXT_MODEL = "gpt-5.5";
  const openai = getTextProviderConfig();
  assert.equal(openai.kind, "openai");
  assert.equal(openai.model, "gpt-5.5");
  assert.equal(openai.baseURL, "https://api.openai.com/v1");
  assert.deepEqual(textTokenLimit(openai, 6000), { max_completion_tokens: 6000 });
  assert.deepEqual(textReasoningEffort(openai, "low"), { reasoning_effort: "low" });

  process.env.TEXT_API_BASE_URL = "http://127.0.0.1:11434/v1/";
  process.env.TEXT_MODEL = "qwen3:30b";
  process.env.TEXT_PROVIDER_NAME = "ollama";
  const config = getTextProviderConfig();
  assert.equal(config.baseURL, "http://127.0.0.1:11434/v1");
  assert.equal(config.model, "qwen3:30b");
  assert.equal(config.name, "ollama");
  assert.equal(config.kind, "external");
  assert.deepEqual(textTokenLimit(config, 6000), { max_tokens: 6000 });
  assert.deepEqual(textReasoningEffort(config, "low"), {});
  assert.equal(isResponseFormatUnsupported(Object.assign(new Error("Unsupported response_format"), { status: 400 })), true);
  assert.equal(isResponseFormatUnsupported(Object.assign(new Error("Rate limited"), { status: 429 })), false);

  delete process.env.TEXT_MODEL;
  assert.throws(() => getTextProviderConfig(), /configured together/);

  console.log("Text provider selection smoke tests passed.");
} finally {
  if (previous.baseURL === undefined) delete process.env.TEXT_API_BASE_URL;
  else process.env.TEXT_API_BASE_URL = previous.baseURL;
  if (previous.model === undefined) delete process.env.TEXT_MODEL;
  else process.env.TEXT_MODEL = previous.model;
  if (previous.providerName === undefined) delete process.env.TEXT_PROVIDER_NAME;
  else process.env.TEXT_PROVIDER_NAME = previous.providerName;
  if (previous.openaiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previous.openaiKey;
  if (previous.openaiModel === undefined) delete process.env.OPENAI_TEXT_MODEL;
  else process.env.OPENAI_TEXT_MODEL = previous.openaiModel;
}
