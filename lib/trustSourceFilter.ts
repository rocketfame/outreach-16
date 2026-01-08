// lib/trustSourceFilter.ts

/**
 * Filters and validates trust sources based on niche and relevance rules
 */

export interface TrustSourceInput {
  title: string;
  url: string;
  snippet: string;
}

export interface TrustSourceSpec {
  id: string;   // "T1", "T2", "T3"
  text: string; // short natural anchor text, 2–5 words
  url: string;
}

/**
 * Competitor keywords that should be excluded based on niche
 */
const COMPETITOR_KEYWORDS: Record<string, string[]> = {
  "Music industry": [
    "buy streams", "buy plays", "smm panel", "streaming panel", 
    "fake streams", "bot streams", "streaming service panel"
  ],
  "Casino": [
    "casino affiliate", "affiliate program", "referral bonus",
    "casino review site", "gambling affiliate"
  ],
  "VPN": [
    "vpn affiliate", "vpn review site", "vpn comparison affiliate"
  ],
  "IT": [
    "it services affiliate", "software affiliate"
  ],
  "HR": [
    "hr services affiliate", "recruitment affiliate"
  ],
  // Add more niches as needed
};

/**
 * Official platform domains that are always trusted
 */
const OFFICIAL_PLATFORMS: string[] = [
  "spotify.com", "youtube.com", "tiktok.com", "instagram.com",
  "soundcloud.com", "facebook.com", "twitter.com", "x.com",
  "linkedin.com", "pinterest.com", "snapchat.com"
];

/**
 * Extracts short anchor text (2-5 words) from source title or URL
 */
function extractShortAnchorText(source: TrustSourceInput): string {
  const title = source.title.trim();
  const words = title.split(/\s+/);
  
  // If title is already 2-5 words, use it
  if (words.length >= 2 && words.length <= 5) {
    return title;
  }
  
  // If title is longer, try to extract brand name from URL
  try {
    const urlObj = new URL(source.url);
    const domain = urlObj.hostname.replace('www.', '');
    const domainName = domain.split('.')[0];
    
    // Use domain name if it's reasonable (2-20 chars)
    if (domainName.length > 2 && domainName.length < 20) {
      return domainName.charAt(0).toUpperCase() + domainName.slice(1);
    }
  } catch {
    // URL parsing failed, continue with title
  }
  
  // Fallback: use first 2-3 words from title
  if (words.length > 5) {
    return words.slice(0, 3).join(' ');
  }
  
  // If title is too short (1 word), use domain or fallback
  if (words.length === 1) {
    try {
      const urlObj = new URL(source.url);
      const domain = urlObj.hostname.replace('www.', '').split('.')[0];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return title;
    }
  }
  
  return title;
}

/**
 * Checks if URL is a deep, specific URL (not just homepage)
 */
function isDeepUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Check if path has meaningful depth
    const pathParts = path.split('/').filter(p => p.length > 0);
    
    // Has at least one meaningful path segment
    if (pathParts.length >= 1) {
      // Check if it's a specific article/page (not just /blog or /articles)
      const lastPart = pathParts[pathParts.length - 1];
      // If last part looks like an article slug (has hyphens, not just a category)
      if (lastPart.includes('-') || lastPart.length > 10) {
        return true;
      }
    }
    
    // Root URLs are not deep
    return pathParts.length > 0;
  } catch {
    return false;
  }
}

/**
 * Checks if source is a competitor (should be excluded)
 */
