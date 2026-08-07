#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local. Copy .env.example and add real provider credentials.");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1).trim()];
    })
);

const errors = [];
for (const name of ["TEXT_API_BASE_URL", "TEXT_MODEL", "TAVILY_API_KEY"]) {
  if (!env[name]) errors.push(`Missing ${name}`);
}

if (env.TEXT_API_BASE_URL) {
  try {
    const url = new URL(env.TEXT_API_BASE_URL);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push("TEXT_API_BASE_URL must use http or https");
    }
    if (url.hostname === "openai.com" || url.hostname.endsWith(".openai.com")) {
      errors.push("TEXT_API_BASE_URL cannot point to OpenAI");
    }
  } catch {
    errors.push("TEXT_API_BASE_URL is not a valid URL");
  }
}

if (env.TAVILY_API_KEY && !env.TAVILY_API_KEY.startsWith("tvly-")) {
  errors.push("TAVILY_API_KEY has an invalid format");
}
if (env.OPENAI_API_KEY && !env.OPENAI_API_KEY.startsWith("sk-")) {
  errors.push("OPENAI_API_KEY has an invalid format (it is optional for images)");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Text provider and Tavily are configured. OpenAI remains optional and image-only.");
