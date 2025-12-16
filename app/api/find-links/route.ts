// app/api/find-links/route.ts
// Link Finder endpoint: Uses Tavily Search API ONLY (no DuckDuckGo, no fallbacks)

import { NextResponse } from "next/server";
import { searchReliableSources } from "@/lib/tavilyClient";

export interface FindLinksRequest {
  query: string;
}

export interface FindLinksResponse {
  trustSources: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
  }>;
}

export async function POST(req: Request) {
  console.log("[find-links-api] POST /api/find-links called");

  try {
    const body: FindLinksRequest = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required", details: "Please provide a non-empty query string" },
        { status: 400 }
      );
    }

    console.log(`[find-links-api] Searching for: ${query}`);

    // Call Tavily - this is the ONLY search engine, no fallbacks
    const sources = await searchReliableSources(query);

    console.log(`[find-links-api] Found ${sources.length} sources from Tavily`);

    return NextResponse.json({
      trustSources: sources,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[find-links-api] External search failed: ${errorMessage}`);

    return NextResponse.json(
      { error: "External search failed", details: errorMessage },
      { status: 500 }
    );
  }
}
