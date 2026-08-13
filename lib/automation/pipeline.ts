import { POST as generateArticleRoute } from "@/app/api/articles/route";
import { POST as generateImageRoute } from "@/app/api/article-image/route";
import { getCostTracker } from "@/lib/costTracker";
import { getTextProviderConfig } from "@/lib/textProvider";
import { searchReliableSources, type ReliableSearchOptions, type TrustedSource } from "@/lib/tavilyClient";
import { getCachedSources, setCachedSources, sourceCacheKey } from "@/lib/automation/sourceCache";
import { getSourcePolicyDecision, getSourcePriority, isVideoUrl } from "@/lib/sourcePolicy";
import {
  anchorInFirstParagraphs,
  cleanQuoteDebris,
  displayNameForUrl,
  enforceSingleMention,
  hasGluedLinks,
  normalizeGoogleSupportLocale,
  repairMoneyAnchor,
  shortenExternalLinkTexts,
  stripDisallowedLinks,
  urlResolves,
} from "@/lib/automation/linkGuard";
import { IMAGE_BOX_PROMPTS } from "@/lib/imageBoxPrompts";
import { INTERNAL_CALL_HEADER, INTERNAL_CALL_TOKEN } from "@/lib/automation/internal";
import { countAutomationWords, slugifyAutomationTitle } from "@/lib/automation/text";
import { claimAutomationRetry } from "@/lib/automation/budget";
import {
  findContentIntegrityIssues,
  findLanguageOrthographyIssue,
  restoreBrandToken,
} from "@/lib/automation/contentQuality";
import type {
  AutomationArticle,
  AutomationCoverRequest,
  AutomationCoverSuccess,
  AutomationGenerateRequest,
  AutomationGenerateSuccess,
} from "@/lib/automation/types";

/** Pipeline failure with a machine-readable code surfaced in the job error. */
export class AutomationPipelineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AutomationPipelineError";
    this.code = code;
  }
}

type InternalArticleResponse = {
  articles?: Array<{
    topicTitle: string;
    titleTag: string;
    metaDescription: string;
    fullArticleText: string;
    articleBodyHtml?: string;
    humanizedOnWrite?: boolean;
    humanizationReport?: {
      providerUsage?: {
        undetectableWords: number;
        betterWordsWords: number;
        betterWordsFallbackUsed: boolean;
      };
    };
  }>;
  error?: string;
  code?: string;
};

type InternalImageResponse = {
  success: boolean;
  imageBase64?: string;
  selectedBoxId?: string;
  extension?: "png" | "webp";
  error?: string;
  code?: string;
};

