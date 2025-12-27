// lib/imageSearchAlgorithm.ts
// Universal intelligent image search algorithm
// Analyzes user request and article context to generate relevant search queries

export interface ImageSearchContext {
  userRequest: string;
  articleTitle: string;
  articleHtml: string;
  niche: string;
  language: string;
}

export interface ExtractedEntity {
  name: string;
  type: 'item' | 'topic' | 'concept' | 'person' | 'place' | 'event';
  context: string; // Surrounding text for better understanding
  priority: number; // 1-10, higher = more important
}

export interface SearchQuery {
  query: string;
  priority: number;
  entity?: ExtractedEntity; // Which entity this query targets
  searchType: 'specific' | 'general' | 'contextual';
}

/**
 * Intelligent entity extraction from article HTML
 * Extracts relevant items, topics, concepts based on article structure
 */
export function extractEntitiesFromArticle(
  articleHtml: string,
  articleTitle: string
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seenNames = new Set<string>();

  // 1. Extract from list items (most common pattern for itemized content)
  const listItemPatterns = [
    /<li[^>]*>\s*<b><a[^>]*>([^<]+)<\/a><\/b>/gi, // Bold linked names
    /<li[^>]*>\s*<b>([^<]+)<\/b>/gi, // Bold names
    /<li[^>]*>\s*<strong>([^<]+)<\/strong>/gi, // Strong names
  ];

  listItemPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(articleHtml)) !== null) {
      const name = match[1].trim();
      if (isValidEntity(name)) {
        const normalized = name.toLowerCase();
        if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          
          // Extract context (next 100 chars after the match)
          const contextStart = match.index + match[0].length;
          const context = articleHtml.substring(contextStart, contextStart + 100)
            .replace(/<[^>]*>/g, ' ')
            .trim()
            .substring(0, 100);

          entities.push({
            name,
            type: detectEntityType(name, context),
            context,
            priority: calculatePriority(name, context, articleTitle),
          });
        }
      }
    }
  });

  // 2. Extract from headings (H2, H3) - these often contain topics/sections
  const headingPattern = /<h[23][^>]*>([^<]+)<\/h[23]>/gi;
  let headingMatch;
  while ((headingMatch = headingPattern.exec(articleHtml)) !== null) {
    const heading = headingMatch[1].trim();
    if (isValidEntity(heading) && !heading.toLowerCase().includes('introduction') &&
        !heading.toLowerCase().includes('conclusion') &&
        !heading.toLowerCase().includes('overview')) {
      const normalized = heading.toLowerCase();
      if (!seenNames.has(normalized)) {
        seenNames.add(normalized);
        entities.push({
          name: heading,
          type: 'topic',
          context: '',
          priority: 7, // Headings are important
        });
      }
    }
  }

  // 3. Extract from bold links (common for names, brands, events)
  const boldLinkPattern = /<b><a[^>]*href=["'][^"']*["'][^>]*>([^<]+)<\/a><\/b>/gi;
  let linkMatch;
  while ((linkMatch = boldLinkPattern.exec(articleHtml)) !== null) {
    const name = linkMatch[1].trim();
    if (isValidEntity(name) && name.length < 60) {
      const normalized = name.toLowerCase();
      if (!seenNames.has(normalized) && !seenNames.has(name)) {
        seenNames.add(normalized);
        entities.push({
          name,
          type: detectEntityType(name, ''),
          context: '',
          priority: 6,
        });
      }
    }
  }

  // Sort by priority (highest first)
  return entities.sort((a, b) => b.priority - a.priority);
}

/**
 * Detect entity type based on name and context
 */
function detectEntityType(name: string, context: string): ExtractedEntity['type'] {
  const lowerName = name.toLowerCase();
  const lowerContext = context.toLowerCase();

  // Check for event/festival indicators
  if (lowerName.includes('festival') || lowerName.includes('event') ||
      lowerName.includes('conference') || lowerName.includes('summit') ||
      lowerContext.includes('festival') || lowerContext.includes('event')) {
    return 'event';
  }

  // Check for person indicators
  if (lowerContext.includes('artist') || lowerContext.includes('musician') ||
      lowerContext.includes('dj') || lowerContext.includes('performer')) {
    return 'person';
  }

  // Check for place indicators
  if (lowerContext.includes('location') || lowerContext.includes('venue') ||
      lowerContext.includes('city') || lowerContext.includes('country')) {
    return 'place';
  }

  // Default to item for list items
  return 'item';
}

/**
 * Calculate priority based on name, context, and title relevance
 */
