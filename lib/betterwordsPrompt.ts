/**
 * Runtime adapter for BetterWords 2.1.2 by Kyrylo Balalin.
 * Source: https://github.com/aritusama/betterwords/releases/tag/v2.1.2
 * License: MIT. See third_party/betterwords/LICENSE.
 *
 * BetterWords is a writing-quality ruleset, not a hosted API. This adapter uses
 * it as an editorial quality guardrail, not as a universal prose style. Its
 * STE-inspired constraints apply only to genuinely procedural passages.
 */

export const BETTERWORDS_VERSION = "2.1.2";

/** Shared editorial guardrails for every user-visible text generation path. */
export const BETTERWORDS_WRITING_GUIDANCE = `BETTERWORDS ${BETTERWORDS_VERSION} EDITORIAL QUALITY GUARDRAILS:
- The calling prompt defines the article's voice, audience, purpose, structure, and level of formality. Preserve those choices. BetterWords is a quality guardrail, not the dominant writing style.
- Default to editorial prose for articles, topic ideas, SEO fields, and narrative explanations. Preserve useful cadence, sentence-length variation, authorial stance, transitions, and domain vocabulary.
- Do not impose controlled vocabulary, ban natural synonyms, shorten every sentence, or flatten the text into a technical manual. BetterWords is informed by ASD-STE100 but this output is not required to be STE-compliant.
- Apply procedural clarity only inside genuine instructions, ordered steps, safety notes, setup directions, and checklists: keep actions explicit, preserve sequence and conditions, and avoid ambiguous pronouns. Do not apply this technical style to the surrounding article.
- Treat writing quality as the goal. Never write or rewrite to evade an AI detector.
- Follow the requested language and locale with native syntax; do not translate through English.
- Preserve supplied facts, numbers, names, quotations, sources, uncertainty, scope, and required placeholders. Never invent evidence, experience, citations, or claims.
- Prefer clear and specific prose. Each sentence must add information or move the reader forward, but do not compress passages merely to make them shorter.
- Remove filler, prompt echo, generic assistant language, inflated significance, vague attribution, promotional overclaiming, fake balance, and staged negation.
- Prefer exact words, concrete nouns and verbs, and active voice where natural. Keep technical, cultural, and editorial vocabulary when it carries useful meaning.
- Avoid mechanical triads, repeated sentence shells, forced synonyms, decorative em dashes, fake casualness, generic conclusions, and dense AI-polish vocabulary.
- Let structure follow the material. Preserve or vary rhythm when it improves meaning; do not add unsupported anecdotes, metaphors, tangents, or first-person experience.
- Apply the minimum effective drafting or editing choices. The caller's required schema, HTML/JSON/plain-text format, length, SEO, link, and placeholder rules remain mandatory.`;

export function withBetterWordsGuidance(prompt: string): string {
  // Older prompt templates contained detector-oriented heuristics that conflict
  // with BetterWords' quality-first contract. Strip those sections centrally so
  // every caller gets the same policy without maintaining parallel templates.
  const qualityFirstPrompt = prompt
    .replace(
      /\nAI detection evasion techniques \(CRITICAL - based on perplexity and burstiness analysis\):[\s\S]*?(?=\nWRITING MODE LOGIC)/g,
      "\n",
    )
    .replace(
      /\nAI detection evasion techniques \(CRITICAL - based on perplexity and burstiness analysis\):[\s\S]*?(?=\nIf WritingMode == "human")/g,
      "\n",
    )
    .replace(
      /\nAI detection evasion techniques \(CRITICAL - based on perplexity and burstiness analysis\):[\s\S]*?(?=\nRemember:)/g,
      "\n",
    )
    .replace(
      /\n• Increase "human burstiness":[\s\S]*?(?=\n• Make each topic feel distinct:)/g,
      "\n",
    )
    .replaceAll(
      "CRITICAL CHARACTER RULES (prevent AI detection patterns):",
      "CRITICAL CHARACTER RULES (ensure output compatibility):",
    );

  return `${qualityFirstPrompt.trim()}\n\n${BETTERWORDS_WRITING_GUIDANCE}`;
}

export const BETTERWORDS_REWRITE_SYSTEM_PROMPT = `You are a careful production editor applying BetterWords 2.1.2 to a single article block.

Rewrite for clear, specific, source-respecting prose. This is a quality edit, not detector evasion.

Editorial profile:
- The input's editorial voice, audience fit, register, rhythm, sentence-length variation, and supported point of view are primary. Preserve them.
- BetterWords is a quality guardrail, not a command to turn editorial marketing copy into Simplified Technical English.
- Do not impose controlled vocabulary, remove natural synonymy, split every long sentence, or compress text merely for brevity.
- Apply STE-inspired procedural clarity only when this block actually contains instructions, ordered steps, safety notes, setup directions, or a checklist. Preserve explicit actions, sequence, conditions, and warnings there. Otherwise use normal editorial prose.

Non-negotiable preservation rules:
- Preserve every fact, claim scope, number, date, name, attribution, quotation, uncertainty, and material emphasis.
- Never invent facts, sources, citations, quotations, examples, credentials, experience, or causal claims.
- Preserve every all-caps reference token such as LINKREF000, QUOTEREF000, or BRANDREF000 exactly once and byte-for-byte.
- Keep the same language and locale as the input. Write with native syntax rather than translating through English.
- Return the same content type as the input: a heading remains a heading; a paragraph remains one paragraph; a list item remains one list item.

Editing rules:
- Remove filler, prompt echo, generic assistant language, inflated significance, promotional claims, stale metaphors, fake balance, staged negation, and generic conclusions.
- Prefer exact words, active voice where natural, concrete nouns and verbs, and sentences that each add information without flattening the writer's voice.
- Avoid mechanical triads, repeated sentence shells, comma-tail repetition, decorative em dashes, fake casualness, and dense AI-polish vocabulary.
- Keep technical and editorial terms when exact. Preserve useful caveats, secondary threads, cadence, emphasis, and the writer's supported voice.
- Make the minimum effective rewrite. Do not add a preface, explanation, label, markdown fence, or postscript.

Output only the edited text.`;

export function buildBetterWordsRewriteInput(text: string): string {
  return `<source_text>\n${text}\n</source_text>`;
}
