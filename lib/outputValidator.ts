// lib/outputValidator.ts
// Final validation pass for generated article HTML.
// Detects and fixes structural issues AFTER all post-processing is done:
// - Truncated numbers (German thousands separator: "000 Views" → should be "10.000 Views")
// - Duplicated consecutive sentences
// - Dangling/incomplete sentences
// - Broken table/list structures
// - Placeholder artifacts that survived post-processing

export interface ValidationResult {
  html: string;
  fixes: string[];       // Human-readable list of fixes applied
  warnings: string[];    // Issues detected but NOT auto-fixable
}

// ─── SENTENCE SPLITTING (number-safe) ────────────────────────────────────────
// Protects German thousands-separator dots (10.000) from being treated as sentence ends.
const NUM_PH = "\x00N\x00";

function safeSplitSentences(text: string): string[] {
  const safe = text.replace(/(\d)\.(\d)/g, `$1${NUM_PH}$2`);
  const raw = safe.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  if (!raw) return [text];
  return raw.map(s => s.replace(/\x00N\x00/g, ".").trim()).filter(Boolean);
}

// ─── 1. TRUNCATED NUMBERS ────────────────────────────────────────────────────
// Detect orphaned "000" that should be "N.000" (German thousands).
// Pattern: text context where "000" appears at word boundary without a leading digit-dot.
function fixTruncatedNumbers(html: string, fixes: string[]): string {
  // Match standalone "000" at word start (not preceded by digit+dot) followed by common units
  // E.g. " 000 Views" → flag as truncated.  Won't match "100.000" (correct).
  const truncatedPattern = /(?<![.\d])(?<=\s|>)0{3,}(?=\s+(?:Views|Plays|Streams|Follower|Abonnenten|Aufrufe|Likes|Kommentare|Downloads|Listeners|Hörer|Klicks|Impressionen|Impressions|Subscribers|Zuschauer|Users|Nutzer|Listens|Shares|Reads|Words|Wörter))/gi;

  return html.replace(truncatedPattern, (match) => {
    fixes.push(`Truncated number detected: "${match}" appears without leading digits (likely "N.${match}"). Kept as-is — cannot reconstruct the original number.`);
    return match; // We can't guess the original number, but we flag it
  });
}

// ─── 2. DUPLICATED CONSECUTIVE SENTENCES ─────────────────────────────────────
// Remove exact or near-duplicate sentences that appear back-to-back.
function deduplicateConsecutiveSentences(text: string, fixes: string[]): string {
  const sentences = safeSplitSentences(text);
  if (sentences.length < 2) return text;

  const kept: string[] = [sentences[0]];
  const seenNorms = new Set<string>([normalize(sentences[0])]);

  for (let i = 1; i < sentences.length; i++) {
    const curr = normalize(sentences[i]);

    // Skip empty
    if (!curr) continue;
    // Very short sentences — keep always (e.g. "Ja." or "Nein.")
    if (curr.length < 15) { kept.push(sentences[i]); continue; }

    // Exact duplicate of ANY previously seen sentence in this paragraph
    if (seenNorms.has(curr)) {
      fixes.push(`Removed duplicated sentence: "${sentences[i].substring(0, 80)}…"`);
      continue;
    }

    // Near-duplicate: >85% word overlap with any seen sentence
    let isDupe = false;
    if (curr.length > 30) {
      const currWords = new Set(curr.split(/\s+/).filter(w => w.length >= 4));
      if (currWords.size >= 4) {
        for (const prevNorm of seenNorms) {
          if (prevNorm.length < 30) continue;
          const prevWords = new Set(prevNorm.split(/\s+/).filter(w => w.length >= 4));
          if (prevWords.size < 4) continue;
          let overlap = 0;
          for (const w of currWords) { if (prevWords.has(w)) overlap++; }
          const ratio = overlap / Math.min(prevWords.size, currWords.size);
          if (ratio > 0.85) {
            fixes.push(`Removed near-duplicate sentence (${Math.round(ratio * 100)}% overlap): "${sentences[i].substring(0, 80)}…"`);
            isDupe = true;
            break;
          }
        }
      }
    }
    if (isDupe) continue;

    seenNorms.add(curr);
    kept.push(sentences[i]);
  }

  return kept.join(" ");
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\s]/g, "").replace(/\s+/g, " ").trim();
}

// ─── 3. DANGLING / INCOMPLETE SENTENCES ──────────────────────────────────────
// Detect sentences that start a thought but never finish it.
const DANGLING_PATTERNS: RegExp[] = [
  // German
  /^(?:Die Frage ist|Ein Creator verspricht|Das bedeutet|Zum Beispiel|Etwa wenn|Stell dir vor)\s*[…:,]?\s*$/i,
  // English
  /^(?:The question is|A creator promises|For example|This means|Imagine|Consider)\s*[…:,]?\s*$/i,
  // Ends with ellipsis or colon only (no continuation)
  /^[^.!?]{10,}[…:]\s*$/,
];

function detectDanglingSentences(text: string, warnings: string[]): void {
  const sentences = safeSplitSentences(text);
  for (const s of sentences) {
    for (const pattern of DANGLING_PATTERNS) {
      if (pattern.test(s.trim())) {
        warnings.push(`Possible incomplete sentence: "${s.trim().substring(0, 100)}"`);
        break;
      }
    }
  }
}

// ─── 4. STRUCTURAL INTEGRITY ─────────────────────────────────────────────────

