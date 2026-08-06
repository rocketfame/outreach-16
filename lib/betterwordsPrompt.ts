/**
 * Runtime adapter for BetterWords 2.1.2 by Kyrylo Balalin.
 * Source: https://github.com/aritusama/betterwords/releases/tag/v2.1.2
 * License: MIT. See third_party/betterwords/LICENSE.
 *
 * BetterWords is a writing-quality ruleset, not a hosted API. This compact
 * adapter keeps the rewrite-relevant rules in the system prompt so it can be
 * used as the local OpenAI-backed fallback for Undetectable.AI credit errors.
 */

export const BETTERWORDS_VERSION = "2.1.2";

/** Shared drafting rules for every user-visible text generation path. */
export const BETTERWORDS_WRITING_GUIDANCE = `BETTERWORDS ${BETTERWORDS_VERSION} PRODUCTION WRITING RULES:
- Treat writing quality as the goal. Never write or rewrite to evade an AI detector.
- Follow the requested language and locale with native syntax; do not translate through English.
- Preserve supplied facts, numbers, names, quotations, sources, uncertainty, scope, and required placeholders. Never invent evidence, experience, citations, or claims.
- Prefer clear, specific, economical prose. Each sentence must add information or move the reader forward.
- Remove filler, prompt echo, generic assistant language, inflated significance, vague attribution, promotional overclaiming, fake balance, and staged negation.
- Prefer plain exact words, concrete nouns and verbs, and active voice where natural. Keep technical terms when they are the precise choice.
- Avoid mechanical triads, repeated sentence shells, forced synonyms, decorative em dashes, fake casualness, generic conclusions, and dense AI-polish vocabulary.
- Let structure follow the material. Vary rhythm only when it improves meaning; do not add fragments, tangents, anecdotes, metaphors, or first-person experience unless supported and useful.
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

Non-negotiable preservation rules:
- Preserve every fact, claim scope, number, date, name, attribution, quotation, uncertainty, and material emphasis.
- Never invent facts, sources, citations, quotations, examples, credentials, experience, or causal claims.
- Preserve every all-caps reference token such as LINKREF000, QUOTEREF000, or BRANDREF000 exactly once and byte-for-byte.
- Keep the same language and locale as the input. Write with native syntax rather than translating through English.
- Return the same content type as the input: a heading remains a heading; a paragraph remains one paragraph; a list item remains one list item.

Editing rules:
- Remove filler, prompt echo, generic assistant language, inflated significance, promotional claims, stale metaphors, fake balance, staged negation, and generic conclusions.
- Prefer plain exact words, active voice where natural, concrete nouns and verbs, and sentences that each add information.
- Avoid mechanical triads, repeated sentence shells, comma-tail repetition, decorative em dashes, fake casualness, and dense AI-polish vocabulary.
- Keep technical terms when exact. Preserve useful caveats, secondary threads, and the writer's supported voice.
- Make the minimum effective rewrite. Do not add a preface, explanation, label, markdown fence, or postscript.

Output only the edited text.`;

export function buildBetterWordsRewriteInput(text: string): string {
  return `<source_text>\n${text}\n</source_text>`;
}
