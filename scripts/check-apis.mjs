#!/usr/bin/env node
/**
 * Quick check: Tavily + Undetectable.AI Humanizer config and connectivity
 * Run: node scripts/check-apis.mjs
 * Requires: .env.local with TAVILY_API_KEY, UNDETECTABLE_HUMANIZER_API_KEY
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
const humanizeKey = process.env.UNDETECTABLE_HUMANIZER_API_KEY;

console.log("\n=== API Configuration Check ===\n");

// 1. Env vars
console.log("1. Environment variables:");
console.log("   TAVILY_API_KEY:", tavilyKey ? `${tavilyKey.slice(0, 8)}...` : "MISSING");
console.log("   UNDETECTABLE_HUMANIZER_API_KEY:", humanizeKey ? `${humanizeKey.slice(0, 8)}...` : "MISSING");

if (!tavilyKey || !humanizeKey) {
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

// 3. Undetectable.AI Humanizer - submit + poll (needs 50+ chars)
console.log("\n3. Undetectable.AI Humanizer API:");
const baseUrl = process.env.UNDETECTABLE_HUMANIZER_BASE_URL || "https://humanize.undetectable.ai";
const sampleText = "This is a sample paragraph that needs to be at least fifty characters long for the Undetectable API to accept it for humanization.";
try {
  const submitRes = await fetch(`${baseUrl}/submit`, {
    method: "POST",
    headers: {
      apikey: humanizeKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: sampleText,
      readability: "University",
      purpose: "Article",
      strength: "Balanced",
      model: "v11",
    }),
  });
  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson?.id) {
    console.log("   ❌ Submit failed:", submitJson?.error || submitJson?.message || submitRes.statusText);
  } else {
    const docId = submitJson.id;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const docRes = await fetch(`${baseUrl}/document`, {
        method: "POST",
        headers: { apikey: humanizeKey, "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId }),
      });
      const docJson = await docRes.json();
      if (docJson?.output) {
        console.log("   ✅ OK — humanization complete");
        break;
      }
      if (i === 9) console.log("   ⚠️ Timeout waiting for output (API may still be working)");
    }
  }
} catch (e) {
  console.log("   ❌", e.message);
}

console.log("\n=== Done ===\n");
