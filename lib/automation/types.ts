export const AUTOMATION_CATEGORIES = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "SoundCloud",
  "Spotify",
  "Growth",
] as const;

export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number];

export type AutomationMode = "human" | "standard";
export type AutomationJobStatus = "queued" | "running" | "done" | "error";

export interface AutomationGenerateRequest {
  topic?: string | null;
  niche: string;
  category: AutomationCategory;
  anchor: string;
  anchorUrl: string;
  mode: AutomationMode;
  image?: boolean;
  imageRatio?: "16:9";
  minWords?: number;
  maxWords?: number;
}

export interface AutomationArticle {
  title: string;
  slug?: string;
  category: AutomationCategory;
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
}
