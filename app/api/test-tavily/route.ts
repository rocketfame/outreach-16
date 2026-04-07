// app/api/test-tavily/route.ts
// Test endpoint to verify Tavily API connection

import { searchReliableSources } from "@/lib/tavilyClient";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if API key is available by trying to use it
    const testQuery = "latest AI advancements";
    
    try {
      const sources = await searchReliableSources(testQuery);
      
      return NextResponse.json({
        success: true,
        message: "Tavily API is working correctly!",
        testQuery,
        resultsCount: sources.length,
        tavilyAnswer: "N/A (include_answers: false)",
        results: sources.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet.substring(0, 150) + "...",
          source: r.source,
        })),
      });
    } catch (error) {
      const errMsg = (error as { message?: string })?.message;
      if (errMsg && errMsg.includes("TAVILY_API_KEY")) {
        return NextResponse.json(
          {
            success: false,
            error: "TAVILY_API_KEY is not set in .env.local",
            message: "Please add your Tavily API key to .env.local file",
          },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as { message?: string })?.message || "Unknown error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
