import { NICHE_TO_PRESET_KEY, PLATFORM_PRESETS } from "@/config/platformPresets";
import { HARD_JOB_COST_CEILING_USD, maxJobCostUsd } from "@/lib/automation/budget";
import {
  AUTOMATION_LANGUAGE_VALUES,
  resolveLanguage,
} from "@/config/languages";
import { IMAGE_BOX_PROMPTS, PALETTE_FAMILIES } from "@/lib/imageBoxPrompts";
import type {
  AutomationCoverInput,
  AutomationCoverRequest,
  AutomationGenerateInput,
  AutomationGenerateRequest,
} from "@/lib/automation/types";

const IMAGE_STYLE_IDS = IMAGE_BOX_PROMPTS.map((box) => box.id);
const FAMILY_EXCLUDES = PALETTE_FAMILIES.map((family) => `family:${family}`);
/** Values accepted in excludeImageStyles: box ids plus whole palette families. */
const EXCLUDE_ALLOWED = [...IMAGE_STYLE_IDS, ...FAMILY_EXCLUDES];

/** Expand a `family:<name>` entry to the ids of every box in that family. */
function expandExcludeEntry(entry: string): string[] | null {
  if (entry.startsWith("family:")) {
    const family = entry.slice("family:".length);
    if (!(PALETTE_FAMILIES as readonly string[]).includes(family)) return null;
    return IMAGE_BOX_PROMPTS.filter((box) => box.paletteFamily === family).map((box) => box.id);
  }
  return IMAGE_STYLE_IDS.includes(entry) ? [entry] : null;
}

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
const MAX_CUSTOM_LANGUAGE_LENGTH = 80;

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

  const billing = body.billing === undefined || body.billing === null ? "auto" : body.billing;
  if (billing !== "auto" && billing !== "external" && billing !== "api" && billing !== "subscription") {
    throw new AutomationValidationError('Invalid billing. Expected "auto", "external", "api", or "subscription".', {
      field: "billing",
      allowed: ["auto", "external", "api", "subscription"],
    });
  }

  const languageCustom = typeof body.languageCustom === "string" ? body.languageCustom.trim() : "";
  if (
    body.languageCustom !== undefined &&
    body.languageCustom !== null &&
    typeof body.languageCustom !== "string"
  ) {
    throw new AutomationValidationError("Invalid languageCustom. Expected a string.", {
      field: "languageCustom",
    });
  }
  if (languageCustom.length > MAX_CUSTOM_LANGUAGE_LENGTH) {
    throw new AutomationValidationError(
      `Invalid languageCustom. Maximum length is ${MAX_CUSTOM_LANGUAGE_LENGTH} characters.`,
      { field: "languageCustom" }
    );
  }

  let language = "English";
  if (body.language !== undefined && body.language !== null) {
    if (typeof body.language !== "string") {
      throw new AutomationValidationError("Invalid language. Expected a string.", {
        field: "language",
        allowed: AUTOMATION_LANGUAGE_VALUES,
      });
    }
    const languageInput = body.language.trim();
    const isCustom = ["custom", "other (custom)"].includes(languageInput.toLowerCase());
    if (isCustom) {
      if (!languageCustom) {
        throw new AutomationValidationError(
          'languageCustom is required when language is "custom" or "Other (custom)".',
          { field: "languageCustom" }
        );
      }
      language = languageCustom;
    } else {
      const resolved = resolveLanguage(languageInput);
      if (!resolved) {
        throw new AutomationValidationError(
          `Unsupported language "${body.language}". Use a supported full name, ISO alias, or "custom" with languageCustom.`,
          { field: "language", allowed: AUTOMATION_LANGUAGE_VALUES }
        );
      }
      language = resolved;
    }
  } else if (languageCustom) {
    throw new AutomationValidationError(
      'languageCustom requires language: "custom" or language: "Other (custom)".',
      { field: "language" }
    );
  }

  const image = body.image !== false;

  const imageStyle = typeof body.imageStyle === "string" ? body.imageStyle.trim() : "";
  if (body.imageStyle !== undefined && body.imageStyle !== null && typeof body.imageStyle !== "string") {
    throw new AutomationValidationError("Invalid imageStyle. Expected a string.", {
      field: "imageStyle",
      allowed: IMAGE_STYLE_IDS,
    });
  }
  if (imageStyle && !IMAGE_STYLE_IDS.includes(imageStyle)) {
    throw new AutomationValidationError(
      `Unknown imageStyle "${imageStyle}". Expected one of the image box preset ids.`,
      { field: "imageStyle", allowed: IMAGE_STYLE_IDS }
    );
  }
  if (imageStyle && !image) {
    throw new AutomationValidationError(
      "imageStyle requires image generation — remove it or set image: true.",
      { field: "imageStyle" }
    );
  }

  let excludeImageStyles: string[] = [];
  if (body.excludeImageStyles !== undefined && body.excludeImageStyles !== null) {
    if (!Array.isArray(body.excludeImageStyles) || body.excludeImageStyles.some((s) => typeof s !== "string")) {
      throw new AutomationValidationError("Invalid excludeImageStyles. Expected an array of strings.", {
        field: "excludeImageStyles",
        allowed: EXCLUDE_ALLOWED,
      });
    }
    const entries = body.excludeImageStyles.map((s) => s.trim()).filter(Boolean);
    const unknown: string[] = [];
    const expanded = new Set<string>();
    for (const entry of entries) {
      const ids = expandExcludeEntry(entry);
      if (!ids) {
        unknown.push(entry);
        continue;
      }
      for (const id of ids) expanded.add(id);
    }
    if (unknown.length > 0) {
      throw new AutomationValidationError(
        `Unknown excludeImageStyles: ${unknown.join(", ")}. Use box ids or "family:<name>".`,
        { field: "excludeImageStyles", allowed: EXCLUDE_ALLOWED }
      );
    }
    excludeImageStyles = Array.from(expanded);
    if (excludeImageStyles.length >= IMAGE_STYLE_IDS.length) {
      throw new AutomationValidationError(
        "excludeImageStyles excludes every preset — leave at least one available.",
        { field: "excludeImageStyles" }
      );
    }
    if (imageStyle && excludeImageStyles.includes(imageStyle)) {
      throw new AutomationValidationError(
        `imageStyle "${imageStyle}" is also covered by excludeImageStyles.`,
        { field: "imageStyle" }
      );
    }
  }

  const imageQuality = typeof body.imageQuality === "string" ? body.imageQuality.trim().toLowerCase() : "";
  if (body.imageQuality !== undefined && body.imageQuality !== null && typeof body.imageQuality !== "string") {
    throw new AutomationValidationError("Invalid imageQuality. Expected a string.", {
      field: "imageQuality",
      allowed: ["low", "medium", "high"],
    });
  }
  if (imageQuality && !["low", "medium", "high"].includes(imageQuality)) {
    throw new AutomationValidationError(
      `Unknown imageQuality "${body.imageQuality}". Expected "low", "medium" or "high".`,
      { field: "imageQuality", allowed: ["low", "medium", "high"] }
    );
  }
  if (imageQuality && !image) {
    throw new AutomationValidationError(
      "imageQuality requires image generation — remove it or set image: true.",
      { field: "imageQuality" }
    );
  }

  const coverFormat = body.coverFormat === undefined || body.coverFormat === null
    ? "webp"
    : body.coverFormat;
  if (coverFormat !== "png" && coverFormat !== "webp") {
    throw new AutomationValidationError('Invalid coverFormat. Expected "webp" or "png".', {
      field: "coverFormat",
      allowed: ["webp", "png"],
    });
  }
  if (body.coverFormat !== undefined && !image) {
    throw new AutomationValidationError(
      "coverFormat requires image generation — remove it or set image: true.",
      { field: "coverFormat" }
    );
  }

  const minWords = Number.isFinite(body.minWords) ? Number(body.minWords) : 1200;
  const maxWords = Number.isFinite(body.maxWords) ? Number(body.maxWords) : 1800;
  if (minWords < 500 || maxWords < minWords || maxWords > 3000) {
    throw new AutomationValidationError(
      "Invalid minWords/maxWords range. Use 500-3000 words and maxWords >= minWords.",
      { field: "minWords" }
    );
  }

  const seoTitleMaxChars = Number.isFinite(body.seoTitleMaxChars) ? Number(body.seoTitleMaxChars) : 65;
  if (seoTitleMaxChars < 30 || seoTitleMaxChars > 120) {
    throw new AutomationValidationError(
      "Invalid seoTitleMaxChars. Use a value between 30 and 120.",
      { field: "seoTitleMaxChars" }
    );
  }

  let maxCostUsd = maxJobCostUsd();
  if (body.maxCostUsd !== undefined && body.maxCostUsd !== null) {
    const requested = Number(body.maxCostUsd);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new AutomationValidationError(
        "Invalid maxCostUsd. Expected a positive number of USD (e.g. 0.40).",
        { field: "maxCostUsd" }
      );
    }
    if (requested > HARD_JOB_COST_CEILING_USD) {
      throw new AutomationValidationError(
        `Invalid maxCostUsd. The server-side ceiling is $${HARD_JOB_COST_CEILING_USD.toFixed(2)} per job.`,
        { field: "maxCostUsd" }
      );
    }
    maxCostUsd = requested;
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
    billing,
    language,
    image,
    imageStyle,
    excludeImageStyles,
    imageQuality,
    coverFormat,
    imageRatio: "16:9",
    minWords,
    maxWords,
    seoTitleMaxChars,
    maxCostUsd,
  };
}