function calculatePriority(name: string, context: string, articleTitle: string): number {
  let priority = 5; // Base priority

  // Increase priority if name appears in title
  if (articleTitle.toLowerCase().includes(name.toLowerCase())) {
    priority += 3;
  }

  // Increase priority if context is rich (more information available)
  if (context.length > 50) {
    priority += 1;
  }

  // Increase priority for shorter, more specific names (likely proper nouns)
  if (name.length >= 5 && name.length <= 40) {
    priority += 1;
  }

  // Decrease priority for very generic terms
  const genericTerms = ['the', 'and', 'or', 'for', 'with', 'from', 'this', 'that'];
  if (genericTerms.some(term => name.toLowerCase().startsWith(term + ' '))) {
    priority -= 2;
  }

  return Math.max(1, Math.min(10, priority));
}

/**
 * Check if extracted text is a valid entity name
 */
function isValidEntity(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return false;

  const lower = name.toLowerCase();

  // Filter out common non-entity patterns
  const excludePatterns = [
    'introduction', 'conclusion', 'overview', 'summary',
    'how this', 'quick planning', 'closing thought',
    'what "', 'note:', 'important:', 'remember:',
    'click here', 'read more', 'learn more',
  ];

  if (excludePatterns.some(pattern => lower.includes(pattern))) {
    return false;
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;

  return true;
}

/**
 * Analyze user request to extract search intent and preferences
 */
export interface SearchIntent {
  wantsImages: boolean;
  wantsSocialMedia: boolean;
  wantsOfficialSites: boolean;
  wantsSpecificItems: boolean; // "for each", "every", "all items"
  wantsEvenDistribution: boolean; // "evenly", "distributed"
  preferredSources: string[]; // Instagram, Facebook, official, etc.
  searchDepth: 'shallow' | 'medium' | 'deep'; // How comprehensive the search should be
}

export function analyzeUserRequest(userRequest: string): SearchIntent {
  const lower = userRequest.toLowerCase();

  const intent: SearchIntent = {
    wantsImages: false,
    wantsSocialMedia: false,
    wantsOfficialSites: false,
    wantsSpecificItems: false,
    wantsEvenDistribution: false,
    preferredSources: [],
    searchDepth: 'medium',
  };

  // Detect image request
  const imageKeywords = [
    'image', 'images', 'photo', 'photos', 'picture', 'pictures',
    'visual', 'visuals', 'зображення', 'фото', 'картинк', 'візуал',
    'add image', 'find image', 'search image', 'додай зображення',
    'знайди зображення', 'додай фото', 'знайди фото',
  ];
  intent.wantsImages = imageKeywords.some(keyword => lower.includes(keyword));

  // Detect social media preference
  const socialKeywords = ['instagram', 'facebook', 'social media', 'соціальн', 'соцмереж'];
  intent.wantsSocialMedia = socialKeywords.some(keyword => lower.includes(keyword));
  if (intent.wantsSocialMedia) {
    if (lower.includes('instagram')) intent.preferredSources.push('instagram');
    if (lower.includes('facebook')) intent.preferredSources.push('facebook');
    intent.preferredSources.push('social media');
  }

  // Detect official sites preference
  const officialKeywords = ['official', 'офіційн', 'official site', 'official website'];
  intent.wantsOfficialSites = officialKeywords.some(keyword => lower.includes(keyword));
  if (intent.wantsOfficialSites) {
    intent.preferredSources.push('official');
  }

  // Detect specific items request
  const specificKeywords = ['each', 'every', 'all', 'для кожного', 'кожен', 'всі'];
  intent.wantsSpecificItems = specificKeywords.some(keyword => lower.includes(keyword));

  // Detect even distribution request
  const evenKeywords = ['evenly', 'even', 'distributed', 'рівномірно', 'рівно'];
  intent.wantsEvenDistribution = evenKeywords.some(keyword => lower.includes(keyword));

  // Determine search depth
  if (lower.includes('comprehensive') || lower.includes('all') || lower.includes('всі')) {
    intent.searchDepth = 'deep';
  } else if (lower.includes('few') || lower.includes('some') || lower.includes('декілька')) {
    intent.searchDepth = 'shallow';
  }

  return intent;
}

/**
 * Generate intelligent search queries based on context and intent
 */
export function generateSearchQueries(
  context: ImageSearchContext,
  intent: SearchIntent,
  entities: ExtractedEntity[]
): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const seenQueries = new Set<string>();

  // 1. Generate queries for each extracted entity (if wantsSpecificItems or deep search)
  if (intent.wantsSpecificItems || intent.searchDepth === 'deep' || entities.length > 0) {
    const maxEntities = intent.searchDepth === 'deep' ? entities.length : Math.min(entities.length, 20);
    
    entities.slice(0, maxEntities).forEach(entity => {
      const entityQueries = generateEntityQueries(entity, context, intent);
      entityQueries.forEach(query => {
        const normalized = query.query.toLowerCase().trim();
        if (!seenQueries.has(normalized) && query.query.length > 5) {
          seenQueries.add(normalized);
          queries.push(query);
        }
      });
    });
  }

  // 2. Generate general article queries (LIMITED to save credits)
  const generalQueries = generateGeneralQueries(context, intent);
  // Only add top 1-2 general queries
  generalQueries.slice(0, 2).forEach(query => {
    const normalized = query.query.toLowerCase().trim();
    if (!seenQueries.has(normalized) && query.query.length > 5) {
      seenQueries.add(normalized);
      queries.push(query);
    }
  });

  // 3. Generate contextual queries (LIMITED to save credits)
  const contextualQueries = generateContextualQueries(context, intent);
  // Only add top 1 contextual query
  contextualQueries.slice(0, 1).forEach(query => {
    const normalized = query.query.toLowerCase().trim();
    if (!seenQueries.has(normalized) && query.query.length > 5) {
      seenQueries.add(normalized);
      queries.push(query);
    }
  });

  // Sort by priority (highest first)
  return queries.sort((a, b) => b.priority - a.priority);
}

