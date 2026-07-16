import { isSeoBlogUrl, isUgcOrForumUrl, isVideoUrl } from "@/lib/sourcePolicy";

/** Force hl=en on Google support URLs — Hindi threads and malformed locales landed in citations. */
export function normalizeGoogleSupportLocale(url: string): string {
  try {
    const parsed = new URL(url);
    if (/(^|\.)support\.google\.com$/i.test(parsed.hostname) && parsed.searchParams.has("hl")) {
      parsed.searchParams.set("hl", "en");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Last-line guard on generated HTML: unwrap any link the source policy would
 * reject (forum threads, SEO blogs, videos), keeping the text. The anchor
 * link itself is always preserved. Google support links get hl=en forced.
 */
export function stripDisallowedLinks(html: string, anchorUrl: string): string {
  return html.replace(
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (full, href: string, text: string) => {
      if (anchorUrl && href === anchorUrl) return full;
      if (isUgcOrForumUrl(href) || isSeoBlogUrl(href) || isVideoUrl(href)) {
        return text;
      }
      const normalized = normalizeGoogleSupportLocale(href);
      return normalized === href ? full : full.replace(href, normalized);
    }
  );
}
