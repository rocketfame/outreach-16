// lib/articleHumanizeBlocks.ts
// Block-level humanization of a parsed ArticleStructure. Extracted from
// app/api/articles/route.ts so the automation pipeline can humanize an
// ACCEPTED draft (after acceptance checks and any generation retry) instead
// of paying Undetectable.AI credits for every draft, including rejected ones.

import { cleanText } from "@/lib/textPostProcessing";
import { repairHumanizedText } from "@/lib/humanizeRepair";
import { humanizeSectionText } from "@/lib/sectionHumanize";
import { estimateHumanizeCost } from "@/lib/costTracker";
import {
  cancelAutomationCostReservation,
  reserveAutomationCost,
  rethrowAutomationBudgetError,
} from "@/lib/automation/budget";
import type { HumanizerService } from "@/lib/humanizerClient";
import type {
  ArticleBlockBase,
  ArticleStructure,
  ListBlock,
  TableBlock,
} from "@/lib/articleStructure";

/** Internal control: humanization verification report */
export interface HumanizationReport {
  enabled: boolean;
  blocksTotal: number;
  blocksProcessed: number; // Blocks sent to humanizer
  blocksActuallyHumanized: number; // Blocks where wordsUsed > 0
  blocksSkipped: number;
  totalWordsUsed: number;
  totalWordsInArticle: number;
  humanizationRatio: number; // 0-1, share of article that was humanized
  providerUsage?: {
    undetectableWords: number;
    betterWordsWords: number;
    betterWordsFallbackUsed: boolean;
  };
  skippedReasons?: { shortParagraphs: number; shortListItems: number; shortTableCells: number };
}

export interface HumanizeArticleOptions {
  /** Legacy model: 0=Quality, 1=Balanced, 2=More Human */
  model: number;
  style?: string;
  mode?: "Basic" | "Autopilot";
  /** Brand names, anchor texts and placeholders the humanizer must never touch. */
  frozenPhrases: string[];
  /** One circuit per job — Undetectable → BetterWords fallback state lives here. */
  humanizer: HumanizerService;
  /** When true, the whole humanization budget is reserved before the first submit. */
  probeBudget?: boolean;
}

export interface HumanizeArticleResult {
  structure: ArticleStructure;
  report: HumanizationReport;
  anyHumanized: boolean;
}

/** Minimum block length (chars) that is worth a paid humanizer call. */
export const HUMANIZE_MIN_BLOCK_CHARS = 100;

const BATCH_SIZE = 5;

function hasGluedWords(text: string): boolean {
  return (
    /[a-z]{8,}[A-Z][a-z]/.test(text) ||
    /\b(saves|shares|likes|views|clicks|comments|follows)([a-z])/.test(text)
  );
}

function hasSpacedLetterArtifact(text: string): boolean {
  // Detect "I T H O U G H Y O U K N E W" type artifacts (single letters with spaces)
  return /\b([A-Z] ){4,}[A-Z]\b/.test(text);
}

