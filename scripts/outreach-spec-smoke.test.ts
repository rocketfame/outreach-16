import {
  stripDisallowedLinks,
  shortenExternalLinkTexts,
  cleanQuoteDebris,
  repairMoneyAnchor,
  anchorInFirstParagraphs,
  hasGluedLinks,
  enforceSingleMention,
  displayNameForUrl,
} from "@/lib/automation/linkGuard";
import { createPlaceholderProtection } from "@/lib/sectionHumanize";
import { getSourcePolicyDecision } from "@/lib/sourcePolicy";
import { validateAutomationRequest, AutomationValidationError } from "@/lib/automation/validate";

const ok = (label: string, cond: boolean, detail?: string) =>
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && detail ? ` :: ${detail}` : ""}`);

const ANCHOR_URL = "https://promosoundgroup.net/promo";

// A2: streamscharts/twitchtracker now allowed as research, inksem denied
ok("streamscharts allowed as research", getSourcePolicyDecision({ url: "https://streamscharts.com/overview", title: "", snippet: "" }).forcedType === "stats_or_research");
ok("twitchtracker allowed as research", getSourcePolicyDecision({ url: "https://twitchtracker.com/statistics", title: "", snippet: "" }).allowed);
ok("inksem denied", !getSourcePolicyDecision({ url: "https://inksem.com/guide", title: "", snippet: "" }).allowed);

// A3: clause anchors shortened to resource names
{
  const html = `<p>See <a href="https://support.google.com/youtube/answer/9?hl=en">its own explainer on how recommendations work</a> and <a href="https://pewresearch.org/x">Pew Research Center</a> and <a href="${ANCHOR_URL}">a very long money anchor stays untouched here</a>.</p>`;
  const out = shortenExternalLinkTexts(html, ANCHOR_URL);
  ok("7-word citation anchor → resource name", out.includes(">YouTube Help</a>"), out);
  ok("4-word citation anchor kept", out.includes(">Pew Research Center</a>"));
  ok("money anchor never shortened", out.includes("a very long money anchor stays untouched here"));
  ok("display name for twitchtracker", displayNameForUrl("https://twitchtracker.com/statistics") === "TwitchTracker");
}

// A4: money anchor exact + whole
{
  const html = `<p>Intro sentence. <a href="${ANCHOR_URL}">the platform</a> helps.</p><p>Also <a href="${ANCHOR_URL}">beatport promo</a> again.</p>`;
  const { html: out, found } = repairMoneyAnchor(html, "beatport promo", ANCHOR_URL);
  ok("anchor text repaired to exact", out.includes(`>beatport promo</a> helps`), out);
  ok("duplicate anchor link unwrapped", (out.match(new RegExp(ANCHOR_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 1);
  ok("anchor found", found);
  ok("glued link detected", hasGluedLinks(`<p><a href="x">the platform</a>tion begins</p>`));
  ok("clean html has no glued links", !hasGluedLinks(out));
  ok("anchor in first 3 paragraphs", anchorInFirstParagraphs(out, ANCHOR_URL, 3));
  ok("anchor NOT in first 1 paragraph check works", anchorInFirstParagraphs(`<p>one</p><p>two</p><p>x <a href="${ANCHOR_URL}">a</a></p>`, ANCHOR_URL, 3));
}

// A4-bis: enforceSingleMention respects word boundaries and link text
{
  const html = `<p>Promotion begins with promo basics. Use promo wisely. <a href="${ANCHOR_URL}">promo</a> here.</p>`;
  const out = enforceSingleMention(html, "promo");
  ok("no match inside 'Promotion'", out.includes("Promotion begins"));
  ok("link text untouched", out.includes(`>promo</a>`));
  ok("link mention counts as the one mention — plain duplicates replaced", out.includes("with the platform basics") && out.includes("Use the platform wisely"), out);
}
{
  const html = `<p>Start promo here. Then promo again. No link anywhere.</p>`;
  const out = enforceSingleMention(html, "promo");
  ok("without link: first plain mention kept", out.includes("Start promo here") && out.includes("Then the platform again"), out);
}

// A5: disallowed link removes whole sentence, not just the tag
{
  const html = `<p>Good opening sentence. Creators compare numbers on <a href="https://www.reddit.com/r/Twitch/comments/x">this thread</a> every week. Final sentence stays.</p>`;
  const out = stripDisallowedLinks(html, ANCHOR_URL);
  ok("sentence with forum link removed", !out.includes("reddit") && !out.includes("this thread") && !out.includes("every week"));
  ok("surrounding sentences intact", out.includes("Good opening sentence.") && out.includes("Final sentence stays."));
}
{
  const html = `<ul><li>Tip one is fine</li><li>See <a href="https://backlinko.com/x">Backlinko</a> for stats</li></ul>`;
  const out = stripDisallowedLinks(html, ANCHOR_URL);
  ok("li with SEO-blog link dropped", !out.includes("Backlinko") && out.includes("Tip one is fine"));
}
{
  const html = `<p>The anchor sentence has <a href="${ANCHOR_URL}">promo</a> and <a href="https://quora.com/q">bad link</a> together. Next.</p>`;
  const out = stripDisallowedLinks(html, ANCHOR_URL);
  ok("anchor sentence never removed", out.includes(`href="${ANCHOR_URL}"`), out);
  ok("bad link unwrapped inside anchor sentence", !out.includes("quora.com") && out.includes("bad link"));
}

// A5: quote debris
{
  const html = `<p>That question should be narrow. " is narrow. " is too vague to manage.</p><p>" The second version gives clarity.</p><p>Normal "quoted phrase" stays.</p>`;
  const out = cleanQuoteDebris(html);
  ok("orphan floating quotes removed", !/\s"\s/.test(out.replace(/<[^>]+>/g, " ")), out);
  ok("paragraph-opening orphan quote removed", !out.includes(`<p>" The second`) && !out.includes(`<p>"The second`));
  ok("balanced quotes preserved", out.includes(`"quoted phrase"`));
}

// A5: quotes survive humanizer round-trip
{
  const { protectPlaceholders, restorePlaceholders } = createPlaceholderProtection([]);
  const input = `He said "keep the hook under three seconds" and moved on.`;
  const protectedText = protectPlaceholders(input);
  ok("quoted span tokenized", !protectedText.includes("keep the hook"));
  const restored = restorePlaceholders(protectedText.replace("He said", "The editor said").replace("and moved on", "then continued"));
  ok("quoted span restored verbatim", restored.includes(`"keep the hook under three seconds"`), restored);
}

// A1: seoTitleMaxChars validation
{
  const base = { niche: "Music industry", category: "Spotify" };
  const r = validateAutomationRequest({ ...base, seoTitleMaxChars: 70 });
  ok("seoTitleMaxChars accepted", r.seoTitleMaxChars === 70);
  const rd = validateAutomationRequest({ ...base });
  ok("seoTitleMaxChars default 65", rd.seoTitleMaxChars === 65);
  try {
    validateAutomationRequest({ ...base, seoTitleMaxChars: 10 });
    ok("seoTitleMaxChars out of range rejected", false);
  } catch (e) { ok("seoTitleMaxChars out of range rejected", (e as AutomationValidationError).field === "seoTitleMaxChars"); }
}
