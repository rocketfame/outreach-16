#!/usr/bin/env node
/**
 * Quick check: Tavily + AIHumanize config and connectivity
 * Run: node scripts/check-apis.mjs
 * Requires: .env.local with TAVILY_API_KEY, AIHUMANIZE_API_KEY, NEXT_PUBLIC_AIHUMANIZE_EMAIL
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dep)
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch (_) {}

const tavilyKey = process.env.TAVILY_API_KEY;
const humanizeKey = process.env.AIHUMANIZE_API_KEY;
const humanizeEmail = process.env.NEXT_PUBLIC_AIHUMANIZE_EMAIL;

console.log("\n=== API Configuration Check ===\n");

// 1. Env vars
console.log("1. Environment variables:");
console.log("   TAVILY_API_KEY:", tavilyKey ? `${tavilyKey.slice(0, 8)}...` : "MISSING");
console.log("   AIHUMANIZE_API_KEY:", humanizeKey ? `${humanizeKey.slice(0, 8)}...` : "MISSING");
console.log("   NEXT_PUBLIC_AIHUMANIZE_EMAIL:", humanizeEmail ? `${humanizeEmail.slice(0, 5)}...` : "MISSING");

if (!tavilyKey || !humanizeKey || !humanizeEmail) {
  console.log("\n❌ Missing required env vars. Add them to .env.local");
  process.exit(1);
}

// 2. Tavily - quick search
console.log("\n2. Tavily API (search):");
try {
  const tavilyRes = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: "TikTok creator tools",
      search_depth: "basic",
      max_results: 2,
    }),
  });
  const tavilyData = await tavilyRes.json();
  if (tavilyRes.ok && Array.isArray(tavilyData.results)) {
    console.log("   ✅ OK — found", tavilyData.results.length, "results");
  } else {
    console.log("   ❌ Error:", tavilyData.detail || tavilyData.error || tavilyRes.status);
  }
} catch (e) {
  console.log("   ❌", e.message);
}

// 3. AIHumanize - rewrite (needs 100+ chars)
console.log("\n3. AIHumanize API (rewrite):");
const sampleText = "This is a sample paragraph that needs to be at least one hundred characters long so that the AIHumanize API will accept it for rewriting. We are testing the connection.";
try {
  const humanizeRes = await fetch("https://aihumanize.io/api/v1/rewrite", {
    method: "POST",
    headers: {
      "Authorization": humanizeKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "1",
      mail: humanizeEmail,
      data: sampleText,
    }),
  });
  const humanizeData = await humanizeRes.json();
  if (humanizeData.code === 200 && humanizeData.data) {
    console.log("   ✅ OK — words used:", humanizeData.words_used || 0);
  } else {
    console.log("   ❌ Code:", humanizeData.code, "—", humanizeData.msg || humanizeData.message || "Unknown error");
  }
} catch (e) {
  console.log("   ❌", e.message);
}

console.log("\n=== Done ===\n");