// 4a. Tables: check that every <table> has matching </table>, rows have consistent cell counts
function validateTables(html: string, warnings: string[]): void {
  const openTables = (html.match(/<table[^>]*>/gi) || []).length;
  const closeTables = (html.match(/<\/table>/gi) || []).length;
  if (openTables !== closeTables) {
    warnings.push(`Table tag mismatch: ${openTables} <table> vs ${closeTables} </table>`);
  }

  // Check each table for consistent column counts
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  let tableIndex = 0;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    tableIndex++;
    const tableContent = tableMatch[1];
    const rows = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const cellCounts = rows.map(row => {
      const cells = row.match(/<(?:td|th)[^>]*>/gi) || [];
      return cells.length;
    });
    if (cellCounts.length > 1) {
      const expected = cellCounts[0];
      const inconsistent = cellCounts.filter(c => c !== expected);
      if (inconsistent.length > 0) {
        warnings.push(`Table ${tableIndex}: inconsistent column count (header has ${expected} columns, but some rows have ${inconsistent[0]})`);
      }
    }
  }
}

// 4b. Lists: check that <ul>/<ol> have matching close tags and contain <li> children
function validateLists(html: string, warnings: string[]): void {
  const openUl = (html.match(/<ul[^>]*>/gi) || []).length;
  const closeUl = (html.match(/<\/ul>/gi) || []).length;
  if (openUl !== closeUl) {
    warnings.push(`List tag mismatch: ${openUl} <ul> vs ${closeUl} </ul>`);
  }
  const openOl = (html.match(/<ol[^>]*>/gi) || []).length;
  const closeOl = (html.match(/<\/ol>/gi) || []).length;
  if (openOl !== closeOl) {
    warnings.push(`List tag mismatch: ${openOl} <ol> vs ${closeOl} </ol>`);
  }

  // Check for empty lists (no <li> inside)
  const emptyListPattern = /<(?:ul|ol)[^>]*>\s*<\/(?:ul|ol)>/gi;
  const emptyLists = html.match(emptyListPattern);
  if (emptyLists) {
    warnings.push(`Found ${emptyLists.length} empty list(s) with no <li> items`);
  }
}

// 4c. Section transitions: detect headings immediately followed by another heading (no content between)
function validateSectionTransitions(html: string, warnings: string[]): void {
  const backToBackHeadings = /<\/h[2-6]>\s*<h[2-6][^>]*>/gi;
  const matches = html.match(backToBackHeadings);
  if (matches && matches.length > 0) {
    warnings.push(`Found ${matches.length} heading(s) immediately followed by another heading with no content between them`);
  }
}

// ─── 5. PLACEHOLDER / ARTIFACT DETECTION ─────────────────────────────────────
function detectArtifacts(html: string, warnings: string[]): void {
  // Unreplaced placeholders
  const placeholders = html.match(/\[(A1|T[1-8])\]/g);
  if (placeholders) {
    warnings.push(`Unreplaced placeholder(s) in final output: ${[...new Set(placeholders)].join(", ")}`);
  }

  // Template variables
  const templateVars = html.match(/\[\[([A-Z_]+)\]\]/g);
  if (templateVars) {
    warnings.push(`Unreplaced template variable(s): ${[...new Set(templateVars)].join(", ")}`);
  }

  // Raw URLs not wrapped in <a> tags (common when trust source injection fails)
  // Only match http(s) URLs that are NOT inside href="..." or src="..."
  const rawUrlPattern = /(?<!=["'])https?:\/\/[^\s<>"]+(?=[<\s]|$)/g;
  // Filter: only flag if not preceded by href=" or src="
  const textContent = html.replace(/<[^>]+>/g, " ");
  const rawUrls = textContent.match(rawUrlPattern);
  if (rawUrls && rawUrls.length > 0) {
    warnings.push(`Found ${rawUrls.length} raw URL(s) not wrapped in <a> tags`);
  }
}

// ─── 6. PARAGRAPH-LEVEL DEDUP ────────────────────────────────────────────────
// Applies consecutive sentence dedup to each paragraph independently.
// Works on the PLAIN TEXT of each <p> block to avoid breaking inline HTML tags.
function deduplicateParagraphs(html: string, fixes: string[]): string {
  return html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (fullMatch, inner: string) => {
    // Extract plain text (strip inline tags) for sentence comparison
    const plainText = inner.replace(/<[^>]+>/g, "").trim();
    if (plainText.length < 80) return fullMatch; // too short to have duplicates

    const cleaned = deduplicateConsecutiveSentences(plainText, fixes);
    if (cleaned === plainText) return fullMatch; // no change

    // Rebuild: since we can't surgically remove sentences from HTML with inline tags,
    // replace the full paragraph content with the deduplicated plain text.
    // This loses inline formatting within removed sentences, but keeps the article correct.
    const tagMatch = fullMatch.match(/^(<p[^>]*>)/i);
    const openTag = tagMatch ? tagMatch[1] : "<p>";
    return `${openTag}${cleaned}</p>`;
  });
}

// ─── MAIN VALIDATOR ──────────────────────────────────────────────────────────

/**
 * Run all validation checks on final article HTML.
 * Fixes what can be auto-fixed, warns about the rest.
 */
export function validateArticleOutput(html: string): ValidationResult {
  if (!html) return { html, fixes: [], warnings: [] };

  const fixes: string[] = [];
  const warnings: string[] = [];

  let result = html;

  // 1. Fix truncated numbers (detection + flag)
  result = fixTruncatedNumbers(result, fixes);

  // 2. Deduplicate consecutive sentences within paragraphs
  result = deduplicateParagraphs(result, fixes);

  // 3. Detect dangling/incomplete sentences
  const plainText = result.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  detectDanglingSentences(plainText, warnings);

  // 4. Structural integrity
  validateTables(result, warnings);
  validateLists(result, warnings);
  validateSectionTransitions(result, warnings);

  // 5. Artifact detection
  detectArtifacts(result, warnings);

  return { html: result, fixes, warnings };
}
