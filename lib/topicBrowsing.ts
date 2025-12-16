// lib/topicBrowsing.ts
// Conditional browsing for topic generation - only when fresh data is needed
// Uses Tavily Search API ONLY (no DuckDuckGo)

import { appendFileSync } from "fs";
import { searchReliableSources } from "@/lib/tavilyClient";

const logPath = '/Users/serhiosider/Downloads/outreach-articles-app-main 2/.cursor/debug.log';

// Tavily Search - single source of truth for external search
async function searchWithTavily(query: string, maxResults: number = 5): Promise<Array<{ title: string; url: string; snippet?: string }>> {
  try {
    const sources = await searchReliableSources(query);
    
    // Limit to maxResults and map to expected format
    const results = sources.slice(0, maxResults).map(source => ({
      title: source.title,
      url: source.url,
      snippet: source.snippet,
    }));

    // #region agent log
    const log = {location:'topicBrowsing.ts:20',message:'Tavily search completed',data:{query,resultsCount:results.length},timestamp:Date.now(),sessionId:'debug-session',runId:'topic-browsing',hypothesisId:'topic-browsing'};
    try { appendFileSync(logPath, JSON.stringify(log) + '\n'); } catch {}
    // #endregion

    return results;
  } catch (error) {
    // #region agent log
    const log = {location:'topicBrowsing.ts:28',message:'Tavily search error',data:{error:(error as Error).message,query},timestamp:Date.now(),sessionId:'debug-session',runId:'topic-browsing',hypothesisId:'topic-browsing'};
    try { appendFileSync(logPath, JSON.stringify(log) + '\n'); } catch {}
    // #endregion
    console.error('[topic-browsing] Tavily search error:', error);
    return []; // Return empty array on error - no fallback
  }
}

export interface TopicBrowsingParams {
  niche: string;
  platform?: string;
  contentPurpose?: string;
  anchorText?: string;
  anchorUrl?: string;
}

/**
 * Determines if browsing is needed for topic generation
 * Browsing is needed for:
 * - New/live platforms (Threads, new YouTube features)
 * - Recent updates (2025/2026 changes, policy updates)
 * - Fresh data (MAU, DAU, % from reports, recent cases)
 * - SERP analysis (top results, People Also Ask, related searches)
 */
export function shouldUseBrowsing(params: TopicBrowsingParams): boolean {
  const { niche, platform } = params;
  
  // ALWAYS use browsing when platform is provided (even if it's a custom query)
  // This ensures we search for relevant topics via Tavily based on the platform/query
  if (platform && platform.trim().length > 0) {
    // #region agent log
    const log = {location:'topicBrowsing.ts:70',message:'Browsing enabled - platform provided',data:{platform,niche,reason:'platform_provided'},timestamp:Date.now(),sessionId:'debug-session',runId:'topic-browsing',hypothesisId:'browsing-decision'};
    try { appendFileSync(logPath, JSON.stringify(log) + '\n'); } catch {}
    // #endregion
    return true;
  }
  
  // Check for new/live platforms or recent data keywords in niche
  const newPlatforms = ['threads', 'meta', '2025', '2026', 'update', 'new feature', 'policy'];
  const nicheLower = (niche || '').toLowerCase();
  
  // Check if topic requires fresh data based on niche keywords
  const needsFreshData = 
    newPlatforms.some(keyword => nicheLower.includes(keyword)) ||
    /202[5-6]|recent|latest|new|update|change|policy/i.test(nicheLower);
  
  // #region agent log
  const log = {location:'topicBrowsing.ts:85',message:'Browsing decision',data:{needsFreshData,platform,niche,reason:'niche_keywords'},timestamp:Date.now(),sessionId:'debug-session',runId:'topic-browsing',hypothesisId:'browsing-decision'};
  try { appendFileSync(logPath, JSON.stringify(log) + '\n'); } catch {}
  // #endregion
  
  return needsFreshData;
}

