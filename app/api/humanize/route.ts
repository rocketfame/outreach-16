// app/api/humanize/route.ts
// DEPRECATED: This endpoint is no longer used.
// Humanization now happens during generation via humanizeOnWrite toggle.
// This file is kept for backward compatibility. Uses Undetectable.AI Humanization API v2.

import { NextRequest, NextResponse } from "next/server";
import {
  prepareForHumanization,
  restoreProtectedChunks,
  restoreFromHumanization,
  type ProtectedChunk
} from "@/lib/humanizeProtection";
import { getHumanizerService } from "@/lib/humanizerClient";
import { chunkTextForHumanization } from "@/lib/sectionHumanize";
import { formatHumanizedHtml } from "@/lib/humanizeFormatter";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

export interface HumanizeArticleRequest {
  html: string;
  model: number; // 0: quality, 1: balance, 2: enhanced
  /** @deprecated Undetectable.AI does not use email; kept for API compatibility */
  registeredEmail?: string;
  frozenPhrases?: string[]; // Optional: brand names, exact anchor texts to preserve
  style?: string; // Optional: style hint - for analytics/logging
}

export interface HumanizeArticleResponse {
  ok: boolean;
  html?: string;
  wordsUsed?: number;
  remainingWords?: number;
  error?: string;
  userMessage?: string;
}

export async function POST(req: NextRequest) {
  console.log("[humanize-api] POST /api/humanize called");

  // Rate limit: Undetectable.AI calls are paid per request — treat as generation.
  const ip = getClientIP(req);
  const rl = checkRateLimit(ip, "generate");
  if (rl.limited) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Please wait before humanizing more text." },
      { status: 429, headers: { "Retry-After": String(rl.resetIn) } }
    );
  }

  try {
    const body: HumanizeArticleRequest = await req.json();
    const { html, model, frozenPhrases = [] } = body;

    // Validate inputs
    if (!html || typeof html !== "string" || html.trim().length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "HTML content is required",
          userMessage: "Article content is required for humanization."
        } as HumanizeArticleResponse,
        { status: 400 }
      );
    }

    if (typeof model !== "number" || model < 0 || model > 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid model parameter",
          userMessage: "Invalid humanization model. Please try again."
        } as HumanizeArticleResponse,
        { status: 400 }
      );
    }

    // Undetectable.AI uses API key only (no email)
    const apiKey = process.env.UNDETECTABLE_HUMANIZER_API_KEY;
    if (!apiKey) {
      console.error("[humanize-api] UNDETECTABLE_HUMANIZER_API_KEY not configured");
      return NextResponse.json(
        {
          ok: false,
          error: "API key not configured",
          userMessage: "Humanize service is not configured. Please contact support."
        } as HumanizeArticleResponse,
        { status: 500 }
      );
    }

    // Step 1: Prepare text for humanization (protect anchors, convert to plain text, preserve structure)
    console.log("[humanize-api] Preparing text for humanization...");
    const { textForHumanize, chunks: protectedChunks, originalHtml, structure } = prepareForHumanization(html, frozenPhrases);
    
    console.log(`[humanize-api] Protected ${protectedChunks.length} chunks (${protectedChunks.filter(c => c.type === 'anchor').length} anchors, ${protectedChunks.filter(c => c.type === 'phrase').length} phrases)`);
    console.log(`[humanize-api] Text length: ${textForHumanize.length} characters`);

    // Step 2: Check if chunking is needed
    let humanizedText: string;
    let totalWordsUsed = 0;

    if (textForHumanize.length > 10000) {
      // Need to chunk
      console.log("[humanize-api] Text exceeds 10000 chars, chunking...");
      const textChunks = chunkTextForHumanization(textForHumanize);
      console.log(`[humanize-api] Split into ${textChunks.length} chunks`);

      const humanizedChunks: string[] = [];

      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`[humanize-api] Humanizing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)...`);

        try {
          // Undetectable requires min 50 chars
          if (chunk.trim().length < 50) {
            humanizedChunks.push(chunk);
            continue;
          }
          const humanizer = getHumanizerService();
          const result = await humanizer.humanize(chunk, { model });

          humanizedChunks.push(result.text);
          totalWordsUsed += result.wordsUsed;

          // Small delay between chunks to avoid rate limiting
          if (i < textChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`[humanize-api] Error humanizing chunk ${i + 1}:`, error);
          throw error;
        }
      }

      humanizedText = humanizedChunks.join("\n\n");
    } else {
      // Single request
      console.log("[humanize-api] Humanizing text in single request...");
      const humanizer = getHumanizerService();
      const result = await humanizer.humanize(textForHumanize, { model });

      humanizedText = result.text;
      totalWordsUsed = result.wordsUsed;
    }

    console.log(`[humanize-api] Humanization complete. Words used: ${totalWordsUsed}`);

    // Step 3: Restore protected chunks (anchors and phrases) first
    console.log("[humanize-api] Restoring protected chunks (anchors and phrases)...");
    const restoredText = restoreProtectedChunks(humanizedText, protectedChunks);
    
    // Step 4: Format humanized text back to HTML using OpenAI formatter
    let formattedHtml: string;
    try {
      console.log("[humanize-api] Formatting humanized text to HTML structure using OpenAI formatter...");
      formattedHtml = await formatHumanizedHtml({
        originalHtml,
        humanizedText: restoredText
      });
      console.log("[humanize-api] OpenAI formatter successful");
    } catch (formatError) {
      console.error("[humanize-api] OpenAI formatter failed, falling back to rule-based formatter:", formatError);
      // Fallback to old rule-based formatter
      formattedHtml = restoreFromHumanization(restoredText, [], originalHtml, structure);
      console.log("[humanize-api] Using fallback formatter");
    }

    console.log("[humanize-api] Humanization and formatting successful");

    return NextResponse.json({
      ok: true,
      html: formattedHtml,
      wordsUsed: totalWordsUsed,
    } as HumanizeArticleResponse);

  } catch (error) {
    console.error("[humanize-api] Humanization failed:", error);

    const err = error as { userMessage?: string; message?: string; code?: number };
    // Check if it's a HumanizeError with user-friendly message
    if (err.userMessage) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          userMessage: err.userMessage
        } as HumanizeArticleResponse,
        { status: err.code === 1006 ? 402 : 500 } // 402 for payment required
      );
    }

    // Generic error
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Unknown error",
        userMessage: "An error occurred while humanizing text. Please try again."
      } as HumanizeArticleResponse,
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - Undetectable.AI does not expose balance API.
 * Returns configured status for backward compatibility.
 */
export async function GET() {
  console.log("[humanize-api] GET /api/humanize (config check)");

  const apiKey = process.env.UNDETECTABLE_HUMANIZER_API_KEY;
  return NextResponse.json({
    configured: !!apiKey,
    message: apiKey
      ? "Undetectable.AI humanizer is configured. Balance check is not available."
      : "UNDETECTABLE_HUMANIZER_API_KEY not configured.",
  });
}