async function generateArticleOnce(
  request: AutomationGenerateRequest,
  topic: string,
  trustSourcesList: string[],
  targetWords: number,
  extraInstruction: string
): Promise<{
  generatedTitleTag: string;
  contentHtml: string;
  metaDescription: string;
  humanizedOnWrite: boolean;
  humanizationProvider?: "undetectable" | "betterwords" | "mixed";
}> {
  const articleResponse = await generateArticleRoute(new Request("https://automation.local/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "automation",
      [INTERNAL_CALL_HEADER]: INTERNAL_CALL_TOKEN,
    },
    body: JSON.stringify({
      brief: {
        niche: request.niche,
        platform: request.category,
        contentPurpose: "Guest post / outreach",
        // Brand NAME goes into clientSite (the UI "Brand" field). Never the
        // URL: the route extracts a bare domain from URLs, the model then
        // writes "Brand.tld" and the humanizer mangles it (net-glitch).
        clientSite: request.brand || request.anchorUrl || "",
        anchorText: request.anchor || "",
        anchorUrl: request.anchorUrl || "",
        language: request.language || "English",
        wordCount: String(targetWords),
      },
      selectedTopics: [
        {
          title: topic,
          brief: buildTopicBrief(request, topic) + (extraInstruction ? `\n${extraInstruction}` : ""),
        },
      ],
      trustSourcesList,
      allowMissingTrustSources: true,
      writingMode: request.mode === "human" ? "human" : "seo",
      humanizeOnWrite: request.mode === "human",
      humanizeSettings: {
        model: 2,
        style: "Blog",
        mode: "Autopilot",
      },
    }),
  }));

  const articleJson = (await articleResponse.json()) as InternalArticleResponse;
  if (!articleResponse.ok || !articleJson.articles?.[0]) {
    throw new AutomationPipelineError(
      articleJson.code || "generation_failed",
      articleJson.error || "Article generation failed."
    );
  }

  const generated = articleJson.articles[0];
  if (request.mode === "human" && !generated.humanizedOnWrite) {
    throw new AutomationPipelineError(
      "humanization_failed",
      "Human mode produced no successfully humanized blocks. Undetectable.AI and the BetterWords fallback did not complete; the article will not ship unhumanized."
    );
  }
  const providerUsage = generated.humanizationReport?.providerUsage;
  const humanizationProvider = providerUsage
    ? providerUsage.betterWordsWords > 0 && providerUsage.undetectableWords > 0
      ? "mixed" as const
      : providerUsage.betterWordsWords > 0
        ? "betterwords" as const
        : providerUsage.undetectableWords > 0
          ? "undetectable" as const
          : undefined
    : undefined;
  const generatedTitleTag = stripTags(generated.titleTag || topic).trim();
  const rawHtml = generated.articleBodyHtml || generated.fullArticleText || "";

  // Deterministic repair chain — order matters:
  // sanitize → drop disallowed citations (whole sentence, no orphan text)
  // → clause-length citation anchors to resource names → quote debris
  // → single plain-text anchor mention → exact money anchor.
  let contentHtml = sanitizeAutomationHtml(rawHtml);
  contentHtml = stripDisallowedLinks(contentHtml, request.anchorUrl);
  contentHtml = shortenExternalLinkTexts(contentHtml, request.anchorUrl);
  contentHtml = cleanQuoteDebris(contentHtml);
  contentHtml = restoreBrandToken(contentHtml, request.brand);
  // Enforce the single ANCHOR mention only when the anchor text is not the
  // brand itself — brand mentions (2-3x) must survive.
  const anchorIsBrand =
    request.brand && request.anchor.toLowerCase().includes(request.brand.toLowerCase());
  if (request.anchor && !anchorIsBrand) {
    contentHtml = enforceSingleMention(contentHtml, request.anchor);
  }
  if (request.anchor && request.anchorUrl) {
    contentHtml = repairMoneyAnchor(contentHtml, request.anchor, request.anchorUrl).html;
  }
  return {
    generatedTitleTag,
    contentHtml,
    metaDescription: generated.metaDescription || "",
    humanizedOnWrite: generated.humanizedOnWrite === true,
    humanizationProvider,
  };
}

/** Draft defects that warrant a retry and, if persistent, an honest error. */
function collectDraftFailures(
  request: AutomationGenerateRequest,
  contentHtml: string,
  minWords: number
): Array<{ code: string; message: string }> {
  const failures: Array<{ code: string; message: string }> = [];
  const integrityIssues = findContentIntegrityIssues(contentHtml);
  if (integrityIssues.length > 0) {
    failures.push({
      code: "truncated_output",
      message: `Generated article contains incomplete or corrupted prose: ${integrityIssues.map((issue) => issue.message).join(" ")}`,
    });
  }
  const orthographyIssue = findLanguageOrthographyIssue(contentHtml, request.language);
  if (orthographyIssue) {
    failures.push({ code: "orthography_invalid", message: orthographyIssue });
  }
  const wordCount = countAutomationWords(contentHtml);
  if (wordCount < minWords) {
    failures.push({
      code: "below_min_words",
      message: `Generated article has ${wordCount} words; the floor is ${minWords}. Likely too little research material for this niche+category pair — try a more specific niche (e.g. "Electronic music industry" instead of "Music industry") or lower minWords.`,
    });
  }
  if (request.anchor && request.anchorUrl) {
    if (!contentHtml.includes(request.anchorUrl)) {
      failures.push({
        code: "anchor_missing",
        message: `The commercial anchor link (${request.anchor}) is missing from the article body.`,
      });
    } else if (!anchorInFirstParagraphs(contentHtml, request.anchorUrl, 3)) {
      failures.push({
        code: "anchor_misplaced",
        message: "The commercial anchor link is not within the first 3 paragraphs.",
      });
    }
  }
  if (hasGluedLinks(contentHtml)) {
    failures.push({
      code: "anchor_broken",
      message: "A link is glued to a word (mid-word link placement) — rejecting rather than shipping broken markup.",
    });
  }
  return failures;
}

