// app/api/humanize/route.ts
// Humanize TXT endpoint: Uses AIHumanize.io API to humanize article text while preserving anchors

import { NextRequest, NextResponse } from "next/server";
import {
  prepareForHumanization,
  restoreProtectedChunks,
  restoreFromHumanization,
  type ProtectedChunk
} from "@/lib/humanizeProtection";
import {
  humanizeText,
  getHumanizeBalance,
  chunkTextForHumanization,
  type HumanizeRequest
} from "@/lib/aiHumanizeClient";
import { formatHumanizedHtml } from "@/lib/humanizeFormatter";

export interface HumanizeArticleRequest {
  html: string;
  model: number; // 0: quality, 1: balance, 2: enhanced
  registeredEmail: string;
  frozenPhrases?: string[]; // Optional: brand names, exact anchor texts to preserve
  style?: string; // Optional: style hint (General, Blog, Formal, Informal, Academic, Expand, Simplify) - for analytics/logging
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

  try {
    const body: HumanizeArticleRequest = await req.json();
    const { html, model, registeredEmail, frozenPhrases = [] } = body;

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

    if (!registeredEmail || typeof registeredEmail !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Registered email is required",
          userMessage: "Humanize service email is not configured."
        } as HumanizeArticleResponse,
        { status: 400 }
      );
    }

    // Get API key from environment
    const apiKey = process.env.AIHUMANIZE_API_KEY;
    if (!apiKey) {
      console.error("[humanize-api] AIHumanize API key not configured");
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
    let remainingWords = 0;

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
          const result = await humanizeText(apiKey, {
            text: chunk,
            model,
            registeredEmail
          });

          humanizedChunks.push(result.text);
          totalWordsUsed += result.wordsUsed;
          remainingWords = result.remainingWords; // Last chunk's remaining words

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
      const result = await humanizeText(apiKey, {
        text: textForHumanize,
        model,
        registeredEmail
      });

      humanizedText = result.text;
      totalWordsUsed = result.wordsUsed;
      remainingWords = result.remainingWords;
    }

    console.log(`[humanize-api] Humanization complete. Words used: ${totalWordsUsed}, Remaining: ${remainingWords}`);

    // Step 3: Restore protected chunks (anchors and phrases) first
    console.log("[humanize-api] Restoring protected chunks (anchors and phrases)...");
    let restoredText = restoreProtectedChunks(humanizedText, protectedChunks);
    
    // Step 4: Format humanized text back to HTML using OpenAI formatter
    let formattedHtml: string;
    try {
      console.log("[humanize-api] Formatting humanized text to HTML structure using OpenAI formatter...");
      formattedHtml = await formatHumanizedHtml({
        originalHtml,
        humanizedText: restoredText,
        blockMarkers: true
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
      remainingWords
    } as HumanizeArticleResponse);

  } catch (error: any) {
    console.error("[humanize-api] Humanization failed:", error);

    // Check if it's a HumanizeError with user-friendly message
    if (error.userMessage) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          userMessage: error.userMessage
        } as HumanizeArticleResponse,
        { status: error.code === 1006 ? 402 : 500 } // 402 for payment required
      );
    }

    // Generic error
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Unknown error",
        userMessage: "An error occurred while humanizing text. Please try again."
      } as HumanizeArticleResponse,
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check balance
 */
export async function GET(req: NextRequest) {
  console.log("[humanize-api] GET /api/humanize (balance check)");

  try {
    const searchParams = req.nextUrl.searchParams;
    const registeredEmail = searchParams.get("email");

    if (!registeredEmail) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.AIHUMANIZE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const balance = await getHumanizeBalance(apiKey, registeredEmail);

    return NextResponse.json({ balance });
  } catch (error: any) {
    console.error("[humanize-api] Balance check failed:", error);
    return NextResponse.json(
      { error: error.userMessage || error.message || "Failed to check balance" },
      { status: 500 }
    );
  }
}

