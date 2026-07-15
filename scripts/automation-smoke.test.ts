import { validateAutomationRequest, AutomationValidationError } from "@/lib/automation/validate";

function expectOk(label: string, input: unknown, checks: (r: ReturnType<typeof validateAutomationRequest>) => void) {
  try {
    const r = validateAutomationRequest(input);
    checks(r);
    console.log(`PASS ${label}`);
  } catch (e) {
    console.log(`FAIL ${label}: ${(e as Error).message}`);
  }
}

function expectErr(label: string, input: unknown, field?: string, hasAllowed?: boolean) {
  try {
    validateAutomationRequest(input);
    console.log(`FAIL ${label}: expected error, got success`);
  } catch (e) {
    const err = e as AutomationValidationError;
    const fieldOk = !field || err.field === field;
    const allowedOk = !hasAllowed || Array.isArray(err.allowed);
    console.log(`${fieldOk && allowedOk ? "PASS" : "FAIL"} ${label}: ${err.message} [field=${err.field}, allowed=${JSON.stringify(err.allowed)}]`);
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
