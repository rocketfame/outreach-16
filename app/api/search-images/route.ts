// app/api/search-images/route.ts
// API endpoint for searching images using Tavily

import { NextRequest, NextResponse } from "next/server";
import { searchImages } from "@/lib/tavilyClient";

export interface SearchImagesRequest {
  query: string;
}

export interface SearchImagesResponse {
  images: Array<{
    url: string;
    sourceUrl: string;
    title?: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: SearchImagesRequest = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required", details: "Please provide a non-empty query string" },
        { status: 400 }
      );
    }

    console.log(`[search-images-api] Searching for images: ${query}`);

    // Search for images using Tavily
    const images = await searchImages(query);

    console.log(`[search-images-api] Found ${images.length} images`);
    console.log(`[search-images-api] Image URLs:`, images.map(img => img.url));

    return NextResponse.json({
      images: images.map(img => ({
        url: img.url,
        sourceUrl: img.sourceUrl,
        title: img.title,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[search-images-api] Image search failed: ${errorMessage}`);

    return NextResponse.json(
      { error: "Image search failed", details: errorMessage },
      { status: 500 }
    );
  }
}

