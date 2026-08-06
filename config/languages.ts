/**
 * Supported article languages. Single source of truth for both the UI
 * (brief Language select in app/page.tsx) and the automation API validator
 * (lib/automation/validate.ts). The UI additionally allows a free-text
 * custom language. The automation API accepts this list, ISO aliases, or an
 * explicit custom-language pair (`language: "custom"` + `languageCustom`).
 */
export const SUPPORTED_LANGUAGES = [
  "English",
  "German",
  "Spanish",
  "Portuguese",
  "French",
  "Italian",
  "Polish",
  "Ukrainian",
  "Russian",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** ISO 639-1 codes (and common locale variants) accepted by the automation API. */
export const LANGUAGE_ALIASES: Readonly<Record<string, SupportedLanguage>> = {
  en: "English",
  "en-us": "English",
  "en-gb": "English",
  de: "German",
  "de-de": "German",
  es: "Spanish",
  "es-es": "Spanish",
  "es-mx": "Spanish",
  pt: "Portuguese",
  "pt-br": "Portuguese",
  "pt-pt": "Portuguese",
  fr: "French",
  "fr-fr": "French",
  it: "Italian",
  "it-it": "Italian",
  pl: "Polish",
  "pl-pl": "Polish",
  uk: "Ukrainian",
  "uk-ua": "Ukrainian",
  ru: "Russian",
  "ru-ru": "Russian",
};

/** Machine-readable values returned in Automation API validation errors. */
export const AUTOMATION_LANGUAGE_VALUES = [
  ...SUPPORTED_LANGUAGES,
  ...Object.keys(LANGUAGE_ALIASES),
  "custom",
  "Other (custom)",
] as const;

/**
 * Resolve a user-supplied language (full name like "Spanish" or code like
 * "es" / "es-ES") to a canonical supported language name. Returns null for
 * anything not on the supported list.
 */
export function resolveLanguage(input: string): SupportedLanguage | null {
  const lower = input.trim().toLowerCase();
  if (!lower) return null;
  const byName = SUPPORTED_LANGUAGES.find((lang) => lang.toLowerCase() === lower);
  if (byName) return byName;
  return LANGUAGE_ALIASES[lower] ?? null;
}
