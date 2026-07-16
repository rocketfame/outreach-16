import { validateAutomationRequest, AutomationValidationError } from "@/lib/automation/validate";
import { getSourcePolicyDecision, isUgcOrForumUrl, isSeoBlogUrl } from "@/lib/sourcePolicy";
import { stripDisallowedLinks, normalizeGoogleSupportLocale } from "@/lib/automation/linkGuard";
import { createPlaceholderProtection } from "@/lib/sectionHumanize";

const ok = (label: string, cond: boolean, detail?: string) =>
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && detail ? ` :: ${detail}` : ""}`);

// ── P1: brand param ─────────────────────────────────────────────
const base = { niche: "Music industry", category: "Spotify" };
let r = validateAutomationRequest({ ...base, brand: "PromoSoundGroup" });
ok("brand accepted as plain name", r.brand === "PromoSoundGroup");
try {
  validateAutomationRequest({ ...base, brand: "https://promosoundgroup.net" });
  ok("brand URL rejected", false);
} catch (e) { ok("brand URL rejected", (e as AutomationValidationError).field === "brand"); }
try {
  validateAutomationRequest({ ...base, brand: "promosoundgroup.net" });
  ok("brand bare domain rejected", false);
} catch (e) { ok("brand bare domain rejected", (e as AutomationValidationError).field === "brand"); }
r = validateAutomationRequest({ ...base, brief: "Mention PromoSoundGroup 2-3 times, naturally" });
ok("custom brief accepted", r.brief.includes("2-3 times"));

// P1: humanizer freeze — brand with dot survives round-trip
{
  const { protectPlaceholders, restorePlaceholders } = createPlaceholderProtection(["PromoSoundGroup.net", "PromoSoundGroup"]);
  const input = "Platforms such as PromoSoundGroup.net are sometimes used. Also [A1] here.";
  const protectedText = protectPlaceholders(input);
  ok("brand tokenized before humanizer", !protectedText.toLowerCase().includes("promosoundgroup"));
  ok("placeholder tokenized", !protectedText.includes("[A1]"));
  // Simulate humanizer rewriting everything around tokens
  const humanized = protectedText.replace("Platforms such as", "Creators sometimes lean on").replace("are sometimes used", "while tracking signals");
  const restored = restorePlaceholders(humanized);
  ok("brand survives humanizer round-trip", restored.includes("PromoSoundGroup.net") && restored.includes("[A1]"), restored);
}

// ── P3: source policy ───────────────────────────────────────────
const thread = { url: "https://support.google.com/youtube/thread/345734787/my-shorts-video?hl=hi", title: "My shorts get 2 views", snippet: "" };
const answer = { url: "https://support.google.com/youtube/answer/9891124?hl=en", title: "YouTube Shorts fundamentals", snippet: "" };
const seo = { url: "https://backlinko.com/twitch-users", title: "Twitch stats", snippet: "" };
const reddit = { url: "https://www.reddit.com/r/Twitch/comments/xyz", title: "", snippet: "" };
ok("google support thread denied", !getSourcePolicyDecision(thread).allowed, getSourcePolicyDecision(thread).reason);
ok("google support answer allowed (prio 100)", getSourcePolicyDecision(answer).allowed && getSourcePolicyDecision(answer).priority === 100);
ok("backlinko denied", !getSourcePolicyDecision(seo).allowed);
ok("reddit denied", !getSourcePolicyDecision(reddit).allowed);
ok("isUgcOrForumUrl thread", isUgcOrForumUrl(thread.url));
ok("isSeoBlogUrl backlinko", isSeoBlogUrl(seo.url));

// hl normalization
ok("hl=hi → hl=en", normalizeGoogleSupportLocale("https://support.google.com/youtube/answer/123?hl=hi").includes("hl=en"));
ok("hl=en-on-2 → hl=en", normalizeGoogleSupportLocale("https://support.google.com/youtube/answer/123?hl=en-on-2").includes("hl=en"));
ok("non-google URL untouched", normalizeGoogleSupportLocale("https://beatportal.com/guide?hl=de") === "https://beatportal.com/guide?hl=de");

// final link guard
const html = '<p>See <a href="https://support.google.com/youtube/thread/1/complaint">this thread</a> and <a href="https://youtube.com/watch?v=Js7m8yWGBXU">video</a> and <a href="https://promosoundgroup.net/promo">anchor</a> and <a href="https://support.google.com/youtube/answer/9?hl=hi">docs</a>.</p>';
const guarded = stripDisallowedLinks(html, "https://promosoundgroup.net/promo");
ok("thread link unwrapped, text kept", !guarded.includes("thread/1") && guarded.includes("this thread"));
ok("video link unwrapped", !guarded.includes("watch?v="));
ok("anchor link preserved", guarded.includes('href="https://promosoundgroup.net/promo"'));
ok("docs link hl rewritten", guarded.includes("hl=en") && !guarded.includes("hl=hi"));
