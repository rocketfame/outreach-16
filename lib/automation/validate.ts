import { NICHE_TO_PRESET_KEY, PLATFORM_PRESETS } from "@/config/platformPresets";
import { SUPPORTED_LANGUAGES, resolveLanguage } from "@/config/languages";
import type { AutomationGenerateInput, AutomationGenerateRequest } from "@/lib/automation/types";

export class AutomationValidationError extends Error {
  readonly field?: string;
  readonly allowed?: readonly string[];

  constructor(message: string, options?: { field?: string; allowed?: readonly string[] }) {
    super(message);
    this.name = "AutomationValidationError";
    this.field = options?.field;
    this.allowed = options?.allowed;
  }
}

const MAX_CATEGORY_LENGTH = 60;

/**
 * When category is omitted, take the first platform preset for the niche —
 * the same presets the UI suggests (config/platformPresets.ts). Niche labels
 * are matched case-insensitively. Returns null for niches without presets.
 */
function deriveCategoryFromNiche(niche: string): string | null {
  const lower = niche.trim().toLowerCase();
  const presetKey = Object.entries(NICHE_TO_PRESET_KEY).find(
    ([label]) => label.toLowerCase() === lower
  )?.[1];
  if (!presetKey) return null;
  return PLATFORM_PRESETS[presetKey]?.[0] ?? null;
}

export function validateAutomationRequest(input: unknown): AutomationGenerateRequest {
  const body = input as Partial<AutomationGenerateInput> | null;
  if (!body || typeof body !== "object") {
    throw new AutomationValidationError("Request body must be a JSON object.");
  }

  const niche = typeof body.niche === "string" ? body.niche.trim() : "";
  const anchor = typeof body.anchor === "string" ? body.anchor.trim() : "";
  const anchorUrl = typeof body.anchorUrl === "string" ? body.anchorUrl.trim() : "";

  if (!niche) {
    throw new AutomationValidationError("Missing required field: niche.", { field: "niche" });
  }

  // Category is free text. Any platform the engine can write about is valid;
  // known platforms additionally get curated official-source queries.
  let category = typeof body.category === "string" ? body.category.trim() : "";
  if (body.category !== undefined && body.category !== null && typeof body.category !== "string") {
    throw new AutomationValidationError("Invalid category. Expected a string.", { field: "category" });
  }
  if (category.length > MAX_CATEGORY_LENGTH) {
    throw new AutomationValidationError(
      `Invalid category. Maximum length is ${MAX_CATEGORY_LENGTH} characters.`,
      { field: "category" }
    );
  }
  if (!category) {
    const derived = deriveCategoryFromNiche(niche);
    if (!derived) {
      throw new AutomationValidationError(
        `Missing category and niche "${niche}" has no platform presets to derive it from. Provide a category explicitly.`,
        { field: "category" }
      );
    }
    category = derived;
  }

  if ((anchor && !anchorUrl) || (!anchor && anchorUrl)) {
    throw new AutomationValidationError(
      "anchor and anchorUrl must be provided together, or both omitted.",
      { field: "anchor" }
    );
  }
  if (anchorUrl && !/^https?:\/\//i.test(anchorUrl)) {
    throw new AutomationValidationError(
      "Invalid field: anchorUrl must be an absolute http(s) URL.",
      { field: "anchorUrl" }
    );
  }

  // Brand must be a plain NAME. A URL or bare domain here ends up in body
  // copy as "Brand.tld", which the humanizer mangles into orphaned "tld".
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  if (body.brand !== undefined && body.brand !== null && typeof body.brand !== "string") {
    throw new AutomationValidationError("Invalid brand. Expected a string.", { field: "brand" });
  }
  if (brand.length > 80) {
    throw new AutomationValidationError("Invalid brand. Maximum length is 80 characters.", {
      field: "brand",
    });
  }
  if (brand && (/^https?:\/\//i.test(brand) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(brand))) {
    throw new AutomationValidationError(
      `Invalid brand "${brand}". Provide the brand NAME as plain text (e.g. "PromoSoundGroup"), not a URL or domain — pass the site via anchorUrl instead.`,
      { field: "brand" }
    );
  }

  const customBrief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (body.brief !== undefined && body.brief !== null && typeof body.brief !== "string") {
    throw new AutomationValidationError("Invalid brief. Expected a string.", { field: "brief" });
  }
  if (customBrief.length > 2000) {
    throw new AutomationValidationError("Invalid brief. Maximum length is 2000 characters.", {
      field: "brief",
    });
  }

  const mode = body.mode === undefined || body.mode === null ? "human" : body.mode;
  if (mode !== "human" && mode !== "standard") {
    throw new AutomationValidationError('Invalid mode. Expected "human" or "standard".', {
      field: "mode",
      allowed: ["human", "standard"],
    });
  }

  let language = "English";
  if (body.language !== undefined && body.language !== null) {
    if (typeof body.language !== "string") {
      throw new AutomationValidationError("Invalid language. Expected a string.", {
        field: "language",
        allowed: SUPPORTED_LANGUAGES,
      });
    }
    const resolved = resolveLanguage(body.language);
    if (!resolved) {
      throw new AutomationValidationError(
        `Unsupported language "${body.language}". Expected one of: ${SUPPORTED_LANGUAGES.join(", ")} (full name or ISO code like "es", "de").`,
        { field: "language", allowed: SUPPORTED_LANGUAGES }
      );
    }
    language = resolved;
  }

  const minWords = Number.isFinite(body.minWords) ? Number(body.minWords) : 1200;
  const maxWords = Number.isFinite(body.maxWords) ? Number(body.maxWords) : 1800;
  if (minWords < 500 || maxWords < minWords || maxWords > 3000) {
    throw new AutomationValidationError(
      "Invalid minWords/maxWords range. Use 500-3000 words and maxWords >= minWords.",
      { field: "minWords" }
    );
  }

  return {
    topic: typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : null,
    niche,
    category,
    anchor,
    anchorUrl,
    brand,
    brief: customBrief,
    mode,
    language,
    image: body.image !== false,
    imageRatio: "16:9",
    minWords,
    maxWords,
  };
}