/**
 * Generate queries for a specific entity
 */
function generateEntityQueries(
  entity: ExtractedEntity,
  context: ImageSearchContext,
  intent: SearchIntent
): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const name = entity.name;

  // OPTIMIZED: Generate fewer, more targeted queries to save Tavily credits
  // Priority: Official sites > Social media > General search
  const baseQueries: Array<{ query: string; priority: number; type: 'specific' | 'contextual' | 'general' }> = [];
  
  // CRITICAL: Prioritize official website searches first (most reliable, best images)
  // Extract potential official domain from entity name
  const officialSiteQueries: string[] = [];
  if (intent.wantsOfficialSites || true) { // Always prioritize official sites
    // Try common official site patterns
    const nameLower = name.toLowerCase().replace(/\s+/g, '');
    officialSiteQueries.push(
      `${name} official website`,
      `${name} official site`,
      `site:${nameLower}.com ${name}`,
      `${name} homepage`,
    );
  }
  
  // Add official site queries with highest priority
  officialSiteQueries.slice(0, 2).forEach(query => {
    baseQueries.push({ query, priority: 10, type: 'specific' }); // Highest priority
  });

  // Add direct name query (high priority)
  baseQueries.push(
    { query: name, priority: 9, type: 'specific' },
  );

  // Add type-specific queries (only if needed)
  if (entity.type === 'event') {
    baseQueries.push(
      { query: `${name} festival`, priority: 8, type: 'specific' },
    );
  }

  // Add photo/image queries (only 1-2 most important)
  baseQueries.push(
    { query: `${name} photo`, priority: 7, type: 'specific' },
  );

  // Add source-specific queries if requested (limited to save credits)
  if (intent.wantsSocialMedia) {
    intent.preferredSources.slice(0, 1).forEach(source => { // Limit to 1 source
      if (source === 'instagram') {
        baseQueries.push(
          { query: `${name} instagram`, priority: 6, type: 'specific' },
        );
      }
      if (source === 'facebook') {
        baseQueries.push(
          { query: `${name} facebook`, priority: 6, type: 'specific' },
        );
      }
    });
  }

  // REMOVED: Context keywords - too many queries, not worth the credits
  // Only use if absolutely necessary

  // Convert to SearchQuery format
  baseQueries.forEach(({ query, priority, type }) => {
    queries.push({
      query: query.trim(),
      priority,
      entity,
      searchType: type,
    });
  });

  return queries;
}

/**
 * Generate general article queries (OPTIMIZED - fewer queries)
 */
function generateGeneralQueries(
  context: ImageSearchContext,
  intent: SearchIntent
): SearchQuery[] {
  const queries: SearchQuery[] = [];

  // Only most important general query
  queries.push({
    query: `${context.articleTitle} ${context.niche}`,
    priority: 7,
    searchType: 'general',
  });

  // Removed other general queries to save Tavily credits

  return queries;
}

/**
 * Generate contextual queries based on user request (OPTIMIZED - fewer queries)
 */
function generateContextualQueries(
  context: ImageSearchContext,
  intent: SearchIntent
): SearchQuery[] {
  const queries: SearchQuery[] = [];

  // Extract keywords from user request
  const requestKeywords = extractKeywords(context.userRequest);
  
  // Only use top 1 most relevant keyword to save credits
  const relevantKeyword = requestKeywords.find(keyword => 
    keyword.length > 3 && 
    !['image', 'photo', 'add', 'find', 'check', 'ensure'].includes(keyword)
  );
  
  if (relevantKeyword) {
    queries.push({
      query: `${context.articleTitle} ${relevantKeyword}`,
      priority: 5,
      searchType: 'contextual',
    });
  }

  return queries;
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, ' ');
  
  // Split into words
  const words = cleanText.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !isStopWord(word));

  // Return unique words
  return Array.from(new Set(words));
}

/**
 * Check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that',
    'these', 'those', 'what', 'which', 'when', 'where', 'who', 'how',
    'have', 'has', 'had', 'was', 'were', 'been', 'being', 'are', 'is',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'about', 'above', 'after', 'before', 'during', 'into', 'onto', 'over',
    'under', 'through', 'between', 'among', 'within', 'without',
  ]);
  return stopWords.has(word);
}

