/**
 * Text helpers for Automation API output. Kept independent of the generation
 * pipeline so transliteration and multilingual counting can be smoke-tested
 * without initializing external API clients.
 */

const UKRAINIAN_MAP: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", ж: "zh",
  з: "z", и: "y", і: "i", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", "'": "", "’": "", "ʼ": "",
};

const RUSSIAN_MAP: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e", ю: "yu", я: "ya",
  ъ: "", ь: "", "'": "", "’": "", "ʼ": "",
};

const LATIN_ASCII_REPLACEMENTS: Readonly<Record<string, string>> = {
  ß: "ss", ł: "l", đ: "d", ð: "d", þ: "th", æ: "ae", œ: "oe", ø: "o",
};

function isWordInitial(text: string, index: number): boolean {
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    if (["'", "’", "ʼ", "ь"].includes(text[previous])) continue;
    return !/\p{L}/u.test(text[previous]);
  }
  return true;
}

/** Ukrainian transliteration follows Cabinet of Ministers resolution No. 55. */
function transliterateUkrainian(text: string): string {
  let output = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "з" && next === "г") {
      output += "zgh";
      index += 1;
      continue;
    }
    const initial = isWordInitial(text, index);
    if (char === "є") output += initial ? "ye" : "ie";
    else if (char === "ї") output += initial ? "yi" : "i";
    else if (char === "й") output += initial ? "y" : "i";
    else if (char === "ю") output += initial ? "yu" : "iu";
    else if (char === "я") output += initial ? "ya" : "ia";
    else output += UKRAINIAN_MAP[char] ?? char;
  }
  return output;
}

function transliterateRussian(text: string): string {
  return Array.from(text, (char) => RUSSIAN_MAP[char] ?? char).join("");
}

function transliterateLatin(text: string): string {
  const replaced = Array.from(text, (char) => LATIN_ASCII_REPLACEMENTS[char] ?? char).join("");
  return replaced.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Produce an ASCII, lowercase, hyphenated slug. Cyrillic is transliterated,
 * never translated. An invalid/empty result is an explicit generation error.
 */
export function slugifyAutomationTitle(text: string, language: string): string {
  const lower = text.trim().toLowerCase();
  const canonicalLanguage = language.trim().toLowerCase();
  const transliterated = canonicalLanguage === "ukrainian"
    ? transliterateUkrainian(lower)
    : canonicalLanguage === "russian"
      ? transliterateRussian(lower)
      : transliterateUkrainian(transliterateRussian(lower));

  const fullSlug = transliterateLatin(transliterated)
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = fullSlug.slice(0, 80).replace(/-+$/g, "");

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Cannot create a valid ASCII slug from title "${text}".`);
  }
  return slug;
}

/** Unicode-aware word count for Latin and Cyrillic article bodies. */
export function countAutomationWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, " ");
  return text.match(/[\p{L}\p{N}]+(?:[’'ʼ-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