export async function runAutomationGeneration(
  generationId: string,
  request: AutomationGenerateRequest
): Promise<AutomationGenerateSuccess> {
  const costBefore = getCostTracker().getTotalCosts().total;
  const topic = request.topic || buildFallbackTopic(request);
  const minWords = request.minWords || 1200;
  const targetWords = Math.round((minWords + (request.maxWords || 1800)) / 2);

  const trustSourcesList = await buildTrustSourcesList(topic, request.category);

  // Acceptance failures trigger ONE retry with corrective instructions, then
  // an honest error. A 245-word stub or a broken anchor shipped with status
  // "done" is the same class of bug as masked insufficient_quota.
  let article = await generateArticleOnce(request, topic, trustSourcesList, targetWords, "");
  let failures = collectDraftFailures(request, article.contentHtml, minWords);
  if (failures.length > 0) {
    console.warn(`[automationPipeline] Draft failed checks (${failures.map(f => f.code).join(", ")}); retrying once.`);
    const boostedTarget = Math.max(targetWords, Math.round(minWords * 1.3));
    const corrective = [
      `The article MUST contain at least ${minWords} words of substantive content. Do not pad with filler — add concrete examples, steps, and specifics instead.`,
      request.anchor ? `Place the commercial anchor [A1] inside a complete sentence within the first 2-3 paragraphs.` : "",
      failures.some((failure) => failure.code === "truncated_output")
        ? [
            "Return only complete paragraphs and complete sentences. Every paragraph must end with terminal punctuation; balance all quotation marks; never leave a colon, verb, number, or clause without its continuation.",
            `The previous draft failed these exact integrity checks: ${failures
              .filter((failure) => failure.code === "truncated_output")
              .map((failure) => failure.message)
              .join(" ")}`,
          ].join("\n")
        : "",
      failures.some((failure) => failure.code === "orthography_invalid")
        ? buildLanguageOrthographyInstruction(request.language)
        : "",
    ].filter(Boolean).join("\n");
    // A full quality retry is another article-model call. Reserve a realistic
    // floor before starting it; the metered provider wrapper performs the
    // final ceiling check with the exact prompt and token limit.
    claimAutomationRetry("article_quality_retry", 0.2);
    article = await generateArticleOnce(request, topic, trustSourcesList, boostedTarget, corrective);
    failures = collectDraftFailures(request, article.contentHtml, minWords);
  }
  if (failures.length > 0) {
    const first = failures[0];
    throw new AutomationPipelineError(first.code, `${first.message} (after retry)`);
  }
  const wordCount = countAutomationWords(article.contentHtml);

  const { contentHtml } = article;
  // The given topic is a deliberate keyword-loaded hook — it IS the H1,
  // verbatim. The engine's own titleTag only serves as the shortened Title
  // tag (seoTitle), never as a replacement for the hook.
  const title = request.topic ? request.topic.trim() : article.generatedTitleTag;
  const seoTitle = truncateText(article.generatedTitleTag || title, request.seoTitleMaxChars || 65);
  const seoDescription = cleanDescription(article.metaDescription || summarizeText(contentHtml, 155));
  let slug: string;
  try {
    slug = slugifyAutomationTitle(title, request.language);
  } catch (error) {
    throw new AutomationPipelineError(
      "slug_invalid",
      error instanceof Error ? error.message : "Generated slug is invalid."
    );
  }

  let cover: AutomationArticle["cover"];
  let imageStyleUsed: string | undefined;
  if (request.image !== false) {
    // excludeImageStyles (stable ids) → box indices for the route's
    // no-repeat mechanism. Selection itself is stateless per job — batch
    // de-duplication is the caller's loop: read meta.imageStyle from each
    // done job and pass the accumulated list into the next request.
    const excludedIndices = (request.excludeImageStyles || [])
      .map((id) => IMAGE_BOX_PROMPTS.findIndex((box) => box.id === id))
      .filter((index) => index >= 0);
    const imageResponse = await generateImageRoute(new Request("https://automation.local/api/article-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "automation",
        [INTERNAL_CALL_HEADER]: INTERNAL_CALL_TOKEN,
      },
      body: JSON.stringify({
        articleTitle: title,
        niche: request.niche,
        mainPlatform: request.category,
        contentPurpose: "Guest post / outreach",
        brandName: request.brand || request.anchor || "",
        usedBoxIndices: excludedIndices,
        imageBoxId: request.imageStyle || undefined,
        quality: request.imageQuality || undefined,
        outputFormat: request.coverFormat,
        outputCompression: request.coverFormat === "webp" ? 80 : undefined,
      }),
    }));
    const imageJson = (await imageResponse.json()) as InternalImageResponse;
    if (!imageResponse.ok || !imageJson.success || !imageJson.imageBase64) {
      throw new AutomationPipelineError(
        imageJson.code || "generation_failed",
        imageJson.error || "Cover image generation failed."
      );
    }
    imageStyleUsed = imageJson.selectedBoxId;
    cover = {
      base64: imageJson.imageBase64,
      format: imageJson.extension || request.coverFormat,
      alt: `${title} hero image`,
    };
  }

  const costAfter = getCostTracker().getTotalCosts().total;
  const textProvider = getTextProviderConfig();

  return {
    status: "ok",
    generationId,
    article: {
      title,
      slug,
      category: request.category,
      seoTitle,
      excerpt: cleanDescription(summarizeText(contentHtml, 158)),
      seoDescription,
      readTimeMinutes: estimateReadTime(contentHtml),
      contentHtml,
      cover,
    },
    meta: {
      model: textProvider.model,
      humanized: article.humanizedOnWrite,
      language: request.language || "English",
      humanizationProvider: article.humanizationProvider,
      wordCount,
      imageStyle: imageStyleUsed,
      imageFamily: familyOfBox(imageStyleUsed),
      costUsd: Math.max(0, Number((costAfter - costBefore).toFixed(6))),
      billingSource: textProvider.kind === "openai" ? "openai_api" : "external_text_provider",
      textProvider: textProvider.name,
      quotaRemaining: null,
    },
  };
}