function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:[’'ʼ-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/**
 * Words that WILL be sent to the humanizer for this structure — the same
 * eligibility rules the humanization loop applies (h1 never, everything else
 * only when the block/item/cell is at least HUMANIZE_MIN_BLOCK_CHARS long).
 */
export function countHumanizableWords(structure: ArticleStructure): number {
  let words = 0;
  for (const block of structure.blocks) {
    if (block.type === "h1") continue;
    if (block.type === "ul" || block.type === "ol") {
      for (const item of (block as ListBlock).items || []) {
        if (item?.text && item.text.length >= HUMANIZE_MIN_BLOCK_CHARS) words += countWords(item.text);
      }
      continue;
    }
    if (block.type === "table") {
      const t = block as TableBlock;
      if (t.caption && t.caption.length >= HUMANIZE_MIN_BLOCK_CHARS) words += countWords(t.caption);
      for (const row of t.rows || []) {
        for (const cell of Array.isArray(row) ? row : []) {
          if (cell && cell.length >= HUMANIZE_MIN_BLOCK_CHARS) words += countWords(cell);
        }
      }
      continue;
    }
    if (block.text && block.text.length >= HUMANIZE_MIN_BLOCK_CHARS) words += countWords(block.text);
  }
  return words;
}

export function emptyHumanizationReport(structure: ArticleStructure | null, enabled: boolean): HumanizationReport {
  return {
    enabled,
    blocksTotal: structure?.blocks?.length ?? 0,
    blocksProcessed: 0,
    blocksActuallyHumanized: 0,
    blocksSkipped: 0,
    totalWordsUsed: 0,
    totalWordsInArticle: 0,
    humanizationRatio: 0,
    skippedReasons: enabled ? { shortParagraphs: 0, shortListItems: 0, shortTableCells: 0 } : undefined,
  };
}

/**
 * Humanize every eligible block of the structure in parallel batches of 5.
 * Never throws for per-block humanizer errors (the original block is kept);
 * automation budget errors are always rethrown so a job fails honestly.
 */
export async function humanizeArticleStructure(
  articleStructure: ArticleStructure,
  options: HumanizeArticleOptions
): Promise<HumanizeArticleResult> {
  const { model: humanizeModel, style: humanizeStyle, mode: humanizeMode, frozenPhrases, humanizer } = options;

  // Budget probe: an automation job must be able to afford the WHOLE
  // humanization before the first paid submit. Otherwise the cap would be hit
  // mid-way, after several blocks were already billed by Undetectable, and
  // the job would die with nothing to show for the credits.
  if (options.probeBudget !== false) {
    const probe = reserveAutomationCost(
      "undetectable_humanize_total",
      estimateHumanizeCost(countHumanizableWords(articleStructure))
    );
    cancelAutomationCostReservation(probe);
  }

  const humanizationReport: HumanizationReport = {
    enabled: true,
    blocksTotal: articleStructure.blocks.length,
    blocksProcessed: 0,
    blocksActuallyHumanized: 0,
    blocksSkipped: 0,
    totalWordsUsed: 0,
    totalWordsInArticle: 0,
    humanizationRatio: 0,
    skippedReasons: { shortParagraphs: 0, shortListItems: 0, shortTableCells: 0 },
  };

  const startHumanize = Date.now();

  type BlockType = ArticleStructure["blocks"][0];
  type HumanizeTask = {
    idx: number;
    process: () => Promise<{
      block: BlockType;
      wordsUsed: number;
      undetectableWordsUsed?: number;
      processed: boolean;
      humanized: boolean;
      skippedShortP?: boolean;
    }>;
  };
  const tasks: HumanizeTask[] = [];

  for (let i = 0; i < articleStructure.blocks.length; i++) {
    const block = articleStructure.blocks[i];

    if (block.type === "h1") {
      tasks.push({ idx: i, process: async () => ({ block, wordsUsed: 0, processed: false, humanized: false }) });
      continue;
    }

    if (block.type === "ul" || block.type === "ol") {
      const listBlock = block as ListBlock;
      tasks.push({ idx: i, process: async () => {
        let listWordsUsed = 0;
        let listUndetectableWordsUsed = 0;
        const humanizedItems = await Promise.all(
          (listBlock.items || []).map(async (item: ArticleBlockBase) => {
            if (!item?.text || item.text.length < HUMANIZE_MIN_BLOCK_CHARS) return item;
            try {
              const originalText = cleanText(item.text);
              const result = await humanizeSectionText(originalText, humanizeModel, "", frozenPhrases, humanizeStyle, humanizeMode, undefined, humanizer);
              const humanizedText = cleanText(result.humanizedText);
              if (hasGluedWords(humanizedText) || humanizedText.length < originalText.length * 0.6) return item;
              const repair = repairHumanizedText(originalText, humanizedText);
              listWordsUsed += result.wordsUsed;
              listUndetectableWordsUsed += result.undetectableWordsUsed;
              return { ...item, text: repair.text };
            } catch (error) {
              rethrowAutomationBudgetError(error);
              return item;
            }
          })
        );
        return { block: { ...listBlock, items: humanizedItems }, wordsUsed: listWordsUsed, undetectableWordsUsed: listUndetectableWordsUsed, processed: true, humanized: listWordsUsed > 0 };
      } });
      continue;
    }

    if (block.type === "table") {
      const t = block as TableBlock;
      tasks.push({ idx: i, process: async () => {
        let tableWordsUsed = 0;
        let tableUndetectableWordsUsed = 0;
        let caption = t.caption;
        if (caption && caption.length >= HUMANIZE_MIN_BLOCK_CHARS) {
          try {
            const result = await humanizeSectionText(cleanText(caption), humanizeModel, "", frozenPhrases, humanizeStyle, humanizeMode, undefined, humanizer);
            caption = cleanText(result.humanizedText);
            tableWordsUsed += result.wordsUsed;
            tableUndetectableWordsUsed += result.undetectableWordsUsed;
          } catch (error) {
            rethrowAutomationBudgetError(error);
            /* keep original */
          }
        }
        const humanizedRows = await Promise.all(
          (t.rows || []).map(async (row) =>
            Promise.all((Array.isArray(row) ? row : []).map(async (cell) => {
              if (!cell || cell.length < HUMANIZE_MIN_BLOCK_CHARS) return cell;
              try {
                const result = await humanizeSectionText(cleanText(cell), humanizeModel, "", frozenPhrases, humanizeStyle, humanizeMode, undefined, humanizer);
                tableWordsUsed += result.wordsUsed;
                tableUndetectableWordsUsed += result.undetectableWordsUsed;
                return cleanText(result.humanizedText);
              } catch (error) {
                rethrowAutomationBudgetError(error);
                return cell;
              }
            }))
          )
        );
        return { block: { ...t, caption, rows: humanizedRows } as TableBlock, wordsUsed: tableWordsUsed, undetectableWordsUsed: tableUndetectableWordsUsed, processed: true, humanized: tableWordsUsed > 0 };
      } });
      continue;
    }

    if (block.type === "h2" || block.type === "h3" || block.type === "h4") {
      if (!block.text || block.text.length === 0) {
        tasks.push({ idx: i, process: async () => ({ block, wordsUsed: 0, processed: false, humanized: false }) });
        continue;
      }
      tasks.push({ idx: i, process: async () => {
        try {
          const result = await humanizeSectionText(cleanText(block.text), humanizeModel, "", frozenPhrases, humanizeStyle, humanizeMode, undefined, humanizer);
          return { block: { ...block, text: cleanText(result.humanizedText) }, wordsUsed: result.wordsUsed, undetectableWordsUsed: result.undetectableWordsUsed, processed: true, humanized: result.wordsUsed > 0 };
        } catch (error) {
          rethrowAutomationBudgetError(error);
          return { block, wordsUsed: 0, processed: true, humanized: false };
        }
      } });
      continue;
    }

    // Paragraphs
    if (!block.text || block.text.length < HUMANIZE_MIN_BLOCK_CHARS) {
      const isShort = !!(block.text && block.text.length >= 60);
      tasks.push({ idx: i, process: async () => ({ block, wordsUsed: 0, processed: false, humanized: false, skippedShortP: isShort }) });
      continue;
    }
    tasks.push({ idx: i, process: async () => {
      try {
        const originalText = cleanText(block.text);
        const result = await humanizeSectionText(originalText, humanizeModel, "", frozenPhrases, humanizeStyle, humanizeMode, undefined, humanizer);
        const humanizedText = cleanText(result.humanizedText);
        // Full-block reject: glued words, spaced letters, or extreme shrinkage
        if (hasGluedWords(humanizedText) || hasSpacedLetterArtifact(humanizedText) || humanizedText.length < originalText.length * 0.5) {
          console.warn("[humanizer] Paragraph rejected (full block):", originalText.substring(0, 60));
          return { block, wordsUsed: 0, undetectableWordsUsed: 0, processed: true, humanized: false };
        }
        // Sentence-level repair: revert only corrupted sentences to original text.
        const repair = repairHumanizedText(originalText, humanizedText);
        if (repair.revertedCount > 0) {
          console.warn(`[humanizer] Paragraph repaired: ${repair.revertedCount} sentence(s) reverted to original. Block: "${originalText.substring(0, 60)}"`);
        }
        return { block: { ...block, text: repair.text }, wordsUsed: result.wordsUsed, undetectableWordsUsed: result.undetectableWordsUsed, processed: true, humanized: result.wordsUsed > 0 };
      } catch (error) {
        rethrowAutomationBudgetError(error);
        return { block, wordsUsed: 0, processed: true, humanized: false };
      }
    } });
  }

  // Execute tasks in parallel batches
  const results: Awaited<ReturnType<HumanizeTask["process"]>>[] = new Array(tasks.length);
  for (let batchStart = 0; batchStart < tasks.length; batchStart += BATCH_SIZE) {
    const batch = tasks.slice(batchStart, batchStart + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((t) => t.process()));
    for (let j = 0; j < batch.length; j++) {
      results[batch[j].idx] = batchResults[j];
    }
    console.log(`[humanizer-batch] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(tasks.length / BATCH_SIZE)} done (${Date.now() - startHumanize}ms elapsed)`);
  }

  // Collect results in original order
  let totalHumanizeWordsUsed = 0;
  let totalUndetectableWordsUsed = 0;
  const humanizedBlocks: typeof articleStructure.blocks = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    humanizedBlocks.push(r.block);
    totalHumanizeWordsUsed += r.wordsUsed;
    totalUndetectableWordsUsed += r.undetectableWordsUsed || 0;
    if (r.processed) humanizationReport.blocksProcessed++;
    if (r.humanized) humanizationReport.blocksActuallyHumanized++;
    if (r.skippedShortP) humanizationReport.skippedReasons!.shortParagraphs++;
  }
  console.log(`[humanizer-done] All ${tasks.length} blocks done in ${Date.now() - startHumanize}ms, wordsUsed=${totalHumanizeWordsUsed}`);

  const anyHumanized = totalHumanizeWordsUsed > 0 || humanizedBlocks.some((block, i) => {
    const original = articleStructure.blocks[i];
    if (!original) return false;
    if (block.text !== original.text) return true;
    if ((block.type === "ul" || block.type === "ol") && (original.type === "ul" || original.type === "ol")) {
      return JSON.stringify((block as ListBlock).items || []) !== JSON.stringify((original as ListBlock).items || []);
    }
    if (block.type === "table" && original.type === "table") {
      return JSON.stringify((block as TableBlock).rows || []) !== JSON.stringify((original as TableBlock).rows || []);
    }
    return false;
  });

  if (!anyHumanized && humanizationReport.blocksProcessed > 0) {
    console.warn(`[humanizer] WARNING: Humanization enabled but 0/${humanizationReport.blocksProcessed} blocks were actually humanized. Check API key/credits.`);
  }

  humanizationReport.totalWordsUsed = totalHumanizeWordsUsed;
  humanizationReport.blocksSkipped =
    humanizationReport.skippedReasons!.shortParagraphs +
    humanizationReport.skippedReasons!.shortListItems +
    humanizationReport.skippedReasons!.shortTableCells;
  const totalWordsInArticle = humanizedBlocks
    .flatMap((b) => {
      if (b.text) return b.text.split(/\s+/).filter(Boolean);
      const listItems = (b as ListBlock).items;
      if (listItems) return listItems.flatMap((i: ArticleBlockBase | string) => ((typeof i === "string" ? i : i?.text) || "").split(/\s+/).filter(Boolean));
      const tableRows = (b as TableBlock).rows;
      if (tableRows) return tableRows.flat().flatMap((c: string) => (c || "").split(/\s+/).filter(Boolean));
      return [];
    })
    .length;
  humanizationReport.totalWordsInArticle = totalWordsInArticle;
  humanizationReport.humanizationRatio =
    totalWordsInArticle > 0 ? totalHumanizeWordsUsed / totalWordsInArticle : 0;
  humanizationReport.providerUsage = {
    undetectableWords: totalUndetectableWordsUsed,
    betterWordsWords: Math.max(0, totalHumanizeWordsUsed - totalUndetectableWordsUsed),
    betterWordsFallbackUsed: totalHumanizeWordsUsed > totalUndetectableWordsUsed,
  };

  return {
    structure: { ...articleStructure, blocks: humanizedBlocks, humanizedOnWrite: anyHumanized },
    report: humanizationReport,
    anyHumanized,
  };
}
