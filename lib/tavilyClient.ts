// lib/tavilyClient.ts
// Tavily Search API client - Single source of truth for external search

import { getTavilyApiKey } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

// Simple debug logger that works in both local and production (Vercel)
const debugLog = (...args: unknown[]) => {
  console.log("[tavily-debug]", ...args);
};

// Raw shape from Tavily API — permissive since we narrow at each access site.
type TavilyRawResult = {
  url?: string;
  title?: string;
  content?: string;
  score?: number;
  images?: Array<string | { url?: string; title?: string; source_url?: string }>;
  [key: string]: unknown;
};
type TavilyRawImage = string | { url?: string; title?: string; source_url?: string };

export interface TrustedSource {
  title: string;
  url: string;
  snippet: string;
  source: string; // e.g. "tavily"
}

export interface ReliableSearchOptions {
  /** Tavily-native domain constraint. Do not emulate this with `site:` query operators. */
  includeDomains?: string[];
  maxResults?: number;
}

const TAVILY_MAX_ATTEMPTS = 3;

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  }
  return Math.min(500 * (2 ** (attempt - 1)), 4_000);
}

async function fetchTavilyWithRetry(requestBody: object, label: string): Promise<Response> {
  for (let attempt = 1; attempt <= TAVILY_MAX_ATTEMPTS; attempt++) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (response.ok) return response;

    const errorText = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === TAVILY_MAX_ATTEMPTS) {
      throw new Error(
        `[${label}] error=${response.status} ${response.statusText}: ${errorText}`
      );
    }
    const delayMs = retryDelayMs(response, attempt);
    console.warn(
      `[${label}] retryable status=${response.status}; retry=${attempt}/${TAVILY_MAX_ATTEMPTS - 1} delayMs=${delayMs}`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`[${label}] request failed after retries.`);
}

/**
 * Search reliable sources using Tavily API
 * This is the ONLY external search function - no fallbacks, no DuckDuckGo
 * @param query - Search query string
 * @returns Array of trusted sources with title, URL, snippet, and source
 */