/** Palette family for a box id — echoed so callers can de-dup at family level. */
function familyOfBox(boxId?: string): string | undefined {
  if (!boxId) return undefined;
  return IMAGE_BOX_PROMPTS.find((box) => box.id === boxId)?.paletteFamily;
}

/**
 * Cover-only generation: one gpt-image-2 call through the existing internal
 * image route, no article text. ~$0.05 at medium quality instead of paying
 * $0.20 for a throwaway article to replace one bad cover.
 */
export async function runCoverGeneration(
  generationId: string,
  request: AutomationCoverRequest
): Promise<AutomationCoverSuccess> {
  const costBefore = getCostTracker().getTotalCosts().total;
  const excludedIndices = (request.excludeImageStyles || [])
    .map((id) => IMAGE_BOX_PROMPTS.findIndex((box) => box.id === id))
    .filter((index) => index >= 0);

  const imageResponse = await generateImageRoute(new Request("https://automation.local/api/article-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "automation",
      [INTERNAL_CALL_HEADER]: INTERNAL_CALL_TOKEN,
    },
    body: JSON.stringify({
      articleTitle: request.topic,
      niche: request.niche || request.category || "General",
      mainPlatform: request.category || "multi-platform",
      contentPurpose: "Guest post / outreach",
      brandName: "",
      usedBoxIndices: excludedIndices,
      imageBoxId: request.imageStyle || undefined,
      quality: request.imageQuality || undefined,
      outputFormat: request.coverFormat,
      outputCompression: request.coverFormat === "webp" ? 80 : undefined,
    }),
  }));

  const imageJson = (await imageResponse.json()) as InternalImageResponse;
  if (!imageResponse.ok || !imageJson.success || !imageJson.imageBase64) {
    throw new AutomationPipelineError(
      imageJson.code || "generation_failed",
      imageJson.error || "Cover image generation failed."
    );
  }

  const costAfter = getCostTracker().getTotalCosts().total;
  return {
    status: "ok",
    generationId,
    cover: {
      base64: imageJson.imageBase64,
      format: imageJson.extension || request.coverFormat,
      alt: `${request.topic} hero image`,
    },
    meta: {
      imageStyle: imageJson.selectedBoxId,
      imageFamily: familyOfBox(imageJson.selectedBoxId),
      costUsd: Math.max(0, Number((costAfter - costBefore).toFixed(6))),
    },
  };
}

/**
 * One automation source search: basic depth ($0.01 instead of $0.05 —
 * the pipeline only consumes title/url/snippet), KV-cached for 7 days so
 * batch reruns of the same niche/topic pay $0.00.
 */
