// lib/articleFinalize.ts
// Structure → final HTML. Extracted from app/api/articles/route.ts so the
// automation pipeline can render an article it humanized itself (after the
// acceptance checks) with exactly the same chain the UI route uses:
// prompt-leak strip → empty-block filter → trust placeholder validation →
// raw URL safety net → blocksToHtml → tag spacing / bold / invisible chars.

import { cleanText, fixHtmlTagSpacing, removeExcessiveBold, stripPromptLeaks } from "@/lib/textPostProcessing";
import {
  blocksToHtml,
  type ArticleBlockBase,
  type ArticleStructure,
  type ListBlock,
  type TableBlock,
} from "@/lib/articleStructure";

export interface FinalizeArticleResult {
  html: string;
  /** Sentences removed because they carried prompt scaffolding markers. */
  leaksFound: string[];
  /** Placeholders like [A1]/[T2] that survived HTML rendering (should be 0). */
  placeholdersRemaining: string[];
  linkCount: number;
}

function collectStructureText(structure: ArticleStructure): string {
  return structure.blocks
    .map((block) => {
      if (block.type === "ul" || block.type === "ol") {
        return (block as ListBlock).items?.map((item: ArticleBlockBase) => item.text || "").join(" ") || "";
      }
      if (block.type === "table") {
        const t = block as TableBlock;
        return [t.caption || "", ...(t.headers || []), ...(t.rows || []).flat()].join(" ");
      }
      return block.text || "";
    })
    .join(" ");
}

/**
 * Render an ArticleStructure to the cleaned body HTML. Mutates nothing; the
 * returned HTML is what the article route ships as articleBodyHtml (before
 * the output validator pass).
 */