export async function searchReliableSources(
  query: string,
  options: ReliableSearchOptions = {}
): Promise<TrustedSource[]> {
  // Get validated Tavily API key from centralized configuration
  const apiKey = getTavilyApiKey();

  console.log(`[tavily-api] query=${query}`);

  try {
    // #region agent log
    const queryLog = {location:'tavilyClient.ts:28',message:'[tavily-api] Starting search',data:{query,searchDepth:'advanced',maxResults:options.maxResults ?? 8,includeDomainsCount:options.includeDomains?.length ?? 0},timestamp:Date.now(),sessionId:'debug-session',runId:'tavily-api',hypothesisId:'tavily-search'};
    debugLog(queryLog);
    // #endregion

    const requestBody = {
      api_key: apiKey,
      query,
      search_depth: "advanced", // Deep search for better quality results
      include_answers: false,
      include_images: false,
      include_raw_content: true, // Get full content for better relevance
      max_results: options.maxResults ?? 8,
      ...(options.includeDomains?.length
        ? { include_domains: options.includeDomains.slice(0, 300) }
        : {}),
    };

    const response = await fetchTavilyWithRetry(requestBody, "tavily-api");

    const data = await response.json();

    // Track cost
    const costTracker = getCostTracker();
    costTracker.trackTavilySearch(requestBody.search_depth as 'basic' | 'advanced', 1);
    const totals = costTracker.getTotalCosts();
    console.log("[tavily-api] Cost tracked. Current totals:", {
      tavily: totals.tavily,
      openai: totals.openai,
      total: totals.total,
    });

    // #region agent log
    const resultsLog = {location:'tavilyClient.ts:60',message:'[tavily-api] Search completed',data:{query,resultsCount:(data.results || []).length,hasResults:(data.results || []).length > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'tavily-api',hypothesisId:'tavily-search'};
    debugLog(resultsLog);
    // #endregion

    // Map Tavily response to TrustedSource format
    const allSources: TrustedSource[] = (data.results || []).map((result: TavilyRawResult) => {
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
    const rejectedSources: Array<{ url: string; reason: string }> = [];
    const includedDomains = (options.includeDomains || [])
      .map((domain) => domain.trim().toLowerCase().replace(/^www\./, ""))
      .filter(Boolean);
    const reject = (source: TrustedSource, reason: string): false => {
      rejectedSources.push({ url: source.url, reason });
      return false;
    };
    const filteredSources = allSources.filter((source) => {
      const url = source.url.toLowerCase();
      const title = (source.title || "").toLowerCase();
      const snippet = (source.snippet || "").toLowerCase();

      // Tavily may treat include_domains as a ranking hint and still return
      // out-of-domain results. Enforce the caller's contract locally.
      if (includedDomains.length > 0) {
        let hostname = "";
        try {
          hostname = new URL(source.url).hostname.toLowerCase().replace(/^www\./, "");
        } catch {
          return reject(source, "outside_include_domains");
        }
        const included = includedDomains.some(
          (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
        );
        if (!included) return reject(source, "outside_include_domains");
      }

      // Exclude PDF files (especially academic PDFs)
      if (url.endsWith(".pdf") || url.includes(".pdf")) {
        console.log(`[tavily-filter] Excluding PDF: ${source.url}`);
        return reject(source, "pdf_file");
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
        return reject(source, "academic_source");
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
        return reject(source, "low_quality_domain");
      }

      // Exclude sources with very short or empty snippets (likely low quality)
      if (!source.snippet || source.snippet.trim().length < 50) {
        console.log(`[tavily-filter] Excluding source with short snippet: ${source.url}`);
        return reject(source, "short_or_empty_snippet");
      }

      // Exclude sources without proper title
      if (!source.title || source.title.trim().length < 10) {
        console.log(`[tavily-filter] Excluding source with short/empty title: ${source.url}`);
        return reject(source, "short_or_empty_title");
      }

      // Exclude sources that look like file downloads or non-web pages
      const fileExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar"];
      const hasFileExtension = fileExtensions.some(ext => url.endsWith(ext) || url.includes(ext + "?") || url.includes(ext + "#"));
      if (hasFileExtension) {
        console.log(`[tavily-filter] Excluding file download: ${source.url}`);
        return reject(source, "file_download");
      }

      // Keep all sources that pass the filters
      return true;
    });

    // Sort: text sources first, video URLs last (prefer official platforms, stats, top publications over video)
    const isVideoUrl = (s: { url: string }) => /youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|twitch\.tv\/|dailymotion\.com\//i.test(s.url);
    const sortedByType = [...filteredSources].sort((a, b) => {
      const aVideo = isVideoUrl(a);
      const bVideo = isVideoUrl(b);
      if (aVideo && !bVideo) return 1;  // video goes after text
      if (!aVideo && bVideo) return -1;
      return 0;
    });

    // #region agent log
    const finalLog = {
      location: 'tavilyClient.ts:95',
      message: '[tavily-api] Sources filtered',
      data: {
        query,
        originalCount: allSources.length,
        filteredCount: sortedByType.length,
        excludedCount: allSources.length - sortedByType.length,
        urls: sortedByType.map(s => s.url),
        rejected: rejectedSources,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'tavily-api',
      hypothesisId: 'tavily-filter'
    };
    debugLog(finalLog);
    // #endregion

    return sortedByType;
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

    const response = await fetchTavilyWithRetry(requestBody, "tavily-images");

    const data = await response.json();
    
    // Track cost
    const costTracker = getCostTracker();
    costTracker.trackTavilyImageSearch(1);
    const totals = costTracker.getTotalCosts();
    console.log("[tavily-images] Cost tracked. Current totals:", {
      tavily: totals.tavily,
      openai: totals.openai,
      total: totals.total,
    });
    
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
      data.images.forEach((img: TavilyRawImage, index: number) => {
        const imgUrl = typeof img === 'string' ? img : (img.url || '');
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
      data.results.forEach((result: TavilyRawResult, resultIndex: number) => {
        if (result.images && Array.isArray(result.images)) {
          console.log(`[tavily-images] Result ${resultIndex} has ${result.images.length} images`);
          result.images.forEach((imgUrl: TavilyRawImage) => {
            const url = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || '');
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
