// app/api/edit-article/route.ts

import { NextRequest, NextResponse } from "next/server";
import { buildEditArticlePrompt } from "@/lib/editArticlePrompt";
import { getOpenAIApiKey } from "@/lib/config";

export interface EditHistoryEntry {
  timestamp: string;
  editRequest: string;
  summary: string;
}

export interface EditArticleRequest {
  articleHtml: string;
  articleTitle: string;
  editRequest: string;
  niche: string;
  language: string;
  trustSourcesList: string[];
  editHistory?: EditHistoryEntry[];
}

export interface EditArticleResponse {
  success: boolean;
  editedArticleHtml?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: EditArticleRequest = await req.json();

    const {
      articleHtml,
      articleTitle,
      editRequest,
      niche,
      language,
      trustSourcesList = [],
      editHistory = [],
    } = body;

    // Validation
    if (!articleHtml || !articleHtml.trim()) {
      return NextResponse.json(
        { success: false, error: "Article HTML is required" },
        { status: 400 }
      );
    }

    if (!editRequest || !editRequest.trim()) {
      return NextResponse.json(
        { success: false, error: "Edit request is required" },
        { status: 400 }
      );
    }

    if (!niche || !niche.trim()) {
      return NextResponse.json(
        { success: false, error: "Niche is required" },
        { status: 400 }
      );
    }

    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    // Build the edit prompt
    const prompt = buildEditArticlePrompt({
      currentArticleHtml: articleHtml,
      articleTitle: articleTitle || "Article",
      editRequest: editRequest.trim(),
      niche: niche.trim(),
      language: language || "English",
      trustSourcesList: trustSourcesList || [],
      editHistory: editHistory || [],
    });

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert content editor specializing in music industry outreach articles. You refine articles based on specific editorial requests while maintaining professional quality and natural writing style.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 8000, // Increased to allow full article editing without truncation
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
      console.error("[edit-article] API error:", errorMessage);
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[edit-article] OpenAI response:", {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      hasMessage: !!data.choices?.[0]?.message,
      hasContent: !!data.choices?.[0]?.message?.content,
      contentLength: data.choices?.[0]?.message?.content?.length || 0,
    });

    const editedHtml = data.choices?.[0]?.message?.content?.trim();

    if (!editedHtml) {
      console.error("[edit-article] No content in response:", JSON.stringify(data, null, 2));
      return NextResponse.json(
        { success: false, error: "No content returned from OpenAI" },
        { status: 500 }
      );
    }

    console.log("[edit-article] Received HTML length:", editedHtml.length);

    // Clean up the response (remove any markdown code fences if present)
    let cleanedHtml = editedHtml;
    if (cleanedHtml.startsWith("```html")) {
      cleanedHtml = cleanedHtml.replace(/^```html\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedHtml.startsWith("```")) {
      cleanedHtml = cleanedHtml.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    console.log("[edit-article] Cleaned HTML length:", cleanedHtml.trim().length);

    return NextResponse.json({
      success: true,
      editedArticleHtml: cleanedHtml.trim(),
    });
  } catch (error) {
    console.error("[edit-article] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to edit article",
      },
      { status: 500 }
    );
  }
}

