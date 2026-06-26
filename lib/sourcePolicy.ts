import type { RawSearchResult, SourceType } from "@/lib/sourceClassifier";

const OFFICIAL_PLATFORM_DOMAINS = [
  "artists.spotify.com",
  "newsroom.spotify.com",
  "spotify.com",
  "support.google.com",
  "blog.youtube",
  "youtube.com",
  "creators.youtube",
  "tiktok.com",
  "newsroom.tiktok.com",
  "support.tiktok.com",
  "business.tiktok.com",
  "facebook.com",
  "about.fb.com",
  "transparency.meta.com",
  "business.instagram.com",
  "creators.instagram.com",
  "help.instagram.com",
  "instagram.com",
  "soundcloud.com",
  "help.soundcloud.com",
  "shopify.com",
];

const RESEARCH_DOMAINS = [
  "datareportal.com",
  "pewresearch.org",
  "statista.com",
  "insiderintelligence.com",
  "emarketer.com",
  "oberlo.com",
  "explodingtopics.com",
  "musicbusinessworldwide.com",
  "ifpi.org",
  "riaa.com",
  "midiaresearch.com",
  "luminate.xyz",
];

const TRUSTED_MEDIA_DOMAINS = [
  "billboard.com",
  "rollingstone.com",
  "theverge.com",
  "wired.com",
  "techcrunch.com",
  "socialmediatoday.com",
];

const COMMERCIAL_PROMO_PATTERNS = [
  /\bbuy\s+(?:followers|likes|views|subscribers|streams|plays|comments|shares)\b/i,
  /\bfree\s+(?:followers|likes|views|subscribers|streams|plays)\b/i,
  /\b(?:get|gain|boost)\s+(?:real\s+)?(?:followers|likes|views|subscribers|streams|plays)\b/i,
  /\bsmm\s*panel\b/i,
  /\bsocial\s+media\s+growth\s+(?:service|agency|platform)\b/i,
  /\b(?:instagram|tiktok|youtube|facebook|spotify|soundcloud)\s+(?:growth|promotion|marketing)\s+(?:service|agency|package|packages|platform)\b/i,
  /\bplaylist\s+(?:pitching|promotion|placement)\s+(?:service|agency|package|packages)\b/i,
  /\bmusic\s+promotion\s+(?:service|agency|package|packages|platform)\b/i,
  /\bpromo\s+(?:package|packages|service|services)\b/i,
  /\bfake\s+(?:engagement|followers|streams|plays|views|likes)\b/i,
  /\bbot\s+(?:streams|plays|followers|views|traffic)\b/i,
  /\bpricing\b.*\b(?:followers|likes|views|streams|plays|promotion|package)\b/i,
];

const COMMERCIAL_DOMAIN_PARTS = [
  "smm",
  "panel",
  "followers",
  "likes",
  "views",
  "buy",
  "boost",
  "growth",
  "promo",
  "promotion",
];

export type SourcePolicyDecision = {
  allowed: boolean;
  reason: string;
  forcedType?: Extract<SourceType, "official_platform" | "stats_or_research" | "independent_media" | "video">;
  priority: number;
};

export function getSourcePolicyDecision(source: Pick<RawSearchResult, "url" | "title" | "snippet" | "content_preview">): SourcePolicyDecision {
  const hostname = getHostname(source.url);
  const combined = [
    source.url,
    source.title,
    source.snippet || "",
    source.content_preview || "",
  ].join(" ").toLowerCase();

  const isOfficial = matchesDomain(hostname, OFFICIAL_PLATFORM_DOMAINS);
  const isResearch = matchesDomain(hostname, RESEARCH_DOMAINS);
  const isTrustedMedia = matchesDomain(hostname, TRUSTED_MEDIA_DOMAINS);
  const isVideo = isVideoUrl(source.url);

  if (!isOfficial && !isResearch && !isTrustedMedia) {
    if (COMMERCIAL_PROMO_PATTERNS.some((pattern) => pattern.test(combined))) {
      return { allowed: false, reason: "commercial_promo_pattern", priority: -100 };
    }

    if (COMMERCIAL_DOMAIN_PARTS.some((part) => hostname.includes(part))) {
      return { allowed: false, reason: "commercial_domain_pattern", priority: -100 };
    }
  }

  if (isOfficial) {
    return {
      allowed: true,
      reason: "official_platform_domain",
      forcedType: isVideo ? "video" : "official_platform",
      priority: isVideo ? 25 : 100,
    };
  }

  if (isResearch) {
    return { allowed: true, reason: "research_domain", forcedType: "stats_or_research", priority: 80 };
  }

  if (isTrustedMedia) {
    return { allowed: true, reason: "trusted_media_domain", forcedType: "independent_media", priority: 55 };
  }

  if (isVideo) {
    return { allowed: true, reason: "video_source", forcedType: "video", priority: 10 };
  }

  return { allowed: true, reason: "unclassified_non_commercial", priority: 20 };
}

export function filterSourcesByPolicy<T extends Pick<RawSearchResult, "url" | "title" | "snippet" | "content_preview">>(sources: T[]): T[] {
  return sources.filter((source) => getSourcePolicyDecision(source).allowed);
}

export function isCommercialOrCompetitorSource(source: Pick<RawSearchResult, "url" | "title" | "snippet" | "content_preview">): boolean {
  return !getSourcePolicyDecision(source).allowed;
}

export function getForcedSourceType(source: Pick<RawSearchResult, "url" | "title" | "snippet" | "content_preview">): SourcePolicyDecision["forcedType"] {
  return getSourcePolicyDecision(source).forcedType;
}

export function getSourcePriority(source: Pick<RawSearchResult, "url" | "title" | "snippet" | "content_preview">): number {
  return getSourcePolicyDecision(source).priority;
}

export function isVideoUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|twitch\.tv\/|dailymotion\.com\//i.test(url);
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function matchesDomain(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
