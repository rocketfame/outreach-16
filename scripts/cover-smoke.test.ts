import { validateCoverRequest, AutomationValidationError } from "@/lib/automation/validate";
import { IMAGE_BOX_PROMPTS } from "@/lib/imageBoxPrompts";

const ok = (label: string, cond: boolean, detail?: string) =>
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && detail ? ` :: ${detail}` : ""}`);

const valid = IMAGE_BOX_PROMPTS.find(b => b.id === "box33_bauhaus_geometric_composition")!.id;

let r = validateCoverRequest({ topic: "Beatport Promotion Explained", niche: "Electronic music industry", category: "Beatport", imageStyle: valid, imageQuality: "medium", excludeImageStyles: ["family:dark-neon"] });
ok("full request accepted", r.topic.startsWith("Beatport") && r.imageStyle === valid && r.imageQuality === "medium");
ok("family exclude expanded", r.excludeImageStyles.length === IMAGE_BOX_PROMPTS.filter(b => b.paletteFamily === "dark-neon").length);

r = validateCoverRequest({ topic: "Minimal" });
ok("topic-only request accepted", r.topic === "Minimal" && r.category === "" && r.imageStyle === "");

try { validateCoverRequest({}); ok("missing topic rejected", false); }
catch (e) { ok("missing topic rejected", (e as AutomationValidationError).field === "topic"); }

try { validateCoverRequest({ topic: "x", imageStyle: "zzz" }); ok("unknown imageStyle → allowed[40]", false); }
catch (e) {
  const err = e as AutomationValidationError;
  ok("unknown imageStyle → allowed[40]", err.field === "imageStyle" && err.allowed?.length === 40, String(err.allowed?.length));
}

try { validateCoverRequest({ topic: "x", imageQuality: "ultra" }); ok("unknown imageQuality rejected", false); }
catch (e) { ok("unknown imageQuality rejected", (e as AutomationValidationError).field === "imageQuality" && Array.isArray((e as AutomationValidationError).allowed)); }

try { validateCoverRequest({ topic: "x", imageStyle: valid, excludeImageStyles: ["family:print-graphic"] }); ok("pin inside excluded family rejected", false); }
catch (e) { ok("pin inside excluded family rejected", (e as AutomationValidationError).field === "imageStyle"); }

// dark-neon never selectable when excluded: simulate selection like pipeline does
import { selectImageBoxPrompt } from "@/lib/imageBoxPrompts";
{
  const excluded = new Set(
    IMAGE_BOX_PROMPTS.map((b, i) => (b.paletteFamily === "dark-neon" ? i : -1)).filter(i => i >= 0)
  );
  let darkHits = 0;
  for (let i = 0; i < 2000; i++) {
    const { box } = selectImageBoxPrompt(excluded);
    if (box.paletteFamily === "dark-neon") darkHits++;
  }
  ok("excluded family never drawn (2000 draws)", darkHits === 0, String(darkHits));
}