async function searchAutomationSourcesCached(
  query: string,
  options: Omit<ReliableSearchOptions, "depth"> = {}
): Promise<{ sources: TrustedSource[]; cacheHit: boolean }> {
  const cacheKey = sourceCacheKey(query, "basic", options.includeDomains);
  const cached = await getCachedSources(cacheKey);
  if (cached) return { sources: cached, cacheHit: true };
  const sources = await searchReliableSources(query, { ...options, depth: "basic" });
  await setCachedSources(cacheKey, sources);
  return { sources, cacheHit: false };
}

/**
 * Hard budget: at most TWO Tavily searches per job (≤ $0.02 fresh, $0.00
 * cached). The second search carries the independent-source gate, so it runs
 * against the curated allowlist instead of hoping the open web sweep happens
 * to surface research domains — the extra targeted/recovery searches the
 * pipeline used to fire are gone.
 */
async function searchAutomationTrustSources(topic: string, category: string) {
  const officialQuery = buildOfficialSourceQuery(topic, category);
  const researchQuery = buildIndependentResearchQuery(topic, category);

  const [official, independent] = await Promise.all([
    searchAutomationSourcesCached(officialQuery),
    searchAutomationSourcesCached(researchQuery, {
      includeDomains: INDEPENDENT_SOURCE_DOMAINS,
      maxResults: 20,
    }),
  ]);

  const merged = dedupeSources([...official.sources, ...independent.sources]).map((source) => ({
    ...source,
    url: normalizeGoogleSupportLocale(source.url),
  }));

  return {
    sources: merged,
    cacheHits: Number(official.cacheHit) + Number(independent.cacheHit),
  };
}

/** Targeted tier-2/3 search when the general sweep yields no independent sources. */
export const INDEPENDENT_SOURCE_DOMAINS = [
  "billboard.com",
  "musicbusinessworldwide.com",
  "pewresearch.org",
  "midiaresearch.com",
  "ifpi.org",
  "soundcharts.com",
  "chartmasters.org",
  "chartmetric.com",
  "streamscharts.com",
  "twitchtracker.com",
  "socialinsider.io",
  "datareportal.com",
];

/**
 * Research intent must not inherit a transactional "buy followers/views"
 * phrase verbatim. That wording biases search toward vendors and competitors,
 * while the article H1 remains unchanged and still carries the money keyword.
 */
export function buildIndependentResearchQuery(topic: string, category: string): string {
  const informationalTopic = topic
    .replace(
      /\b(?:buy|buying|purchase|purchasing|comprare|compra|acquistare|acquista|comprar|acheter|achat|kaufen|kauf|kupic|kupić|zakup)\b/giu,
      " "
    )
    .replace(/\s+/g, " ")
    .replace(/^\s*:\s*|\s*:\s*$/g, "")
    .trim();

  const categoryIntent: Record<string, string> = {
    youtube: "creator audience growth discovery engagement video performance",
    tiktok: "creator audience growth credibility engagement consumer trust",
    instagram: "creator audience growth credibility engagement consumer trust",
    spotify: "artist audience growth music discovery streaming engagement",
    soundcloud: "artist audience growth music discovery listener engagement",
  };
  const intent = categoryIntent[category.trim().toLowerCase()]
    || "creator audience growth engagement platform research";

  return `${informationalTopic} ${category} ${intent} independent research statistics report`;
}

type ScoredSource = { title: string; url: string; snippet?: string };

function isIndependentSource(url: string): boolean {
  const forcedType = getSourcePolicyDecision({ url, title: "", snippet: "" }).forcedType;
  return forcedType === "stats_or_research" || forcedType === "independent_media";
}

function isPlatformDocSource(url: string): boolean {
  return getSourcePolicyDecision({ url, title: "", snippet: "" }).forcedType === "official_platform";
}

/**
 * Source list composition per the outreach spec:
 * - platform documentation capped at 2 per article;
 * - at least 1 independent source (research/trade press) or the job errors —
 *   ten guest posts citing only the platform's own help pages is a
 *   fingerprint and reads as thin;
 * - every candidate URL must resolve (2xx) before it can be cited;
 * - citation titles are canonical resource names (link anchors are 1-4 words).
 */
