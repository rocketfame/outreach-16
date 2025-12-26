// lib/tavilyClient.ts
// Tavily Search API client - Single source of truth for external search

import { getTavilyApiKey } from "@/lib/config";

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
  // Get validated Tavily API key from centralized configuration
  const apiKey = getTavilyApiKey();

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
    const allSources: TrustedSource[] = (data.results || []).map((result: any) => {
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

    // Filter out low-quality or irrelevant sources
    const filteredSources = allSources.filter((source) => {
      const url = source.url.toLowerCase();
      const title = (source.title || "").toLowerCase();
      const snippet = (source.snippet || "").toLowerCase();

      // Exclude PDF files (especially academic PDFs)
      if (url.endsWith(".pdf") || url.includes(".pdf")) {
        console.log(`[tavily-filter] Excluding PDF: ${source.url}`);
        return false;
      }

      // Exclude academic publications and Indian university sources
      const academicDomains = [
        "drbgrpublications.in",
        "ijber",
        "researchgate.net",
        "academia.edu",
        "scholar.google",
        "arxiv.org",
        "springer.com",
        "ieee.org",
        "acm.org",
        ".edu.in",
        ".ac.in",
        "university",
        "college",
        "institute",
        "conference proceedings",
        "journal",
        "special issue",
      ];

      const isAcademic = academicDomains.some((domain) => 
        url.includes(domain) || title.includes(domain) || snippet.includes(domain)
      );

      if (isAcademic) {
        console.log(`[tavily-filter] Excluding academic source: ${source.url}`);
        return false;
      }

      // Exclude low-quality domains
      const lowQualityDomains = [
        "slideshare.net",
        "scribd.com",
        "docplayer.net",
        "documents.tips",
      ];

      const isLowQuality = lowQualityDomains.some((domain) => url.includes(domain));
      if (isLowQuality) {
        console.log(`[tavily-filter] Excluding low-quality source: ${source.url}`);
        return false;
      }

      // Exclude sources with very short or empty snippets (likely low quality)
      if (!source.snippet || source.snippet.trim().length < 50) {
        console.log(`[tavily-filter] Excluding source with short snippet: ${source.url}`);
        return false;
      }

      // Exclude sources without proper title
      if (!source.title || source.title.trim().length < 10) {
        console.log(`[tavily-filter] Excluding source with short/empty title: ${source.url}`);
        return false;
      }

      // Exclude sources that look like file downloads or non-web pages
      const fileExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar"];
      const hasFileExtension = fileExtensions.some(ext => url.endsWith(ext) || url.includes(ext + "?") || url.includes(ext + "#"));
      if (hasFileExtension) {
        console.log(`[tavily-filter] Excluding file download: ${source.url}`);
        return false;
      }

      // Keep all sources that pass the filters
      return true;
    });

    // #region agent log
    const finalLog = {
      location: 'tavilyClient.ts:95',
      message: '[tavily-api] Sources filtered',
      data: {
        query,
        originalCount: allSources.length,
        filteredCount: filteredSources.length,
        excludedCount: allSources.length - filteredSources.length,
        urls: filteredSources.map(s => s.url),
        excludedUrls: allSources.filter(s => !filteredSources.includes(s)).map(s => s.url)
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'tavily-api',
      hypothesisId: 'tavily-filter'
    };
    debugLog(finalLog);
    // #endregion

    return filteredSources;
  } catch (error) {
    const errorMsg = `[tavily-api] error=${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    throw error;
  }
}
