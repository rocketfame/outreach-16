import { POST as generateArticleRoute } from "@/app/api/articles/route";
import { POST as generateImageRoute } from "@/app/api/article-image/route";
import { getCostTracker } from "@/lib/costTracker";
import { searchReliableSources } from "@/lib/tavilyClient";
import { filterSourcesByPolicy, getSourcePolicyDecision, getSourcePriority, isVideoUrl } from "@/lib/sourcePolicy";
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
  }>;
  error?: string;
};

type InternalImageResponse = {
  success: boolean;
  imageBase64?: string;
  selectedBoxId?: string;
  error?: string;
};

async function generateArticleOnce(
  request: AutomationGenerateRequest,
  topic: string,
  trustSourcesList: string[],
  targetWords: number,
  extraInstruction: string
): Promise<{ generatedTitleTag: string; contentHtml: string; metaDescription: string }> {
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
    throw new Error(articleJson.error || "Article generation failed.");
  }

  const generated = articleJson.articles[0];
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
  return { generatedTitleTag, contentHtml, metaDescription: generated.metaDescription || "" };
}

function countWords(html: string): number {
  return stripTags(html).split(/\s+/).filter(Boolean).length;
}

/** Draft defects that warrant a retry and, if persistent, an honest error. */
function collectDraftFailures(
  request: AutomationGenerateRequest,
  contentHtml: string,
  minWords: number
): Array<{ code: string; message: string }> {
  const failures: Array<{ code: string; message: string }> = [];
  const wordCount = countWords(contentHtml);
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
    ].filter(Boolean).join("\n");
    article = await generateArticleOnce(request, topic, trustSourcesList, boostedTarget, corrective);
    failures = collectDraftFailures(request, article.contentHtml, minWords);
  }
  if (failures.length > 0) {
    const first = failures[0];
    throw new AutomationPipelineError(first.code, `${first.message} (after retry)`);
  }
  const wordCount = countWords(article.contentHtml);

  const { contentHtml } = article;
  // The given topic is a deliberate keyword-loaded hook — it IS the H1,
  // verbatim. The engine's own titleTag only serves as the shortened Title
  // tag (seoTitle), never as a replacement for the hook.
  const title = request.topic ? request.topic.trim() : article.generatedTitleTag;
  const seoTitle = truncateText(article.generatedTitleTag || title, request.seoTitleMaxChars || 65);
  const seoDescription = cleanDescription(article.metaDescription || summarizeText(contentHtml, 155));

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
      }),
    }));
    const imageJson = (await imageResponse.json()) as InternalImageResponse;
    if (!imageResponse.ok || !imageJson.success || !imageJson.imageBase64) {
      throw new Error(imageJson.error || "Cover image generation failed.");
    }
    imageStyleUsed = imageJson.selectedBoxId;
    cover = {
      base64: imageJson.imageBase64,
      format: "png",
      alt: `${title} hero image`,
    };
  }

  const costAfter = getCostTracker().getTotalCosts().total;

  return {
    status: "ok",
    generationId,
    article: {
      title,
      slug: slugify(title),
      category: request.category,
      seoTitle,
      excerpt: cleanDescription(summarizeText(contentHtml, 158)),
      seoDescription,
      readTimeMinutes: estimateReadTime(contentHtml),
      contentHtml,
      cover,
    },
    meta: {
      model: "gpt-5.5",
      humanized: request.mode === "human",
      language: request.language || "English",
      wordCount,
      imageStyle: imageStyleUsed,
      imageFamily: familyOfBox(imageStyleUsed),
      costUsd: Math.max(0, Number((costAfter - costBefore).toFixed(6))),
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
    }),
  }));

  const imageJson = (await imageResponse.json()) as InternalImageResponse;
  if (!imageResponse.ok || !imageJson.success || !imageJson.imageBase64) {
    throw new Error(imageJson.error || "Cover image generation failed.");
  }

  const costAfter = getCostTracker().getTotalCosts().total;
  return {
    status: "ok",
    generationId,
    cover: {
      base64: imageJson.imageBase64,
      format: "png",
      alt: `${request.topic} hero image`,
    },
    meta: {
      imageStyle: imageJson.selectedBoxId,
      imageFamily: familyOfBox(imageJson.selectedBoxId),
      costUsd: Math.max(0, Number((costAfter - costBefore).toFixed(6))),
    },
  };
}

async function searchAutomationTrustSources(topic: string, category: string) {
  const officialQuery = buildOfficialSourceQuery(topic, category);
  const researchQuery = `${topic} ${category} statistics report industry data`;

  const resultSets = await Promise.all([
    searchReliableSources(officialQuery),
    searchReliableSources(researchQuery),
  ]);

  const merged = dedupeSources(resultSets.flat()).map((source) => ({
    ...source,
    url: normalizeGoogleSupportLocale(source.url),
  }));

  return filterSourcesByPolicy(merged).filter((source) => {
    // Videos are never citations in outreach articles — host editors reject them.
    if (isVideoUrl(source.url)) return false;
    // Shopify content is an official source ONLY for the Growth category;
    // in a TikTok/Spotify article it reads as a third-party commercial blog.
    if (category.trim().toLowerCase() !== "growth" && /(^|\.)shopify\.com$/i.test(hostnameOf(source.url))) {
      return false;
    }
    return true;
  });
}

/** Targeted tier-2/3 search when the general sweep yields no independent sources. */
const INDEPENDENT_SOURCE_SITES = [
  "site:billboard.com",
  "site:musicbusinessworldwide.com",
  "site:pewresearch.org",
  "site:midiaresearch.com",
  "site:ifpi.org",
  "site:soundcharts.com",
  "site:chartmasters.org",
  "site:streamscharts.com",
  "site:twitchtracker.com",
  "site:datareportal.com",
];

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
  const sources = await searchAutomationTrustSources(topic, category);
  let candidates: ScoredSource[] = filterSourcesByPolicy(sources)
    .sort((a, b) => getSourcePriority(b) - getSourcePriority(a));

  let independents = candidates.filter((s) => isIndependentSource(s.url));
  if (independents.length === 0) {
    const extra = await searchReliableSources(
      `${INDEPENDENT_SOURCE_SITES.join(" OR ")} ${topic} ${category} report data`
    );
    const extraApproved = filterSourcesByPolicy(dedupeSources(extra)).filter((s) => isIndependentSource(s.url));
    independents = extraApproved;
    candidates = dedupeSources([...candidates, ...extraApproved]);
  }

  const platformDocs = candidates.filter((s) => isPlatformDocSource(s.url)).slice(0, 2);
  const nonPlatform = candidates.filter((s) => !isPlatformDocSource(s.url));
  const composed = dedupeSources([...independents.slice(0, 3), ...platformDocs, ...nonPlatform]).slice(0, 6);

  // Dead links get dropped before they can be cited.
  const resolutions = await Promise.all(composed.map((s) => urlResolves(s.url)));
  const alive = composed.filter((_, i) => resolutions[i]);

  if (!alive.some((s) => isIndependentSource(s.url))) {
    throw new AutomationPipelineError(
      "no_independent_sources",
      `No live independent (non-platform) source found for "${topic}" (${category}). An article citing only the platform's own docs does not ship — narrow the topic or retry later.`
    );
  }

  return alive.map((s) => `${displayNameForUrl(s.url)}|${s.url}|${s.snippet || ""}`);
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
  ];
  if (request.brand) {
    lines.push(
      `Mention the brand "${request.brand}" naturally 2-3 times across the article, always as the plain name — never as a URL, domain, or link.`
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
