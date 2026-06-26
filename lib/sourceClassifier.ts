// lib/sourceClassifier.ts
/**
 * Intelligent source classification using LLM
 * Classifies external sources to filter out competitors and prioritize quality sources
 */

import { getOpenAIClient } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";
import {
  filterSourcesByPolicy,
  getForcedSourceType,
  getSourcePolicyDecision,
  getSourcePriority,
} from "@/lib/sourcePolicy";

const SOURCE_CLASSIFIER_MODEL = "gpt-5.4-mini";

export type SourceType = 
  | "official_platform" 
  | "stats_or_research" 
  | "independent_media" 
  | "video"
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
  type: "official_platform" | "stats_or_research" | "independent_media" | "video";
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
  "official_platform" - official docs/blog/help of a large platform (Spotify, YouTube, TikTok, Meta, Apple Music, etc.). Native platform sources. PREFERRED.
  "stats_or_research" - statistics services, reports, data/insights, research (Statista, industry reports, data providers). PREFERRED.
  "independent_media" - trusted top publications, industry magazines, news, analysis (not blogs of promo services)
  "video" - video content (YouTube, Vimeo, etc.). Use SPARINGLY - prefer text sources over videos.
  "service_or_promo" - any site that sells services (promotion, marketing, SMM panels, "buy streams/followers/plays", agencies, promo platforms) or its blog/landing
  "other"
- "is_competitor": true/false — true if the site sells or promotes services similar to SMM / music promotion / buying plays, streams, followers, playlist placement, etc.
- "relevance_score": integer 0–10, how useful this page is as a citation for the topic "${topicTitle}" in the niche "${niche}".

Rules:
- If the page sells promo packages, pricing, "buy streams/plays/followers", playlist promotion, marketing services, SMM or similar – set "type": "service_or_promo" and "is_competitor": true.
- Blogs of such services are ALSO "service_or_promo", even if it's an educational article.
- PRIORITIZE: official_platform (native platform docs/help/blogs) > stats_or_research (Statista, reports, data) > independent_media (top publications) > video.
- If URL contains youtube.com/watch, vimeo.com, or similar video hosts – set "type": "video". Videos are low priority; prefer text sources.
- For music industry, prefer Spotify / YouTube / TikTok / Meta official docs & blogs and neutral research/statistics over video content.
- Do not be "добрим": if there is even the slightest hint that this is a promo-service – classify as "service_or_promo".
- Be conservative: if unsure, treat it as "service_or_promo" or "other".