/** Validate the POST /api/automation/cover body. Mirrors /generate semantics. */
export function validateCoverRequest(input: unknown): AutomationCoverRequest {
  const body = input as Partial<AutomationCoverInput> | null;
  if (!body || typeof body !== "object") {
    throw new AutomationValidationError("Request body must be a JSON object.");
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    throw new AutomationValidationError("Missing required field: topic.", { field: "topic" });
  }
  if (topic.length > 200) {
    throw new AutomationValidationError("Invalid topic. Maximum length is 200 characters.", {
      field: "topic",
    });
  }

  const niche = typeof body.niche === "string" ? body.niche.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";

  const imageStyle = typeof body.imageStyle === "string" ? body.imageStyle.trim() : "";
  if (imageStyle && !IMAGE_STYLE_IDS.includes(imageStyle)) {
    throw new AutomationValidationError(
      `Unknown imageStyle "${imageStyle}". Expected one of the image box preset ids.`,
      { field: "imageStyle", allowed: IMAGE_STYLE_IDS }
    );
  }

  let excludeImageStyles: string[] = [];
  if (body.excludeImageStyles !== undefined && body.excludeImageStyles !== null) {
    if (!Array.isArray(body.excludeImageStyles) || body.excludeImageStyles.some((s) => typeof s !== "string")) {
      throw new AutomationValidationError("Invalid excludeImageStyles. Expected an array of strings.", {
        field: "excludeImageStyles",
        allowed: EXCLUDE_ALLOWED,
      });
    }
    const entries = body.excludeImageStyles.map((s) => s.trim()).filter(Boolean);
    const unknown: string[] = [];
    const expanded = new Set<string>();
    for (const entry of entries) {
      const ids = expandExcludeEntry(entry);
      if (!ids) {
        unknown.push(entry);
        continue;
      }
      for (const id of ids) expanded.add(id);
    }
    if (unknown.length > 0) {
      throw new AutomationValidationError(
        `Unknown excludeImageStyles: ${unknown.join(", ")}. Use box ids or "family:<name>".`,
        { field: "excludeImageStyles", allowed: EXCLUDE_ALLOWED }
      );
    }
    excludeImageStyles = Array.from(expanded);
    if (excludeImageStyles.length >= IMAGE_STYLE_IDS.length) {
      throw new AutomationValidationError(
        "excludeImageStyles excludes every preset — leave at least one available.",
        { field: "excludeImageStyles" }
      );
    }
    if (imageStyle && excludeImageStyles.includes(imageStyle)) {
      throw new AutomationValidationError(
        `imageStyle "${imageStyle}" is also covered by excludeImageStyles.`,
        { field: "imageStyle" }
      );
    }
  }

  const imageQuality = typeof body.imageQuality === "string" ? body.imageQuality.trim().toLowerCase() : "";
  if (imageQuality && !["low", "medium", "high"].includes(imageQuality)) {
    throw new AutomationValidationError(
      `Unknown imageQuality "${body.imageQuality}". Expected "low", "medium" or "high".`,
      { field: "imageQuality", allowed: ["low", "medium", "high"] }
    );
  }

  const coverFormat = body.coverFormat === undefined || body.coverFormat === null
    ? "webp"
    : body.coverFormat;
  if (coverFormat !== "png" && coverFormat !== "webp") {
    throw new AutomationValidationError('Invalid coverFormat. Expected "webp" or "png".', {
      field: "coverFormat",
      allowed: ["webp", "png"],
    });
  }

  return { topic, niche, category, imageStyle, excludeImageStyles, imageQuality, coverFormat };
}
