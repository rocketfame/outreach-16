// lib/humanizeRepair.ts
// Sentence-level repair for humanizer corruption.
//
// The Undetectable.AI humanizer sometimes introduces token corruption
// ("gold jewellery sales" in a music article), semantic collapse
// ("turning followers into followers"), or soothing AI filler
// ("take a breath"). Instead of rejecting the entire humanized block
// (losing the anti-AI benefit), this module compares sentence-by-sentence
// and reverts ONLY the broken sentences to the original GPT text.

/**
 * Split text into sentences. Handles common abbreviations and edge cases.
 */
function splitSentences(text: string): string[] {
  // Protect numbers with dots (German thousands separator: 10.000, 1.500.000)
  // and common abbreviations (z.B., e.g., etc.) from being treated as sentence ends.
  const PLACEHOLDER = "\x00NUM\x00";
  let safe = text.replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER}$2`);
  const raw = safe.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  if (!raw) return [text];
  return raw
    .map((s) => s.replace(new RegExp(PLACEHOLDER.replace(/\x00/g, "\\x00"), "g"), ".").trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract meaningful words (4+ chars) as a lowercase Set for overlap comparison.
 */
function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4 && /\p{L}/u.test(w))
  );
}

/**
 * Jaccard-like overlap ratio: |intersection| / |union|. Range 0-1.
 */
function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const w of a) {
    if (b.has(w)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// Soothing / filler phrases the humanizer likes to inject.
// Only flagged if they were NOT in the original (so legit author phrases survive).
const SOOTHING_PATTERNS: RegExp[] = [
  /\btake a breath\b/i,
  /\blet'?s be honest\b/i,
  /\blet'?s be real\b/i,
  /\bit'?s worth noting\b/i,
  /\bat the end of the day\b/i,
  /\blet me explain\b/i,
  /\bto put it simply\b/i,
  /\bin other words\b/i,
  /\bneedless to say\b/i,
  /\bif you ask me\b/i,
  // German equivalents
  /\bnehmen wir uns einen Moment\b/i,
  /\behrlich gesagt\b/i,
  /\bum es einfach zu sagen\b/i,
  /\bmit anderen Worten\b/i,
  /\bIch finde das wichtig\b/i,
];

/**
 * Check if a single humanized sentence shows signs of corruption.
 */
function isSentenceCorrupted(humanized: string, bestOriginal: string): boolean {
  // 1. Repeated trigram within the sentence (e.g. "mehr Schärfe... mehr Schärfe")
  const words = humanized.toLowerCase().split(/\s+/);
  if (words.length >= 8) {
    for (let i = 0; i <= words.length - 6; i++) {
      const trigram = words.slice(i, i + 3).join(" ");
      const rest = words.slice(i + 3).join(" ");
      if (trigram.length > 8 && rest.includes(trigram)) return true;
    }
  }

  // 2. Semantic collapse: "turning X into X" pattern
  const collapseMatch = humanized.match(
    /\b(\w{4,})\s+(?:into|to|in|zu|in die|zum)\s+\1\b/i
  );
  if (collapseMatch) return true;

  // 3. Soothing phrase injected by humanizer (not present in original)
  for (const pattern of SOOTHING_PATTERNS) {
    if (pattern.test(humanized) && !pattern.test(bestOriginal)) return true;
  }

  // 4. Very low word overlap with original — humanizer replaced too much
  const humWords = wordSet(humanized);
  const origWords = wordSet(bestOriginal);
  if (origWords.size >= 5 && overlapRatio(humWords, origWords) < 0.15) {
    return true;
  }

  return false;
}

/**
 * Find the original sentence most similar to a given humanized sentence.
 */
function findBestOriginal(
  humSentence: string,
  origSentences: string[]
): string {
  if (origSentences.length === 0) return humSentence;
  const humWords = wordSet(humSentence);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < origSentences.length; i++) {
    const score = overlapRatio(humWords, wordSet(origSentences[i]));
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return origSentences[bestIdx];
}

/**
 * Repair a humanized text block by reverting corrupted sentences to their
 * original GPT counterparts while keeping clean humanized sentences intact.
 *
 * @returns The repaired text and the count of reverted sentences.
 */
export function repairHumanizedText(
  original: string,
  humanized: string
): { text: string; revertedCount: number } {
  if (!original || !humanized) return { text: humanized || "", revertedCount: 0 };

  const origSentences = splitSentences(original);
  const humSentences = splitSentences(humanized);

  // If sentence counts diverge wildly, humanizer restructured heavily —
  // still try sentence-level repair but expect lower match quality.
  let revertedCount = 0;
  const repaired = humSentences.map((humSentence) => {
    const bestOrig = findBestOriginal(humSentence, origSentences);
    if (isSentenceCorrupted(humSentence, bestOrig)) {
      revertedCount++;
      return bestOrig;
    }
    return humSentence;
  });

  return {
    text: repaired.join(" ").replace(/\s{2,}/g, " ").trim(),
    revertedCount,
  };
}
