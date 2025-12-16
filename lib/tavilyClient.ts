// lib/tavilyClient.ts
// Tavily Search API client - Single source of truth for external search

// Simple debug logger that works in both local and production (Vercel)
const debugLog = (...args: any[]) => {
  console.log("[tavily-debug]", ...args);
};

export interface TrustedSource {
  title: string;
  url: string;
  snippet: string;
  source: string; // e.g. "tavily"
}

/**
 * Search reliable sources using Tavily API
 * This is the ONLY external search function - no fallbacks, no DuckDuckGo
 * @param query - Search query string
 * @returns Array of trusted sources with title, URL, snippet, and source
 */
export async function searchReliableSources(query: string): Promise<TrustedSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    const errorMsg = "[tavily-api] Missing TAVILY_API_KEY";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[tavily-api] query=${query}`);

  try {
    // #region agent log
    const queryLog = {location:'tavilyClient.ts:28',message:'[tavily-api] Starting search',data:{query,searchDepth:'advanced',maxResults:5},timestamp:Date.now(),sessionId:'debug-session',runId:'tavily-api',hypothesisId:'tavily-search'};
    debugLog(queryLog);
    // #endregion

    const requestBody = {
      api_key: apiKey,
      query,
      search_depth: "advanced", // Deep search for better quality results
      include_answers: false,
      include_images: false,
      include_raw_content: true, // Get full content for better relevance
      max_results: 5, // Get top 5 most relevant sources
    };

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `[tavily-api] error=${response.status} ${response.statusText}: ${errorText}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();

    // #region agent log
    const resultsLog = {location:'tavilyClient.ts:60',message:'[tavily-api] Search completed',data:{query,resultsCount:(data.results || []).length,hasResults:(data.results || []).length > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'tavily-api',hypothesisId:'tavily-search'};
    debugLog(resultsLog);
    // #endregion

    // Map Tavily response to TrustedSource format
    const sources: TrustedSource[] = (data.results || []).map((result: any) => {
      // Clean URL - remove tracking parameters
      let cleanUrl = result.url || "";
      try {
        const urlObj = new URL(cleanUrl);
        // Remove common tracking parameters
        urlObj.searchParams.delete("utm_source");
        urlObj.searchParams.delete("utm_medium");
        urlObj.searchParams.delete("utm_campaign");
        urlObj.searchParams.delete("utm_term");
        urlObj.searchParams.delete("utm_content");
        urlObj.searchParams.delete("ref");
        urlObj.searchParams.delete("source");
        cleanUrl = urlObj.toString();
      } catch {
        // If URL parsing fails, use original URL
      }

      return {
        title: result.title || "",
        url: cleanUrl,
        snippet: result.content || "",
        source: "tavily",
      };
    });

    // #region agent log
    const finalLog = {location:'tavilyClient.ts:85',message:'[tavily-api] Sources mapped',data:{query,sourcesCount:sources.length,urls:sources.map(s => s.url)},timestamp:Date.now(),sessionId:'debug-session',runId:'tavily-api',hypothesisId:'tavily-search'};
    debugLog(finalLog);
    // #endregion

    return sources;
  } catch (error) {
    const errorMsg = `[tavily-api] error=${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    throw error;
  }
}
