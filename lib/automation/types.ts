/**
 * Categories with dedicated official-source search mappings in the pipeline
 * (see buildOfficialSourceQuery). The automation API accepts ANY free-text
 * category — this list is NOT a validator, it only documents which platforms
 * get curated `site:` queries for trust sources. Keep the seven legacy
 * Free-Followers autopilot values (Instagram, TikTok, YouTube, Facebook,
 * SoundCloud, Spotify, Growth) working forever.
 */
export const KNOWN_AUTOMATION_CATEGORIES = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "SoundCloud",
  "Spotify",
  "Growth",
  "Beatport",
  "Twitch",
] as const;

export type AutomationMode = "human" | "standard";
export type AutomationJobStatus = "queued" | "running" | "done" | "error";

/** Raw request body accepted by POST /api/automation/generate. */
export interface AutomationGenerateInput {
  topic?: string | null;
  niche: string;
  /** Free text. Optional — derived from niche platform presets when omitted. */
  category?: string;
  anchor?: string;
  anchorUrl?: string;
  /**
   * Brand NAME as plain text (e.g. "PromoSoundGroup"), never a URL or bare
   * domain — domains get mangled by the humanizer and read as spam.
   */
  brand?: string;
  /** Free-text instructions appended to the generated topic brief. */
  brief?: string;
  /** Optional — defaults to "human". */
  mode?: AutomationMode;
  /** Full name ("Spanish") or ISO code ("es"). Optional — defaults to "English". */
  language?: string;
  image?: boolean;
  /** Pin a specific image box preset by id (see lib/imageBoxPrompts.ts). */
  imageStyle?: string;
  /** Preset ids to exclude — lets a batch caller guarantee distinct covers. */
  excludeImageStyles?: string[];
  /** gpt-image-2 quality tier: ~$0.20 high / ~$0.05 medium / ~$0.013 low per cover. */
  imageQuality?: "low" | "medium" | "high";
  minWords?: number;
  maxWords?: number;
  /** Max length for the generated seoTitle (Title tag). Default 65. */
  seoTitleMaxChars?: number;
}

/** Normalized request after validation — all defaults resolved. */
export interface AutomationGenerateRequest {
  topic: string | null;
  niche: string;
  category: string;
  anchor: string;
  anchorUrl: string;
  brand: string;
  brief: string;
  mode: AutomationMode;
  /** Canonical supported language name, e.g. "Spanish". */
  language: string;
  image: boolean;
  imageStyle: string;
  excludeImageStyles: string[];
  /** Empty string = route default (HERO_IMAGE_QUALITY env or "high"). */
  imageQuality: string;
  imageRatio: "16:9";
  minWords: number;
  maxWords: number;
  seoTitleMaxChars: number;
}

export interface AutomationArticle {
  title: string;
  slug?: string;
  category: string;
  seoTitle: string;
  excerpt: string;
  seoDescription: string;
  readTimeMinutes: number;
  contentHtml: string;
  cover?: {
    base64: string;
    format: "png";
    alt: string;
  };
}

export interface AutomationGenerateSuccess {
  status: "ok";
  generationId: string;
  article: AutomationArticle;
  meta: {
    model: string;
    humanized: boolean;
    /** Resolved article language, echoed so callers can assert on it. */
    language: string;
    /** Word count of the final body — callers can assert against minWords. */
    wordCount: number;
    /** Image box preset id used for the cover — assert on it, don't eyeball. */
    imageStyle?: string;
    costUsd: number;
  };
}

export interface AutomationJob {
  id: string;
  status: AutomationJobStatus;
  request: AutomationGenerateRequest;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: AutomationGenerateSuccess;
  error?: {
    code: string;
    message: string;
  };
}

export interface AutomationErrorResponse {
  status: "error";
  code: string;
  message: string;
  /** Machine-readable list of accepted values for the offending field. */
  allowed?: readonly string[];
  /** Name of the request field that failed validation. */
  field?: string;
}

/** Queue placement info returned for queued jobs (submit + polling). */
export interface AutomationQueueInfo {
  /** 1 = next to run. Counts currently running jobs ahead of this one. */
  position: number;
  /** Rough estimate until this job starts, based on average job duration. */
  etaSeconds: number;
}
