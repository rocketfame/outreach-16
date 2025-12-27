// lib/tavilyClient.ts
// Tavily Search API client - Single source of truth for external search

import { getTavilyApiKey } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

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

    // Track cost
    const costTracker = getCostTracker();
    costTracker.trackTavilySearch(requestBody.search_depth as 'basic' | 'advanced', 1);

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

export interface ImageSource {
  url: string;
  sourceUrl: string; // URL of the page where image was found
  title?: string;
}

/**
 * Search for images using Tavily API
 * @param query - Search query string (e.g., "Tomorrowland festival 2026")
 * @returns Array of image URLs with source information
 */
export async function searchImages(query: string): Promise<ImageSource[]> {
  const apiKey = getTavilyApiKey();
  console.log(`[tavily-images] query=${query}`);

  try {
    const requestBody = {
      api_key: apiKey,
      query,
      search_depth: "basic", // Changed from "advanced" to "basic" to save credits - still gets good results
      include_answers: false,
      include_images: true, // Enable image search
      include_raw_content: false,
      max_results: 10, // Reduced from 15 to 10 to save credits - we'll get enough images
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
      const errorMsg = `[tavily-images] error=${response.status} ${response.statusText}: ${errorText}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    
    // Track cost
    const costTracker = getCostTracker();
    costTracker.trackTavilyImageSearch(1);
    
    console.log(`[tavily-images] Response structure:`, {
      hasImages: !!data.images,
      imagesType: Array.isArray(data.images) ? 'array' : typeof data.images,
      imagesLength: Array.isArray(data.images) ? data.images.length : 0,
      hasResults: !!data.results,
      resultsLength: Array.isArray(data.results) ? data.results.length : 0,
      sampleResult: data.results?.[0] ? {
        hasImages: !!data.results[0].images,
        imagesType: Array.isArray(data.results[0].images) ? 'array' : typeof data.results[0].images,
      } : null,
    });
    
    const images: ImageSource[] = [];

    // Tavily returns images in the response - check top-level images array
    if (data.images && Array.isArray(data.images)) {
      console.log(`[tavily-images] Processing ${data.images.length} images from data.images`);
      data.images.forEach((img: any, index: number) => {
        const imgUrl = typeof img === 'string' ? img : (img.url || img);
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          images.push({
            url: imgUrl,
            sourceUrl: (typeof img === 'object' && img.source_url) || data.results?.[0]?.url || '',
            title: (typeof img === 'object' && img.title) || data.results?.[0]?.title || `Image ${index + 1}`,
          });
        }
      });
    }

    // Also check results for images
    if (data.results && Array.isArray(data.results)) {
      console.log(`[tavily-images] Processing ${data.results.length} results`);
      data.results.forEach((result: any, resultIndex: number) => {
        if (result.images && Array.isArray(result.images)) {
          console.log(`[tavily-images] Result ${resultIndex} has ${result.images.length} images`);
          result.images.forEach((imgUrl: string | any) => {
            const url = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || imgUrl);
            if (url && typeof url === 'string' && url.startsWith('http') && !images.some(i => i.url === url)) {
              images.push({
                url: url,
                sourceUrl: result.url || '',
                title: result.title || `Image from ${result.url}`,
              });
            }
          });
        }
      });
    }

    console.log(`[tavily-images] Found ${images.length} total images:`, images.map(i => i.url));
    return images.slice(0, 10); // Limit to 10 images
  } catch (error) {
    const errorMsg = `[tavily-images] error=${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    throw error;
  }
}
