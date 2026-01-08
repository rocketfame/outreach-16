// lib/sourceClassifier.ts
/**
 * Intelligent source classification using LLM
 * Classifies external sources to filter out competitors and prioritize quality sources
 */

import { getOpenAIClient } from "@/lib/config";

export type SourceType = 
  | "official_platform" 
  | "stats_or_research" 
  | "independent_media" 
  | "service_or_promo" 
  | "other";

export interface RawSearchResult {
  url: string;
  title: string;
  snippet?: string;
  content_preview?: string;
}

export interface ClassifiedSource {
  url: string;
  title: string;
  type: SourceType;
  is_competitor: boolean;
  relevance_score: number; // 0-10
}

export interface TrustedSource {
  id: "T1" | "T2" | "T3";
  url: string;
  title: string;
  type: "official_platform" | "stats_or_research" | "independent_media";
  relevance_score: number;
}

/**
 * Classifies a single source using LLM
 */
export async function classifySourceLLM(
  result: RawSearchResult,
  topicTitle: string,
  niche: string
): Promise<ClassifiedSource | null> {
  const openai = getOpenAIClient();

  const prompt = `You are a strict source classifier for external references in articles.
Niche: "${niche}"
Topic: "${topicTitle}"

You receive JSON with basic page data:
${JSON.stringify({
  url: result.url,
  title: result.title,
  snippet: result.snippet || "",
  content_preview: result.content_preview || "",
}, null, 2)}

Classify this page and return ONLY a JSON object with:
- "type": one of:
  "official_platform" - official docs/blog/help of a large platform (Spotify, YouTube, TikTok, Meta, Apple Music, etc.)
  "stats_or_research" - statistics, reports, data/insights, research
  "independent_media" - big neutral media / industry magazine / news / analysis
  "service_or_promo" - any site that sells services (promotion, marketing, SMM panels, "buy streams/followers/plays", agencies, promo platforms) or its blog/landing
  "other"
- "is_competitor": true/false — true if the site sells or promotes services similar to SMM / music promotion / buying plays, streams, followers, playlist placement, etc.
- "relevance_score": integer 0–10, how useful this page is as a citation for the topic "${topicTitle}" in the niche "${niche}".

Rules:
- If the page sells promo packages, pricing, "buy streams/plays/followers", playlist promotion, marketing services, SMM or similar – set "type": "service_or_promo" and "is_competitor": true.
- Blogs of such services are ALSO "service_or_promo", even if it's an educational article.
- For music industry, prefer Spotify / YouTube / TikTok / Meta official docs & blogs and neutral research/statistics.
- Do not be "добрим": if there is even the slightest hint that this is a promo-service – classify as "service_or_promo".
- Be conservative: if unsure, treat it as "service_or_promo" or "other".

Return JSON ONLY, no explanations, no markdown, no code blocks.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for classification
      messages: [
        {
          role: "system",
          content: "You are a strict source classifier. Return only valid JSON, no explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent classification
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      console.error("[sourceClassifier] Empty response from LLM");
      return null;
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       responseText.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        console.error("[sourceClassifier] Failed to parse JSON:", responseText);
        return null;
      }
    }

    // Validate and return classified source
    if (
      typeof parsed.type === "string" &&
      typeof parsed.is_competitor === "boolean" &&
      typeof parsed.relevance_score === "number"
    ) {
      return {
        url: result.url,
        title: result.title,
        type: parsed.type as SourceType,
        is_competitor: parsed.is_competitor,
        relevance_score: Math.max(0, Math.min(10, Math.round(parsed.relevance_score))), // Clamp to 0-10
      };
    } else {
      console.error("[sourceClassifier] Invalid classification result:", parsed);
      return null;
    }
  } catch (error) {
    console.error("[sourceClassifier] Error classifying source:", error);
    return null;
  }
}

/**
 * Classifies multiple sources in parallel (with batching to avoid rate limits)
 */
export async function classifySourcesBatch(
  results: RawSearchResult[],
  topicTitle: string,
  niche: string,
  batchSize: number = 5
): Promise<ClassifiedSource[]> {
  const classified: ClassifiedSource[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(result => classifySourceLLM(result, topicTitle, niche))
    );

    // Filter out null results
    const validResults = batchResults.filter(
      (result): result is ClassifiedSource => result !== null
    );

    classified.push(...validResults);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < results.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return classified;
}

/**
 * Filters and ranks classified sources to get final trusted sources (1-3)
 */
export function filterAndRankTrustedSources(
  classified: ClassifiedSource[]
): TrustedSource[] {
  // Step 1: Filter out competitors and low-relevance sources
  const allowed = classified.filter(
    s =>
      s.type !== "service_or_promo" &&
      !s.is_competitor &&
      s.relevance_score >= 6
  );

  if (allowed.length === 0) {
    console.warn("[sourceClassifier] No trusted sources after filtering");
    return [];
  }

  // Step 2: Rank by type priority and relevance score
  const weight = (type: SourceType): number => {
    switch (type) {
      case "official_platform":
        return 3;
      case "stats_or_research":
        return 2;
      case "independent_media":
        return 1;
      default:
        return 0;
    }
  };

  const sorted = allowed.sort((a, b) => {
    const weightDiff = weight(b.type) - weight(a.type);
    if (weightDiff !== 0) return weightDiff;
    return b.relevance_score - a.relevance_score;
  });

  // Step 3: Take top 3 and assign IDs
  const top3 = sorted.slice(0, 3);
  const ids: TrustedSource["id"][] = ["T1", "T2", "T3"];

  return top3.map((source, i) => ({
    id: ids[i],
    url: source.url,
    title: source.title,
    type: source.type as TrustedSource["type"],
    relevance_score: source.relevance_score,
  }));
}

/**
 * Main function: Get trusted sources from Tavily results using LLM classification
 */
export async function getTrustedSourcesFromTavily(
  tavilyResults: RawSearchResult[],
  topicTitle: string,
  niche: string
): Promise<TrustedSource[]> {
  if (!tavilyResults || tavilyResults.length === 0) {
    return [];
  }

  console.log(`[sourceClassifier] Classifying ${tavilyResults.length} sources for topic: ${topicTitle}`);

  // Classify all sources
  const classified = await classifySourcesBatch(tavilyResults, topicTitle, niche);

  if (classified.length === 0) {
    console.warn("[sourceClassifier] No sources successfully classified");
    return [];
  }

  // Filter and rank
  const trusted = filterAndRankTrustedSources(classified);

  console.log(`[sourceClassifier] Selected ${trusted.length} trusted sources from ${tavilyResults.length} total sources`);

  return trusted;
}

