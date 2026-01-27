#!/usr/bin/env node
/**
 * Sanity-check for platform presets logic.
 * Run: node scripts/test-platform-presets.js
 */

const PLATFORM_PRESETS = {
  music_industry: ["Multi-platform", "Spotify", "YouTube", "TikTok", "Instagram", "SoundCloud", "Beatport", "Deezer", "Tidal"],
  social_media: ["TikTok", "Instagram", "YouTube", "Facebook", "X (Twitter)", "LinkedIn", "Multi-platform"],
  it: ["Web app", "Mobile app", "API product", "Developer tools", "Multi-platform"],
  med_tech: ["Med app", "Telehealth platform", "EHR system", "Multi-platform"],
  mil_tech: ["Defense SaaS", "Simulation platform", "Hardware + software stack", "Multi-platform"],
  casino: ["Casino brand", "Sportsbook", "Slots", "Poker room", "Multi-platform"],
  gambling: ["Casino brand", "Sportsbook", "Slots", "Poker room", "Multi-platform"],
  astrology: ["Content website", "Mobile app", "Newsletter", "Multi-platform"],
  vpn: ["VPN app", "Browser extension", "Multi-platform"],
  hr: ["HR SaaS", "ATS platform", "Job board", "Multi-platform"],
  default: ["Multi-platform"],
};

const NICHE_TO_PRESET_KEY = {
  "Music industry": "music_industry",
  "Social media / SMM": "social_media",
  IT: "it",
  "Med tech": "med_tech",
  "Mil tech": "mil_tech",
  Casino: "casino",
  Gambling: "gambling",
  Astrology: "astrology",
  VPN: "vpn",
  HR: "hr",
};

const NICHE_PRESET_LABELS = [
  "Music industry",
  "Social media / SMM",
  "IT",
  "Med tech",
  "Mil tech",
  "Casino",
  "Gambling",
  "Astrology",
  "VPN",
  "HR",
];

function getSelectedNicheKey(briefNiche) {
  return briefNiche && NICHE_TO_PRESET_KEY[briefNiche] ? NICHE_TO_PRESET_KEY[briefNiche] : "default";
}

function getPlatformPresetsList(selectedNicheKey) {
  return PLATFORM_PRESETS[selectedNicheKey] ?? PLATFORM_PRESETS.default;
}

let failed = 0;

// 1) Every niche label must have a key and that key must have a non-empty platform list
for (const label of NICHE_PRESET_LABELS) {
  const key = NICHE_TO_PRESET_KEY[label];
  const list = PLATFORM_PRESETS[key];
  if (!key) {
    console.error("FAIL: No NICHE_TO_PRESET_KEY for label:", JSON.stringify(label));
    failed++;
  } else if (!list || !Array.isArray(list) || list.length === 0) {
    console.error("FAIL: No/bad PLATFORM_PRESETS for key:", key);
    failed++;
  } else {
    console.log("OK  ", label, "->", key, "(", list.length, "platforms)");
  }
}

// 2) Simulate UI: niche preset click -> platform list
const cases = [
  { niche: "Music industry", expectFirst: "Multi-platform", expectContains: "Spotify" },
  { niche: "Social media / SMM", expectFirst: "TikTok", expectContains: "LinkedIn" },
  { niche: "IT", expectFirst: "Web app", expectContains: "Multi-platform" },
  { niche: "Casino", expectFirst: "Casino brand", expectContains: "Slots" },
  { niche: "VPN", expectFirst: "VPN app", expectContains: "Multi-platform" },
  { niche: "", expectFirst: "Multi-platform", expectContains: "Multi-platform" },
  { niche: "Custom Niche XYZ", expectFirst: "Multi-platform", expectContains: "Multi-platform" },
];

for (const { niche, expectFirst, expectContains } of cases) {
  const key = getSelectedNicheKey(niche);
  const list = getPlatformPresetsList(key);
  const first = list[0];
  const has = list.includes(expectContains);
  if (first !== expectFirst || !has) {
    console.error("FAIL case niche=%s: got list length=%d first=%s contains %s=%s", JSON.stringify(niche), list.length, first, expectContains, has);
    failed++;
  } else {
    console.log("OK  niche=%s -> key=%s -> platforms[0]=%s, has %s", JSON.stringify(niche), key, first, expectContains);
  }
}

// 3) default must be exactly ["Multi-platform"]
const defaultList = PLATFORM_PRESETS.default;
if (!Array.isArray(defaultList) || defaultList.length !== 1 || defaultList[0] !== "Multi-platform") {
  console.error("FAIL: PLATFORM_PRESETS.default must be [\"Multi-platform\"]", defaultList);
  failed++;
} else {
  console.log("OK  default presets = [\"Multi-platform\"]");
}

if (failed) {
  console.error("\nTotal failures:", failed);
  process.exit(1);
}
console.log("\nAll platform-preset checks passed.");