async function buildTrustSourcesList(topic: string, category: string): Promise<string[]> {
  const rejected: Array<{ url: string; reason: string }> = [];
  let sources: ScoredSource[];
  let cacheHits = 0;
  try {
    const lookup = await searchAutomationTrustSources(topic, category);
    sources = lookup.sources;
    cacheHits = lookup.cacheHits;
  } catch (error) {
    console.error("[automationSources] Source lookup failed before policy filtering:", {
      topic,
      category,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new AutomationPipelineError(
      "source_lookup_failed",
      `Source search could not be completed for "${topic}" (${category}). Retry later; this is not evidence that the topic has no independent sources.`
    );
  }

  const approve = (source: ScoredSource): boolean => {
    const decision = getSourcePolicyDecision(source);
    if (!decision.allowed) {
      rejected.push({ url: source.url, reason: decision.reason });
      return false;
    }
    if (isVideoUrl(source.url)) {
      rejected.push({ url: source.url, reason: "video_source" });
      return false;
    }
    if (category.trim().toLowerCase() !== "growth" && /(^|\.)shopify\.com$/i.test(hostnameOf(source.url))) {
      rejected.push({ url: source.url, reason: "platform_domain_for_other_category" });
      return false;
    }
    return true;
  };

  const candidates: ScoredSource[] = sources.filter(approve)
    .sort((a, b) => getSourcePriority(b) - getSourcePriority(a));

  const independents = candidates.filter((s) => isIndependentSource(s.url));
  const platformDocs = candidates.filter((s) => isPlatformDocSource(s.url)).slice(0, 2);
  const nonPlatform = candidates.filter((s) => !isPlatformDocSource(s.url));
  const composed = dedupeSources([...independents.slice(0, 3), ...platformDocs, ...nonPlatform]).slice(0, 6);

  // Dead links get dropped before they can be cited.
  const resolutions = await Promise.all(composed.map((s) => urlResolves(s.url)));
  composed.forEach((source, index) => {
    if (!resolutions[index]) rejected.push({ url: source.url, reason: "unavailable" });
  });
  const alive = composed.filter((_, i) => resolutions[i]);

  console.info("[automationSources] Source gate diagnostics:", {
    topic,
    category,
    searchExecuted: true,
    searchesExecuted: 2 - cacheHits,
    cacheHits,
    candidatesFound: sources.length,
    candidatesApproved: candidates.length,
    candidatesAlive: alive.length,
    independentAlive: alive.filter((source) => isIndependentSource(source.url)).length,
    rejected,
  });

  if (!alive.some((s) => isIndependentSource(s.url))) {
    throw new AutomationPipelineError(
      "no_independent_sources",
      `Source lookup completed, but no live independent (non-platform) source survived policy checks for "${topic}" (${category}). An article citing only platform or competitor material does not ship — change or narrow the topic.`
    );
  }

  // Snippets are prompt payload: cap them so six sources cannot silently
  // inflate the generation call's input-token bill.
  return alive.map((s) => `${displayNameForUrl(s.url)}|${s.url}|${truncateSnippet(s.snippet)}`);
}

const MAX_SOURCE_SNIPPET_CHARS = 400;

function truncateSnippet(snippet?: string): string {
  const clean = (snippet || "").replace(/\s+/g, " ").trim();
  return clean.length <= MAX_SOURCE_SNIPPET_CHARS
    ? clean
    : `${clean.slice(0, MAX_SOURCE_SNIPPET_CHARS).trim()}...`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const PLATFORM_OFFICIAL_SITES: Record<string, string[]> = {
  spotify: ["site:artists.spotify.com", "site:newsroom.spotify.com"],
  youtube: ["site:support.google.com/youtube", "site:blog.youtube", "site:youtube.com/creators"],
  tiktok: ["site:tiktok.com/business", "site:newsroom.tiktok.com", "site:support.tiktok.com"],
  instagram: ["site:business.instagram.com", "site:creators.instagram.com", "site:help.instagram.com"],
  facebook: ["site:facebook.com/business", "site:about.fb.com", "site:transparency.meta.com"],
  soundcloud: ["site:soundcloud.com/blog", "site:help.soundcloud.com"],
  beatport: ["site:support.beatport.com", "site:beatportal.com"],
  twitch: ["site:blog.twitch.tv", "site:help.twitch.tv", "site:safety.twitch.tv"],
  growth: ["site:shopify.com/blog", "site:datareportal.com", "site:pewresearch.org"],
};

function buildOfficialSourceQuery(topic: string, category: string): string {
  const sites = PLATFORM_OFFICIAL_SITES[category.trim().toLowerCase()];
  // Unknown platforms get a generic official-sources query instead of a
  // site: restriction — falling back to Growth sites (Shopify/Pew) would
  // inject irrelevant sources for e.g. Beatport-adjacent niches.
  if (!sites) {
    return `${topic} ${category} official help center guide documentation`;
  }
  return `${sites.join(" OR ")} ${topic} ${category} guide`;
}

function dedupeSources<T extends { url: string }>(sources: T[]): T[] {
  return Array.from(new Map(sources.map(source => [source.url, source])).values());
}

function buildFallbackTopic(request: AutomationGenerateRequest): string {
  return `How to grow on ${request.category} in the ${request.niche} niche`;
}

function buildTopicBrief(request: AutomationGenerateRequest, topic: string): string {
  const lines = [
    topic,
    "Use the exact article title as given — do not rewrite, shorten, or 'improve' it. It is a deliberate keyword-loaded hook.",
    `Write for readers who want practical ${request.category} growth advice.`,
    buildLanguageOrthographyInstruction(request.language),
  ];
  if (request.brand) {
    lines.push(
      `Mention the brand "${request.brand}" naturally 2-3 times across the article. Treat "${request.brand}" as an immutable token: reproduce it byte-for-byte, never insert spaces, change capitalization, translate it, decline it, or segment its CamelCase spelling.`
    );
  }
  if (request.anchor) {
    lines.push(`Include exactly one natural mention of ${request.anchor}.`);
  } else if (!request.brand) {
    lines.push("Do not mention any client brand or commercial anchor.");
  }
  lines.push(
    "Avoid competitors, SMM panels, bought-follower services, fake engagement claims, and placeholder related-read sections.",
    "External citation anchors must be 1-4 words — the resource's name (e.g. Billboard, YouTube Help, Pew Research Center), never a clause. Do not repeat the resource name immediately before its link.",
    "Any ranking, market-size, or top-N claim must carry an explicit as-of date and be backed by one of the provided sources. If a claim cannot be sourced, explain the mechanism instead of inventing numbers or leaderboards."
  );
  if (request.brief) {
    lines.push(request.brief);
  }
  return lines.join("\n");
}

export function buildLanguageOrthographyInstruction(language: string): string {
  const canonical = language.trim().toLowerCase();
  const rules: Record<string, string> = {
    italian: "Write standard Italian orthography with native diacritics. Use è, é, à, ì, ò, and ù where required; never substitute apostrophe spellings such as e', piu', perche', puo', gia', or probabilita'.",
    spanish: "Write standard Spanish orthography with all required accents, diacritics, and ñ; never replace them with ASCII approximations.",
    portuguese: "Write standard Portuguese orthography with all required accents, diacritics, and ç; never replace them with ASCII approximations.",
    french: "Write standard French orthography with all required accents, diacritics, ligatures, and ç; never replace them with ASCII approximations.",
    german: "Write standard German orthography with ä, ö, ü, and ß where required; never replace them with ae/oe/ue/ss unless the lexical form specifically requires it.",
    polish: "Write standard Polish orthography with all required diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż); never replace them with ASCII approximations.",
  };
  return rules[canonical] || `Write in standard ${language} orthography and preserve every native letter and diacritic required by that language.`;
}

function sanitizeAutomationHtml(html: string): string {
  let output = html || "";
  output = output.replace(/<!doctype[\s\S]*?>/gi, "");
  output = output.replace(/<\/?(html|head|body)[^>]*>/gi, "");
  output = output.replace(/<script[\s\S]*?<\/script>/gi, "");
  output = output.replace(/<style[\s\S]*?<\/style>/gi, "");
  output = output.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "");
  output = output.replace(/\sstyle=(["'])[\s\S]*?\1/gi, "");
  output = output.replace(/\son\w+=(["'])[\s\S]*?\1/gi, "");
  output = output.replace(/<p>\s*(related reads?|further reading|you may also like)[\s\S]*?<\/p>/gi, "");
  output = output.replace(/\s+([,.;:!?])/g, "$1");
  output = output.replace(/>\s+</g, "><");
  return output.trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function summarizeText(html: string, maxLength: number): string {
  const text = stripTags(html).trim();
  return truncateText(text, maxLength);
}

function cleanDescription(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateText(text: string, maxLength: number): string {
  const clean = cleanDescription(text);
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, Math.max(0, maxLength - 1));
  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, lastSpace > 40 ? lastSpace : sliced.length).trim()}...`;
}

function estimateReadTime(html: string): number {
  const words = stripTags(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
