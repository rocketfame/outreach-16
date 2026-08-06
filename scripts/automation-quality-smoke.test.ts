import {
  findContentIntegrityIssues,
  findLanguageOrthographyIssue,
  restoreBrandToken,
} from "@/lib/automation/contentQuality";
import { validateAutomationRequest } from "@/lib/automation/validate";
import { buildLanguageOrthographyInstruction } from "@/lib/automation/pipeline";
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

check("Italian apostrophe substitution rejected", !!findLanguageOrthographyIssue("<p>Perche&#39; e&#39; gia&#39; piu&#39; chiaro.</p>", "Italian"));
check("correct Italian diacritics accepted", !findLanguageOrthographyIssue("<p>Perché è già più chiaro.</p>", "Italian"));
const italianPrompt = buildLanguageOrthographyInstruction("Italian");
check("Italian prompt requires native diacritics", italianPrompt.includes("è") && italianPrompt.includes("perche'") && italianPrompt.includes("never substitute apostrophe"));

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
