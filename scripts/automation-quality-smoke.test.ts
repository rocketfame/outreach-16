import {
  findContentIntegrityIssues,
  findLanguageOrthographyIssue,
  repairSentenceCase,
  restoreBrandToken,
} from "@/lib/automation/contentQuality";
import { validateAutomationRequest } from "@/lib/automation/validate";
import {
  buildIndependentResearchQuery,
  buildLanguageOrthographyInstruction,
  INDEPENDENT_SOURCE_DOMAINS,
} from "@/lib/automation/pipeline";
import { getCostTracker } from "@/lib/costTracker";

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

const brokenAfterDeploy = `<p>770 caricamenti pubblicati nell'arco di una sola settimana.</p><p>Una domanda fissata in alto può orientare le risposte:</p><p>I creator piccoli spesso sbagliano tono. Chiedono</p>`;
const brokenIssues = findContentIntegrityIssues(brokenAfterDeploy);
check("bare-number fragment rejected", brokenIssues.some((issue) => issue.code === "invalid_sentence_start"));
check("mid-sentence truncation rejected", brokenIssues.some((issue) => issue.code === "missing_terminal_punctuation"));

const brokenBeforeDeploy = `<p>Un singolo pop ha bisogno di rumore concentrato. ". È più concreta: quali segnali sto dando nelle prossime 48 ore?</p>`;
check("orphan quote rejected", findContentIntegrityIssues(brokenBeforeDeploy).some((issue) => issue.code === "unbalanced_quotes"));
check("dangling colon rejected", findContentIntegrityIssues("<p>La procedura termina qui:</p>").some((issue) => issue.code === "dangling_colon"));
check("complete editorial prose accepted", findContentIntegrityIssues("<p>Questa frase è completa. Anche questa conserva un ritmo naturale.</p>").length === 0);
check("colon followed by list accepted", findContentIntegrityIssues("<p>Segui questi passaggi:</p><ul><li>Primo</li></ul>").length === 0);
check("common abbreviation does not trigger fragment guard", findContentIntegrityIssues("<p>Usa fonti affidabili, ad es. documentazione ufficiale.</p>").length === 0);

// EN humanize casing regression (gen_93d0e0e315df / gen_fbd8235d9760):
// connector removal ("Ultimately, ", "In conclusion, ", "It's worth noting
// that ") left lowercase sentence starts and the paid job died with
// truncated_output on paragraph 16/17.
const enCasingBroken = "<p>The strategy holds. the campaign compounds weekly. consistency wins.</p>";
check("EN lowercase sentence start is repaired, not failed", findContentIntegrityIssues(repairSentenceCase(enCasingBroken)).length === 0);
check("repair uppercases after sentence boundary", repairSentenceCase(enCasingBroken).includes(". The campaign"));
check("repair fixes lowercase paragraph start", repairSentenceCase("<p>consistency matters here.</p>").startsWith("<p>Consistency"));
check("repair works on plain humanizer output", repairSentenceCase("the fans respond. growth follows.") === "The fans respond. Growth follows.");
check("repair never touches anchor text", repairSentenceCase('<p><a href="https://x.com">music promotion</a> is the lever. It works.</p>').includes(">music promotion<"));
check("lowercase money anchor does not flag validator", findContentIntegrityIssues('<p><a href="https://x.com">music promotion</a> is the lever. It works.</p>').length === 0);
check("camelCase brand start is not treated as truncation", repairSentenceCase("<p>Great tools exist. iPhone apps lead.</p>").includes(". iPhone") && findContentIntegrityIssues("<p>Great tools exist. iPhone apps lead.</p>").length === 0);
check("mid-paragraph digit sentence start is legitimate", findContentIntegrityIssues("<p>The scene changed fast. 2026 raised the bar.</p>").length === 0);
check("integrity error message carries the broken fragment", findContentIntegrityIssues("<p>Numbers grow. the chart proves it.</p>").some((issue) => issue.message.includes("the chart proves")));

check("Italian apostrophe substitution rejected", !!findLanguageOrthographyIssue("<p>Perche&#39; e&#39; gia&#39; piu&#39; chiaro.</p>", "Italian"));
check("correct Italian diacritics accepted", !findLanguageOrthographyIssue("<p>Perché è già più chiaro.</p>", "Italian"));
const italianPrompt = buildLanguageOrthographyInstruction("Italian");
check("Italian prompt requires native diacritics", italianPrompt.includes("è") && italianPrompt.includes("perche'") && italianPrompt.includes("never substitute apostrophe"));

const commercialResearchQuery = buildIndependentResearchQuery(
  "Compra Follower TikTok: Come Aumentare la Credibilità del Profilo",
  "TikTok"
);
check("commercial verb removed from research query", !/\bcompra\b/i.test(commercialResearchQuery), commercialResearchQuery);
check("research query keeps platform and informational intent", commercialResearchQuery.includes("TikTok") && commercialResearchQuery.includes("consumer trust"), commercialResearchQuery);
check("independent domain filter uses bare domains", INDEPENDENT_SOURCE_DOMAINS.every((domain) => !domain.startsWith("site:")));

const brandHtml = restoreBrandToken(
  '<p>Promo Sound Group lavora con i creator. promosoundgroup resta coerente.</p><a href="https://example.com/Promo Sound Group">Link</a>',
  "PromoSoundGroup",
);
check("spaced CamelCase brand repaired", (brandHtml.match(/PromoSoundGroup/g) || []).length === 2, brandHtml);
check("visible spaced brand removed", !brandHtml.includes("<p>Promo Sound Group"), brandHtml);
check("HTML attributes left untouched", brandHtml.includes('href="https://example.com/Promo Sound Group"'), brandHtml);

const defaults = validateAutomationRequest({ niche: "Music industry", category: "Spotify" });
check("billing defaults to backward-compatible auto", defaults.billing === "auto");
check("automation cover defaults to WebP", defaults.coverFormat === "webp");
const explicit = validateAutomationRequest({
  niche: "Music industry",
  category: "Spotify",
  billing: "subscription",
  coverFormat: "png",
});
check("subscription preference validates for synchronous route rejection", explicit.billing === "subscription");
check("PNG remains explicitly available", explicit.coverFormat === "png");

const costTracker = getCostTracker();
costTracker.reset();
costTracker.trackOpenAIChat("gpt-5.5", 1_000_000, 0);
check("GPT-5.5 input cost uses per-million pricing correctly", costTracker.getTotalCosts().openai === 5);
costTracker.reset();

if (failures > 0) {
  console.log(`\n${failures} automation quality smoke check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll automation quality smoke checks passed.");
}
