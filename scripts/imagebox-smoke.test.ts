import { IMAGE_BOX_PROMPTS, PALETTE_FAMILIES, selectImageBoxPrompt } from "@/lib/imageBoxPrompts";
import { validateAutomationRequest, AutomationValidationError } from "@/lib/automation/validate";

const ok = (label: string, cond: boolean, detail?: string) =>
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && detail ? ` :: ${detail}` : ""}`);

// Pool integrity
ok("40 boxes in pool", IMAGE_BOX_PROMPTS.length === 40, String(IMAGE_BOX_PROMPTS.length));
const ids = new Set(IMAGE_BOX_PROMPTS.map(b => b.id));
ok("ids unique", ids.size === IMAGE_BOX_PROMPTS.length);
ok("every box has valid family", IMAGE_BOX_PROMPTS.every(b => (PALETTE_FAMILIES as readonly string[]).includes(b.paletteFamily)));
ok("every new template has placeholders", IMAGE_BOX_PROMPTS.slice(28).every(b =>
  b.promptTemplate.includes("[[ARTICLE_TITLE]]") && b.promptTemplate.includes("[[MAIN_PLATFORM]]") &&
  b.promptTemplate.includes("[[NICHE]]") && b.promptTemplate.includes("[[BRAND_NAME]]")));
ok("every new template locks 16:9", IMAGE_BOX_PROMPTS.slice(28).every(b => b.promptTemplate.includes("16:9")));

// Family distribution
const dist: Record<string, number> = {};
for (const b of IMAGE_BOX_PROMPTS) dist[b.paletteFamily] = (dist[b.paletteFamily] || 0) + 1;
console.log("INFO family distribution:", JSON.stringify(dist));
ok("dark-neon share <= 30%", (dist["dark-neon"] || 0) / IMAGE_BOX_PROMPTS.length <= 0.3);

// Family-aware selection flattens palette distribution (statistical)
const draws: Record<string, number> = {};
for (let i = 0; i < 9000; i++) {
  const { box } = selectImageBoxPrompt(new Set());
  draws[box.paletteFamily] = (draws[box.paletteFamily] || 0) + 1;
}
const shares = Object.values(draws).map(n => n / 9000);
ok("each family drawn ~uniformly (1/9 ± 3pp)", shares.length === 9 && shares.every(s => Math.abs(s - 1/9) < 0.03),
  JSON.stringify(draws));

// No-repeat cycle still holds
const seen = new Set<number>();
for (let i = 0; i < IMAGE_BOX_PROMPTS.length; i++) {
  const { index } = selectImageBoxPrompt(seen);
  ok(`cycle draw ${i} not repeated`, !seen.has(index));
  if (seen.has(index)) break;
  seen.add(index);
}
console.log(`INFO full cycle covered ${seen.size}/${IMAGE_BOX_PROMPTS.length} boxes`);

// family: excludes in validation
const base = { niche: "Music industry", category: "Spotify" };
const r = validateAutomationRequest({ ...base, excludeImageStyles: ["family:dark-neon"] });
const darkIds = IMAGE_BOX_PROMPTS.filter(b => b.paletteFamily === "dark-neon").map(b => b.id);
ok("family:dark-neon expands to all its ids", darkIds.every(id => r.excludeImageStyles.includes(id)) && r.excludeImageStyles.length === darkIds.length);
try {
  validateAutomationRequest({ ...base, excludeImageStyles: ["family:nope"] });
  ok("unknown family rejected", false);
} catch (e) {
  const err = e as AutomationValidationError;
  ok("unknown family rejected", err.field === "excludeImageStyles" && (err.allowed || []).includes("family:dark-neon"));
}
try {
  validateAutomationRequest({ ...base, excludeImageStyles: PALETTE_FAMILIES.map(f => `family:${f}`) });
  ok("exclude all families rejected", false);
} catch (e) { ok("exclude all families rejected", (e as AutomationValidationError).field === "excludeImageStyles"); }
try {
  validateAutomationRequest({ ...base, imageStyle: darkIds[0], excludeImageStyles: ["family:dark-neon"] });
  ok("pin inside excluded family rejected", false);
} catch (e) { ok("pin inside excluded family rejected", (e as AutomationValidationError).field === "imageStyle"); }