/**
 * Performs browsing for topic generation
 * Searches for:
 * - SERP top results
 * - People Also Ask
 * - Related searches
 * - Official platform resources
 * - Competitor blogs (Hootsuite, Later, Label blogs)
 * - Recent reports and data
 */
export async function browseForTopics(params: TopicBrowsingParams): Promise<{
  serpResults: Array<{ title: string; url: string }>;
  relatedSearches: string[];
  officialResources: Array<{ title: string; url: string }>;
  competitorContent: Array<{ title: string; url: string }>;
  recentData: Array<{ title: string; url: string }>;
}> {
  const { niche, platform } = params;
  
  // #region agent log
  const log = {location:'topicBrowsing.ts:100',message:'Starting topic browsing',data:{niche,platform},timestamp:Date.now(),sessionId:'debug-session',runId:'topic-browsing',hypothesisId:'topic-browsing'};
  try { appendFileSync(logPath, JSON.stringify(log) + '\n'); } catch {}
  // #endregion

  // Generate search queries
  const currentYear = new Date().getFullYear();
  const queries = [
    `${niche} ${platform || ''} ${currentYear}`,
    `${niche} ${platform || ''} how to`,
    `${niche} ${platform || ''} strategy`,
    `${platform || ''} ${currentYear} update`,
    `${platform || ''} algorithm ${currentYear}`,
  ];

  // Search for SERP results using Tavily
  const serpResults: Array<{ title: string; url: string }> = [];
  for (const query of queries.slice(0, 2)) { // Limit to 2 queries to avoid rate limits
    const results = await searchWithTavily(query, 5);
    serpResults.push(...results);
  }

  // Search for official resources using Tavily
  const officialQueries = [
    `${platform || ''} for artists guide`,
    `${platform || ''} creator academy`,
    `${platform || ''} official blog`,
  ];
  const officialResources: Array<{ title: string; url: string }> = [];
  for (const query of officialQueries.slice(0, 1)) {
    const results = await searchWithTavily(query, 3);
    officialResources.push(...results);
  }

  // Search for competitor content using Tavily
  const competitorQueries = [
    `${niche} ${platform || ''} hootsuite`,
    `${niche} ${platform || ''} later`,
    `${niche} ${platform || ''} case study`,
  ];
  const competitorContent: Array<{ title: string; url: string }> = [];
  for (const query of competitorQueries.slice(0, 1)) {
    const results = await searchWithTavily(query, 3);
    competitorContent.push(...results);
  }

  // Search for recent data/reports using Tavily
  const dataQueries = [
    `${niche} ${platform || ''} ${currentYear} report`,
    `${niche} ${platform || ''} statistics ${currentYear}`,
    `${platform || ''} ${currentYear} metrics`,
  ];
  const recentData: Array<{ title: string; url: string }> = [];
  for (const query of dataQueries.slice(0, 1)) {
    const results = await searchWithTavily(query, 3);
    recentData.push(...results);
  }

  // Extract related searches (simplified - in real implementation, would parse SERP)
  const relatedSearches: string[] = [
    `how to ${niche} ${platform || ''}`,
    `${niche} ${platform || ''} best practices`,
    `${niche} ${platform || ''} mistakes`,
  ];

  // #region agent log
  const resultLog = {location:'topicBrowsing.ts:160',message:'Topic browsing completed',data:{serpCount:serpResults.length,officialCount:officialResources.length,competitorCount:competitorContent.length,dataCount:recentData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'topic-browsing',hypothesisId:'topic-browsing'};
  try { appendFileSync(logPath, JSON.stringify(resultLog) + '\n'); } catch {}
  // #endregion

  return {
    serpResults: Array.from(new Map(serpResults.map(r => [r.url, r])).values()), // Deduplicate
    relatedSearches,
    officialResources: Array.from(new Map(officialResources.map(r => [r.url, r])).values()),
    competitorContent: Array.from(new Map(competitorContent.map(r => [r.url, r])).values()),
    recentData: Array.from(new Map(recentData.map(r => [r.url, r])).values()),
  };
}