Return JSON ONLY, no explanations, no markdown, no code blocks.`;

  try {
    const completion = await openai.chat.completions.create({
      model: SOURCE_CLASSIFIER_MODEL,
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
      max_completion_tokens: 200,
      response_format: { type: "json_object" },
    });

    const costTracker = getCostTracker();
    const usage = completion.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    costTracker.trackOpenAIChat(
      SOURCE_CLASSIFIER_MODEL,
      usage?.prompt_tokens || 0,
      usage?.completion_tokens || 0
    );

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      console.error("[sourceClassifier] Empty response from LLM");
      return null;
    }

    // Parse JSON response
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
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
    const p = parsed as { type?: unknown; is_competitor?: unknown; relevance_score?: unknown } | null;
    if (
      p &&
      typeof p.type === "string" &&
      typeof p.is_competitor === "boolean" &&
      typeof p.relevance_score === "number"
    ) {
      const policy = getSourcePolicyDecision(result);
      if (!policy.allowed) {
        return {
          url: result.url,
          title: result.title,
          type: "service_or_promo",
          is_competitor: true,
          relevance_score: 0,
        };
      }

      const forcedType = policy.forcedType;
      return {
        url: result.url,
        title: result.title,
        type: forcedType || p.type as SourceType,
        is_competitor: p.is_competitor,
        relevance_score: Math.max(0, Math.min(10, Math.round(p.relevance_score + policy.priority / 100))), // Clamp to 0-10
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
  // Lower threshold from 6 to 4 to allow more sources through
  let allowed = classified.filter(
    s =>
      s.type !== "service_or_promo" &&
      !s.is_competitor &&
      s.relevance_score >= 4
  );

  // If no sources pass with score >= 4, try with score >= 3 (more lenient)
  if (allowed.length === 0) {
    console.warn("[sourceClassifier] No sources with score >= 4, trying with score >= 3");
    allowed = classified.filter(
      s =>
        s.type !== "service_or_promo" &&
        !s.is_competitor &&
        s.relevance_score >= 3
    );
  }

  // If still no sources, try with score >= 2 (very lenient, but still filter competitors)
  if (allowed.length === 0) {
    console.warn("[sourceClassifier] No sources with score >= 3, trying with score >= 2");
    allowed = classified.filter(
      s =>
        s.type !== "service_or_promo" &&
        !s.is_competitor &&
        s.relevance_score >= 2
    );
  }

  // Final fallback: if still no sources, accept any non-competitor source
  if (allowed.length === 0) {
    console.warn("[sourceClassifier] No sources after strict filtering, using lenient fallback");
    allowed = classified.filter(
      s =>
        s.type !== "service_or_promo" &&
        !s.is_competitor
    );
  }

  if (allowed.length === 0) {
    console.warn("[sourceClassifier] No trusted sources after all filtering attempts");
    return [];
  }

  // Step 2: Rank by type priority (official_platform > stats_or_research > independent_media >> video)
  // Prefer: native platform sources, statistics services, top publications. Minimize video sources.
  const weight = (type: SourceType): number => {
    switch (type) {
      case "official_platform":
        return 4; // Highest: native platform docs/help/blogs
      case "stats_or_research":
        return 3; // High: Statista, reports, data providers
      case "independent_media":
        return 2; // Medium: top publications, industry magazines
      case "video":
        return 0; // Lowest: use sparingly, prefer text sources
      default:
        return 1;
    }
  };

  const sorted = allowed.sort((a, b) => {
    const weightDiff = weight(b.type) - weight(a.type);
    if (weightDiff !== 0) return weightDiff;
    return b.relevance_score - a.relevance_score;
  });

  // Step 3: Take top 3, but limit videos to max 1 (only if no better alternatives)
  const nonVideo = sorted.filter(s => s.type !== "video");
  const videos = sorted.filter(s => s.type === "video");
  // Prefer up to 3 non-video; if we have fewer than 3, add at most 1 video
  const top3 = [
    ...nonVideo.slice(0, 3),
    ...(nonVideo.length < 3 && videos.length > 0 ? videos.slice(0, 1) : []),
  ].slice(0, 3);
  const ids: TrustedSource["id"][] = ["T1", "T2", "T3"];

  return top3.map((source, i) => ({
    id: ids[i],
    url: source.url,
    title: source.title,
    type: (source.type === "official_platform" || source.type === "stats_or_research" || source.type === "independent_media" || source.type === "video")
      ? source.type
      : "independent_media" as TrustedSource["type"],
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

  const policyAllowedResults = filterSourcesByPolicy(tavilyResults);
  const blockedCount = tavilyResults.length - policyAllowedResults.length;
  if (blockedCount > 0) {
    console.warn(`[sourceClassifier] Blocked ${blockedCount} commercial/competitor sources before LLM classification`);
  }

  if (policyAllowedResults.length === 0) {
    console.warn("[sourceClassifier] No policy-approved sources available");
    return [];
  }

  console.log(`[sourceClassifier] Classifying ${policyAllowedResults.length} policy-approved sources for topic: ${topicTitle}`);

  // Classify all sources
  const classified = await classifySourcesBatch(policyAllowedResults, topicTitle, niche);

  if (classified.length === 0) {
    console.warn("[sourceClassifier] No sources successfully classified");
    console.warn("[sourceClassifier] Using policy-approved fallback only; raw Tavily sources are not allowed");
    const ids: TrustedSource["id"][] = ["T1", "T2", "T3"];
    return rankPolicyApprovedSources(policyAllowedResults).slice(0, 3).map((source, i) => ({
      id: ids[i],
      url: source.url,
      title: source.title,
      type: getForcedSourceType(source) || "independent_media" as const,
      relevance_score: Math.max(3, Math.min(7, Math.round(getSourcePriority(source) / 15))),
    }));
  }

  // Filter and rank
  const trusted = filterAndRankTrustedSources(classified);

  console.log(`[sourceClassifier] Selected ${trusted.length} trusted sources from ${tavilyResults.length} total sources`);

  // If filtering removed all sources, use only policy-approved non-promo classified sources.
  if (trusted.length === 0 && classified.length > 0) {
    console.warn("[sourceClassifier] All sources filtered out, using strict non-promo classified fallback");
    const nonCompetitorSources = classified.filter(s => {
      const policy = getSourcePolicyDecision(s);
      return policy.allowed && !s.is_competitor && s.type !== "service_or_promo";
    }).sort((a, b) => getSourcePriority(b) - getSourcePriority(a));
    if (nonCompetitorSources.length > 0) {
      const ids: TrustedSource["id"][] = ["T1", "T2", "T3"];
      return nonCompetitorSources.slice(0, 3).map((source, i) => ({
        id: ids[i],
        url: source.url,
        title: source.title,
        type: (source.type === "official_platform" || source.type === "stats_or_research" || source.type === "independent_media" || source.type === "video")
          ? source.type
          : "independent_media" as const,
        relevance_score: source.relevance_score,
      }));
    }
  }

  return trusted;
}

function rankPolicyApprovedSources(sources: RawSearchResult[]): RawSearchResult[] {
  return [...sources].sort((a, b) => getSourcePriority(b) - getSourcePriority(a));
}
