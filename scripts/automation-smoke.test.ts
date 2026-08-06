import { validateAutomationRequest, AutomationValidationError } from "@/lib/automation/validate";
import { countAutomationWords, slugifyAutomationTitle } from "@/lib/automation/text";
import { buildDirectArticlePrompt } from "@/lib/articlePrompt";

let failures = 0;

function pass(label: string) {
  console.log(`PASS ${label}`);
}

function fail(label: string, message: string) {
  failures += 1;
  console.log(`FAIL ${label}: ${message}`);
}

function expectOk(label: string, input: unknown, checks: (r: ReturnType<typeof validateAutomationRequest>) => void) {
  try {
    const r = validateAutomationRequest(input);
    checks(r);
    pass(label);
  } catch (e) {
    fail(label, (e as Error).message);
  }
}

function expectErr(label: string, input: unknown, field?: string, hasAllowed?: boolean) {
  try {
    validateAutomationRequest(input);
    fail(label, "expected error, got success");
  } catch (e) {
    const err = e as AutomationValidationError;
    const fieldOk = !field || err.field === field;
    const allowedOk = !hasAllowed || Array.isArray(err.allowed);
    const detail = `${err.message} [field=${err.field}, allowed=${JSON.stringify(err.allowed)}]`;
    if (fieldOk && allowedOk) pass(`${label}: ${detail}`);
    else fail(label, detail);
  }
}

// Acceptance criteria
expectOk("Beatport accepted", { niche: "Music industry", category: "Beatport", mode: "human" }, r => {
  if (r.category !== "Beatport") throw new Error("category mismatch");
});
expectOk("Twitch accepted", { niche: "Music industry", category: "Twitch", mode: "human" }, () => {});
for (const c of ["Instagram", "TikTok", "YouTube", "Facebook", "SoundCloud", "Spotify", "Growth"]) {
  expectOk(`legacy ${c}`, { niche: "Music industry", category: c, mode: "human" }, r => {
    if (r.category !== c) throw new Error("category mismatch");
  });
}
expectOk("category omitted → derived", { niche: "Music industry", mode: "human" }, r => {
  if (r.category !== "Spotify") throw new Error(`derived ${r.category}, expected Spotify`);
});
expectOk("niche case-insensitive derivation", { niche: "music INDUSTRY" }, r => {
  if (r.category !== "Spotify") throw new Error(`derived ${r.category}`);
});
expectErr("unknown niche + no category → 400", { niche: "Underwater basket weaving" }, "category");
expectOk("mode omitted → human", { niche: "Music industry", category: "Spotify" }, r => {
  if (r.mode !== "human") throw new Error("mode default failed");
});
expectErr("bad mode", { niche: "Music industry", category: "Spotify", mode: "turbo" }, "mode", true);
expectErr("xx-NOT-A-LANG rejected", { niche: "Music industry", category: "Spotify", language: "xx-NOT-A-LANG" }, "language", true);
expectOk("language es → Spanish", { niche: "Music industry", category: "Spotify", language: "es" }, r => {
  if (r.language !== "Spanish") throw new Error(`got ${r.language}`);
});
expectOk("language de → German", { niche: "Music industry", category: "Spotify", language: "de" }, r => {
  if (r.language !== "German") throw new Error(`got ${r.language}`);
});
expectOk("language German full name", { niche: "Music industry", category: "Spotify", language: "German" }, r => {
  if (r.language !== "German") throw new Error(`got ${r.language}`);
});
expectOk("language omitted → English", { niche: "Music industry", category: "Spotify" }, r => {
  if (r.language !== "English") throw new Error(`got ${r.language}`);
});
expectOk("language case-insensitive", { niche: "Music industry", category: "Spotify", language: "uKrAiNiAn" }, r => {
  if (r.language !== "Ukrainian") throw new Error(`got ${r.language}`);
});
for (const [alias, expected] of Object.entries({
  en: "English", de: "German", es: "Spanish", pt: "Portuguese", fr: "French",
  it: "Italian", pl: "Polish", uk: "Ukrainian", ru: "Russian",
})) {
  expectOk(`ISO ${alias} → ${expected}`, { niche: "Music industry", category: "Spotify", language: alias }, r => {
    if (r.language !== expected) throw new Error(`got ${r.language}`);
  });
}
expectOk("custom language", {
  niche: "Music industry",
  category: "Spotify",
  language: "custom",
  languageCustom: "Catalan",
}, r => {
  if (r.language !== "Catalan") throw new Error(`got ${r.language}`);
});
expectOk("UI custom label", {
  niche: "Music industry",
  category: "Spotify",
  language: "Other (custom)",
  languageCustom: "Catalan",
}, r => {
  if (r.language !== "Catalan") throw new Error(`got ${r.language}`);
});
expectErr("custom without languageCustom", {
  niche: "Music industry",
  category: "Spotify",
  language: "custom",
}, "languageCustom");
expectErr("languageCustom without custom selector", {
  niche: "Music industry",
  category: "Spotify",
  languageCustom: "Catalan",
}, "language");

const slugCases: Array<[string, string, string]> = [
  ["Як набрати перших 1000 підписників", "Ukrainian", "yak-nabraty-pershykh-1000-pidpysnykiv"],
  ["М'ясо, пір'я та згода", "Ukrainian", "miaso-piria-ta-zghoda"],
  ["Как набрать первых 1000 подписчиков", "Russian", "kak-nabrat-pervykh-1000-podpischikov"],
  ["Größe für Anfänger", "German", "grosse-fur-anfanger"],
  ["Łódź, żółć i więcej", "Polish", "lodz-zolc-i-wiecej"],
  ["Cómo ganar más seguidores", "Spanish", "como-ganar-mas-seguidores"],
];
for (const [title, language, expected] of slugCases) {
  try {
    const actual = slugifyAutomationTitle(title, language);
    if (actual !== expected) throw new Error(`got ${actual}, expected ${expected}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(actual)) throw new Error(`invalid ASCII slug ${actual}`);
    pass(`slug ${language}`);
  } catch (error) {
    fail(`slug ${language}`, (error as Error).message);
  }
}

try {
  slugifyAutomationTitle("!!!", "English");
  fail("empty slug rejected", "expected error, got success");
} catch {
  pass("empty slug rejected");
}

const ukrainianWords = Array.from({ length: 1200 }, () => "слово").join(" ");
const countedWords = countAutomationWords(`<p>${ukrainianWords}</p>`);
if (countedWords === 1200) pass("1200 Cyrillic words counted correctly");
else fail("1200 Cyrillic words counted correctly", `got ${countedWords}`);

try {
  const prompt = buildDirectArticlePrompt({
    topicTitle: "Як набрати перших 1000 підписників",
    topicBrief: "Практичний матеріал",
    niche: "Music industry",
    mainPlatform: "Spotify",
    contentPurpose: "Guest post / outreach",
    anchorText: "",
    anchorUrl: "",
    brandName: "",
    keywordList: [],
    trustSourcesList: [],
    language: "Ukrainian",
    targetAudience: "Music creators",
    wordCount: "1200",
    writingMode: "seo",
  });
  if (!prompt.includes("titleTag, metaDescription") || !prompt.includes("Ukrainian")) {
    throw new Error("language instruction does not cover SEO fields");
  }
  pass("article + SEO fields share the Ukrainian prompt contract");
} catch (error) {
  fail("article + SEO fields share the Ukrainian prompt contract", (error as Error).message);
}

if (failures > 0) {
  process.exitCode = 1;
  console.log(`\n${failures} automation smoke check(s) failed.`);
} else {
  console.log("\nAll automation smoke checks passed.");
}