export function finalizeArticleHtml(input: ArticleStructure, topicTitle: string): FinalizeArticleResult {
  const articleStructure: ArticleStructure = { ...input, blocks: [...input.blocks] };

  // ── PROMPT-LEAK SAFETY NET ────────────────────────────────────────────
  // The model (and the humanizer) occasionally leak prompt scaffolding into
  // the body — "Here is the user's input:" and friends. Strip offending
  // sentences; the marker list in textPostProcessing is deliberately narrow.
  const leaksFound: string[] = [];
  const stripBlock = (s: string | undefined): string | undefined => {
    if (!s) return s;
    const r = stripPromptLeaks(s);
    if (r.removedSentences.length > 0) leaksFound.push(...r.removedSentences);
    return r.cleaned;
  };
  articleStructure.blocks = articleStructure.blocks.map((block) => {
    if (block.type === "ul" || block.type === "ol") {
      const lb = block as ListBlock;
      return { ...lb, items: (lb.items || []).map((item) => ({ ...item, text: stripBlock(item.text) || "" })) };
    }
    if (block.type === "table") {
      const tb = block as TableBlock;
      return {
        ...tb,
        caption: stripBlock(tb.caption),
        rows: (tb.rows || []).map((row) => (row || []).map((cell) => stripBlock(cell) || "")),
      };
    }
    return { ...block, text: stripBlock(block.text) || "" };
  });
  // Drop any block emptied by leak removal (otherwise we'd render <p></p>).
  articleStructure.blocks = articleStructure.blocks.filter((block) => {
    if (block.type === "ul" || block.type === "ol") {
      return ((block as ListBlock).items || []).some((i) => (i.text || "").trim().length > 0);
    }
    if (block.type === "table") {
      const tb = block as TableBlock;
      return !!(
        (tb.caption && tb.caption.trim().length > 0) ||
        (tb.rows || []).some((r) => (r || []).some((c) => (c || "").trim().length > 0))
      );
    }
    return (block.text || "").trim().length > 0;
  });
  if (leaksFound.length > 0) {
    console.warn(
      `[articles-api] PROMPT LEAK STRIPPED: removed ${leaksFound.length} sentence(s) containing AI scaffolding markers from topic "${topicTitle}". First match: "${leaksFound[0].slice(0, 120)}"`
    );
  }

  // ── Trust source placeholder validation (warnings only) ──────────────
  if (articleStructure.trustSources.length > 0) {
    const allText = collectStructureText(articleStructure);
    const uniquePlaceholders = new Set(allText.match(/\[T[1-3]\]/g) || []);
    if (uniquePlaceholders.size === 0) {
      console.warn(`[articles-api] No trust source placeholders found in article for topic: ${topicTitle}. Expected 1-${articleStructure.trustSources.length} placeholders.`);
    } else if (uniquePlaceholders.size > articleStructure.trustSources.length) {
      console.warn(`[articles-api] More placeholders (${uniquePlaceholders.size}) than trust sources (${articleStructure.trustSources.length}) for topic: ${topicTitle}.`);
    }
    const validIds = articleStructure.trustSources.map((ts) => ts.id);
    const invalid = Array.from(uniquePlaceholders)
      .map((p) => p.replace(/[[\]]/g, ""))
      .filter((id) => !validIds.includes(id));
    if (invalid.length > 0) {
      console.warn(`[articles-api] Invalid placeholders found: ${invalid.join(", ")}. These will be removed or left as plain text.`);
    }
  }

  // ── RAW URL SAFETY NET ────────────────────────────────────────────────
  // If the model dumped a raw URL instead of a [Tn]/[Tn:phrase] placeholder,
  // convert it back so the substitution pipeline links it normally. Also
  // strip orphaned bare "Tn:text" fragments.
  if (articleStructure.trustSources.length > 0) {
    const rawUrlRe = /https?:\/\/[^\s,)}\]<"']+/g;
    const bareTnRe = /(?:^|\s)T[1-8]:\S+/g;
    const fixText = (text: string): string => {
      if (!text) return text;
      let fixed = text.replace(rawUrlRe, (rawUrl) => {
        const clean = rawUrl.replace(/[.,;:!?]+$/, "");
        const ts = articleStructure.trustSources.find(
          (s) => clean === s.url || s.url.startsWith(clean) || clean.startsWith(s.url)
        );
        if (!ts) return rawUrl;
        const phrase = ts.text.trim().split(/\s+/).slice(0, 3).join(" ");
        return `[${ts.id}:${phrase}]`;
      });
      fixed = fixed.replace(bareTnRe, " ");
      return fixed.replace(/\s{2,}/g, " ").trim();
    };
    articleStructure.blocks = articleStructure.blocks.map((block) => {
      if (block.type === "ul" || block.type === "ol") {
        const lb = block as ListBlock;
        return { ...lb, items: (lb.items || []).map((i) => ({ ...i, text: fixText(i.text || "") })) };
      }
      if (block.type === "table") {
        const tb = block as TableBlock;
        return {
          ...tb,
          caption: fixText(tb.caption || ""),
          rows: (tb.rows || []).map((r) => (r || []).map((c) => fixText(c || ""))),
        };
      }
      return { ...block, text: fixText(block.text || "") };
    });
  }

  // ── Render ────────────────────────────────────────────────────────────
  const htmlBeforeClean = blocksToHtml(
    articleStructure.blocks,
    articleStructure.anchors,
    articleStructure.trustSources
  );

  // ORDER MATTERS: cleanText runs before the final fixHtmlTagSpacing pass so
  // any residual missing space around <a> is fixed last.
  const html = fixHtmlTagSpacing(cleanText(removeExcessiveBold(fixHtmlTagSpacing(htmlBeforeClean))));

  const placeholdersRemaining = [...new Set(html.match(/\[([AT][1-3])\]/g) || [])];
  const linkCount = (html.match(/<a\s+[^>]*href/g) || []).length;
  if (placeholdersRemaining.length > 0) {
    console.error(`[articles-api] ERROR: ${placeholdersRemaining.length} placeholder(s) still present in final HTML for "${topicTitle}":`, placeholdersRemaining);
  }
  if (linkCount === 0 && (articleStructure.anchors.length > 0 || articleStructure.trustSources.length > 0)) {
    console.error(`[articles-api] ERROR: No links found in final HTML for "${topicTitle}". Expected ${articleStructure.anchors.length + articleStructure.trustSources.length}.`);
  }

  return { html, leaksFound, placeholdersRemaining, linkCount };
}