function isCompetitor(source: TrustSourceInput, niche: string): boolean {
  const nicheLower = niche.toLowerCase();
  const titleLower = source.title.toLowerCase();
  const urlLower = source.url.toLowerCase();
  const snippetLower = source.snippet?.toLowerCase() || "";
  
  const combinedText = `${titleLower} ${urlLower} ${snippetLower}`;
  
  // Check competitor keywords for this niche
  const competitorKeywords = COMPETITOR_KEYWORDS[niche] || [];
  for (const keyword of competitorKeywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // Generic competitor patterns
  const genericCompetitorPatterns = [
    "smm panel", "buy followers", "buy likes", "buy views",
    "affiliate program", "referral bonus", "review site"
  ];
  
  for (const pattern of genericCompetitorPatterns) {
    if (combinedText.includes(pattern) && !OFFICIAL_PLATFORMS.some(domain => urlLower.includes(domain))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if source is from an official platform
 */
function isOfficialPlatform(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    return OFFICIAL_PLATFORMS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Checks if source is relevant to topic
 */
function isRelevantToTopic(
  source: TrustSourceInput,
  topicTitle: string,
  topicBrief: string
): boolean {
  const topicLower = topicTitle.toLowerCase();
  const briefLower = topicBrief.toLowerCase();
  const titleLower = source.title.toLowerCase();
  const snippetLower = source.snippet?.toLowerCase() || "";
  
  const combinedTopic = `${topicLower} ${briefLower}`;
  const combinedSource = `${titleLower} ${snippetLower}`;
  
  // Extract key terms from topic
  const topicWords = combinedTopic.split(/\s+/).filter(w => w.length > 3);
  
  // Check if at least 2 key terms appear in source
  let matchCount = 0;
  for (const word of topicWords) {
    if (combinedSource.includes(word)) {
      matchCount++;
    }
  }
  
  // Require at least 2 matching terms for relevance
  return matchCount >= 2;
}

/**
 * Filters and selects 1-3 trust sources based on niche and relevance
 * 
 * Rules:
 * 1. Filter out competitors (SMM panels, affiliate sites, etc.)
 * 2. Prefer official platforms and neutral analytics
 * 3. Prefer deep URLs (articles/reports) over homepages
 * 4. Keep only sources relevant to topic
 * 5. Select exactly 1-3 sources (prefer 3 if available)
 */
export function filterAndSelectTrustSources(
  sources: TrustSourceInput[],
  niche: string,
  topicTitle: string,
  topicBrief: string
): TrustSourceSpec[] {
  if (!sources || sources.length === 0) {
    return [];
  }
  
  // Step 1: Filter out competitors
  const nonCompetitors = sources.filter(source => !isCompetitor(source, niche));
  
  if (nonCompetitors.length === 0) {
    console.warn(`[trustSourceFilter] All sources filtered out as competitors for niche: ${niche}`);
    return [];
  }
  
  // Step 2: Filter by relevance to topic
  const relevant = nonCompetitors.filter(source => 
    isRelevantToTopic(source, topicTitle, topicBrief)
  );
  
  if (relevant.length === 0) {
    console.warn(`[trustSourceFilter] No relevant sources found for topic: ${topicTitle}`);
    // Fallback: use non-competitors even if not perfectly relevant
    const fallback = nonCompetitors.slice(0, 3);
    return fallback.map((source, index) => ({
      id: `T${index + 1}`,
      text: extractShortAnchorText(source),
      url: source.url
    }));
  }
  
  // Step 3: Score and sort sources
  const scored = relevant.map(source => {
    let score = 0;
    
    // Official platforms get high priority
    if (isOfficialPlatform(source.url)) {
      score += 10;
    }
    
    // Deep URLs get priority
    if (isDeepUrl(source.url)) {
      score += 5;
    }
    
    // Longer snippets suggest more detailed content
    if (source.snippet && source.snippet.length > 100) {
      score += 2;
    }
    
    return { source, score };
  });
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Step 4: Select 1-3 sources
  const selected = scored.slice(0, 3).map((item, index) => ({
    id: `T${index + 1}`,
    text: extractShortAnchorText(item.source),
    url: item.source.url
  }));
  
  console.log(`[trustSourceFilter] Selected ${selected.length} trust sources from ${sources.length} total sources for niche: ${niche}`);
  
  return selected;
}

