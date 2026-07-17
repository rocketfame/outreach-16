import { POST as generateArticleRoute } from "@/app/api/articles/route";
import { POST as generateImageRoute } from "@/app/api/article-image/route";
import { getCostTracker } from "@/lib/costTracker";
import { searchReliableSources } from "@/lib/tavilyClient";
import { filterSourcesByPolicy, getSourcePriority, isVideoUrl } from "@/lib/sourcePolicy";
import { normalizeGoogleSupportLocale, stripDisallowedLinks } from "@/lib/automation/linkGuard";
import { IMAGE_BOX_PROMPTS } from "@/lib/imageBoxPrompts";
import { INTERNAL_CALL_HEADER, INTERNAL_CALL_TOKEN } from "@/lib/automation/internal";
import type {
  AutomationArticle,
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
): Promise<{ title: string; contentHtml: string; metaDescription: string }> {
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
  const title = stripTags(generated.titleTag || topic).trim();
  const rawHtml = generated.articleBodyHtml || generated.fullArticleText || "";
  let contentHtml = sanitizeAutomationHtml(rawHtml);
  contentHtml = stripDisallowedLinks(contentHtml, request.anchorUrl);
  // Enforce the single ANCHOR mention only when the anchor text is not the
  // brand itself — brand mentions (2-3x) must survive.
  const anchorIsBrand =
    request.brand && request.anchor.toLowerCase().includes(request.brand.toLowerCase());
  if (request.anchor && !anchorIsBrand) {
    contentHtml = enforceSingleBrandMention(contentHtml, request.anchor);
  }
  return { title, contentHtml, metaDescription: generated.metaDescription || "" };
}

function countWords(html: string): number {
  return stripTags(html).split(/\s+/).filter(Boolean).length;
}

export async function runAutomationGeneration(
  generationId: string,
  request: AutomationGenerateRequest
): Promise<AutomationGenerateSuccess> {
  const costBefore = getCostTracker().getTotalCosts().total;
  const topic = request.topic || buildFallbackTopic(request);
  const minWords = request.minWords || 1200;
  const targetWords = Math.round((minWords + (request.maxWords || 1800)) / 2);

  const sources = await searchAutomationTrustSources(topic, request.category);
  const trustSourcesList = filterSourcesByPolicy(sources)
    .sort((a, b) => getSourcePriority(b) - getSourcePriority(a))
    .slice(0, 6)
    .map((source) => `${source.title}|${source.url}|${source.snippet}`);

  if (trustSourcesList.length === 0) {
    console.warn("[automationPipeline] No policy-approved trust sources found; continuing without external links.");
  }

  // minWords is a floor, not a hint: one retry with a boosted target and an
  // explicit floor instruction, then an honest error. A 245-word stub with
  // status "done" is the same class of bug as masked insufficient_quota.
  let article = await generateArticleOnce(request, topic, trustSourcesList, targetWords, "");
  let wordCount = countWords(article.contentHtml);
  if (wordCount < minWords) {
    console.warn(`[automationPipeline] Draft is ${wordCount} words (< floor ${minWords}); retrying with boosted target.`);
    const boostedTarget = Math.max(targetWords, Math.round(minWords * 1.3));
    article = await generateArticleOnce(
      request,
      topic,
      trustSourcesList,
      boostedTarget,
      `The article MUST contain at least ${minWords} words of substantive content. Do not pad with filler — add concrete examples, steps, and specifics instead.`
    );
    wordCount = countWords(article.contentHtml);
  }
  if (wordCount < minWords) {
    throw new AutomationPipelineError(
      "below_min_words",
      `Generated article has ${wordCount} words after retry; the floor is ${minWords}. Likely too little research material for this niche+category pair — try a more specific niche (e.g. "Electronic music industry" instead of "Music industry") or lower minWords.`
    );
  }

  const { title, contentHtml } = article;
  const seoDescription = cleanDescription(article.metaDescription || summarizeText(contentHtml, 155));
  const seoTitle = truncateText(title, 60);

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
    "Avoid competitors, SMM panels, bought-follower services, fake engagement claims, and placeholder related-read sections."
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

function enforceSingleBrandMention(html: string, brand: string): string {
  const escaped = escapeRegExp(brand.trim());
  const brandRegex = new RegExp(escaped, "gi");
  const visibleText = stripTags(html);
  const matches = [...visibleText.matchAll(brandRegex)];
  if (matches.length === 1) return html;

  if (matches.length === 0) {
    if (/<p[^>]*>/i.test(html)) {
      return html.replace(/<p[^>]*>/i, (tag) => `${tag}${brand} can be a useful starting point when you need a simple visibility baseline. `);
    }
    return `<p>${brand} can be a useful starting point when you need a simple visibility baseline.</p>${html}`;
  }

  let seen = 0;
  return html.replace(/(^|>)([^<]+)(?=<|$)/g, (full, prefix: string, text: string) => {
    const updated = text.replace(brandRegex, (match) => {
      seen += 1;
      return seen === 1 ? match : "the platform";
    });
    return `${prefix}${updated}`;
  });
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
