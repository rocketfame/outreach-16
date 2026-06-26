import { POST as generateArticleRoute } from "@/app/api/articles/route";
import { POST as generateImageRoute } from "@/app/api/article-image/route";
import { getCostTracker } from "@/lib/costTracker";
import { searchReliableSources } from "@/lib/tavilyClient";
import { filterSourcesByPolicy, getSourcePriority } from "@/lib/sourcePolicy";
import {
  AUTOMATION_CATEGORIES,
  type AutomationArticle,
  type AutomationGenerateRequest,
  type AutomationGenerateSuccess,
} from "@/lib/automation/types";

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
  error?: string;
};

export function validateAutomationRequest(input: unknown): AutomationGenerateRequest {
  const body = input as Partial<AutomationGenerateRequest> | null;
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const niche = typeof body.niche === "string" ? body.niche.trim() : "";
  const category = body.category;
  const anchor = typeof body.anchor === "string" ? body.anchor.trim() : "";
  const anchorUrl = typeof body.anchorUrl === "string" ? body.anchorUrl.trim() : "";
  const mode = body.mode;

  if (!niche) throw new Error("Missing required field: niche.");
  if (!category || !AUTOMATION_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category. Expected one of: ${AUTOMATION_CATEGORIES.join(", ")}.`);
  }
  if ((anchor && !anchorUrl) || (!anchor && anchorUrl)) {
    throw new Error("anchor and anchorUrl must be provided together, or both omitted.");
  }
  if (anchorUrl && !/^https?:\/\//i.test(anchorUrl)) {
    throw new Error("Invalid field: anchorUrl must be an absolute http(s) URL.");
  }
  if (mode !== "human" && mode !== "standard") {
    throw new Error('Invalid mode. Expected "human" or "standard".');
  }

  const minWords = Number.isFinite(body.minWords) ? Number(body.minWords) : 1200;
  const maxWords = Number.isFinite(body.maxWords) ? Number(body.maxWords) : 1800;
  if (minWords < 500 || maxWords < minWords || maxWords > 3000) {
    throw new Error("Invalid minWords/maxWords range. Use 500-3000 words and maxWords >= minWords.");
  }

  return {
    topic: typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : null,
    niche,
    category,
    anchor,
    anchorUrl,
    mode,
    image: body.image !== false,
    imageRatio: "16:9",
    minWords,
    maxWords,
  };
}

export async function runAutomationGeneration(
  generationId: string,
  request: AutomationGenerateRequest
): Promise<AutomationGenerateSuccess> {
  const costBefore = getCostTracker().getTotalCosts().total;
  const topic = request.topic || buildFallbackTopic(request);
  const targetWords = Math.round(((request.minWords || 1200) + (request.maxWords || 1800)) / 2);

  const sources = await searchAutomationTrustSources(topic, request.category);
  const trustSourcesList = filterSourcesByPolicy(sources)
    .sort((a, b) => getSourcePriority(b) - getSourcePriority(a))
    .slice(0, 6)
    .map((source) => `${source.title}|${source.url}|${source.snippet}`);

  if (trustSourcesList.length === 0) {
    throw new Error("No trusted sources found for automation article generation.");
  }

  const articleResponse = await generateArticleRoute(new Request("https://automation.local/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "automation",
    },
    body: JSON.stringify({
      brief: {
        niche: request.niche,
        platform: request.category,
        contentPurpose: "Guest post / outreach",
        clientSite: request.anchorUrl || "",
        anchorText: request.anchor || "",
        anchorUrl: request.anchorUrl || "",
        language: "English",
        wordCount: String(targetWords),
      },
      selectedTopics: [
        {
          title: topic,
          brief: buildTopicBrief(request, topic),
        },
      ],
      trustSourcesList,
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
  const sanitizedHtml = sanitizeAutomationHtml(rawHtml);
  const contentHtml = request.anchor
    ? enforceSingleBrandMention(sanitizedHtml, request.anchor)
    : sanitizedHtml;
  const seoDescription = cleanDescription(generated.metaDescription || summarizeText(contentHtml, 155));
  const seoTitle = truncateText(title, 60);

  let cover: AutomationArticle["cover"];
  if (request.image !== false) {
    const imageResponse = await generateImageRoute(new Request("https://automation.local/api/article-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "automation",
      },
      body: JSON.stringify({
        articleTitle: title,
        niche: request.niche,
        mainPlatform: request.category,
        contentPurpose: "Guest post / outreach",
        brandName: request.anchor || "",
        usedBoxIndices: [],
      }),
    }));
    const imageJson = (await imageResponse.json()) as InternalImageResponse;
    if (!imageResponse.ok || !imageJson.success || !imageJson.imageBase64) {
      throw new Error(imageJson.error || "Cover image generation failed.");
    }
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
      costUsd: Math.max(0, Number((costAfter - costBefore).toFixed(6))),
    },
  };
}

async function searchAutomationTrustSources(topic: string, category: string) {
  const officialQuery = buildOfficialSourceQuery(topic, category);
  const researchQuery = `${topic} ${category} statistics report industry data`;
  const videoQuery = `site:youtube.com/watch ${topic} ${category} official creator`;

  const resultSets = await Promise.all([
    searchReliableSources(officialQuery),
    searchReliableSources(researchQuery),
  ]);

  const merged = dedupeSources(resultSets.flat());
  const policyApproved = filterSourcesByPolicy(merged);
  const nonVideo = policyApproved.filter(source => !/youtube\.com\/watch|youtu\.be\/|vimeo\.com\//i.test(source.url));

  if (nonVideo.length >= 3) {
    return policyApproved;
  }

  const videoSources = await searchReliableSources(videoQuery);
  return dedupeSources([...policyApproved, ...filterSourcesByPolicy(videoSources)]);
}

function buildOfficialSourceQuery(topic: string, category: string): string {
  const platformSites: Record<string, string[]> = {
    Spotify: ["site:artists.spotify.com", "site:newsroom.spotify.com"],
    YouTube: ["site:support.google.com/youtube", "site:blog.youtube", "site:youtube.com/creators"],
    TikTok: ["site:tiktok.com/business", "site:newsroom.tiktok.com", "site:support.tiktok.com"],
    Instagram: ["site:business.instagram.com", "site:creators.instagram.com", "site:help.instagram.com"],
    Facebook: ["site:facebook.com/business", "site:about.fb.com", "site:transparency.meta.com"],
    SoundCloud: ["site:soundcloud.com/blog", "site:help.soundcloud.com"],
    Growth: ["site:shopify.com/blog", "site:datareportal.com", "site:pewresearch.org"],
  };
  const sites = platformSites[category] || platformSites.Growth;
  return `${sites.join(" OR ")} ${topic} ${category} guide`;
}

function dedupeSources<T extends { url: string }>(sources: T[]): T[] {
  return Array.from(new Map(sources.map(source => [source.url, source])).values());
}

function buildFallbackTopic(request: AutomationGenerateRequest): string {
  return `How to grow on ${request.category} in the ${request.niche} niche`;
}

function buildTopicBrief(request: AutomationGenerateRequest, topic: string): string {
  return [
    topic,
    request.anchor
      ? `Write for ${request.anchor} blog readers who want practical ${request.category} growth advice.`
      : `Write for readers who want practical ${request.category} growth advice.`,
    request.anchor ? `Include exactly one natural mention of ${request.anchor}.` : "Do not mention any client brand or commercial anchor.",
    "Avoid competitors, SMM panels, bought-follower services, fake engagement claims, and placeholder related-read sections.",
  ].join("\n");
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
