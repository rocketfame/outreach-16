// Publisher Instruction Sheet — a handoff document that goes ON TOP of the
// exported article ONLY for manual delivery to a publishing site.
//
// IMPORTANT: this block is NEVER part of the published article body. It is
// assembled at export time in the UI and must not be routed through
// blocksToHtml / articleBodyHtml or the automation pipeline. It carries
// instructions for the site editor (SEO fields, exact anchor, link/index
// requirements) and is explicitly marked "DO NOT PUBLISH".

export interface PublisherSheetInput {
  titleTag: string;
  metaDescription: string;
  /** Full article body HTML — used to extract the canonical H1 and H2/H3 outline and, as a fallback, the anchor. */
  articleBodyHtml?: string;
  /** Exact commercial anchor text (from the brief used for this article). */
  anchorText?: string;
  /** Target URL the anchor links to. */
  anchorUrl?: string;
  /** Client site host, used to prefer the commercial anchor over trust-source links when extracting from the body. */
  clientSite?: string;
  /** Suggested image alt text; falls back to the H1. */
  imageAlt?: string;
  /** Featured image filename as downloaded from the app (e.g. "my-slug-hero.png"). */
  imageFilename?: string;
}

export interface PublisherSheet {
  html: string;
  text: string;
  /** Structured fields, exposed for previews/tests. */
  fields: {
    seoTitle: string;
    metaDescription: string;
    slug: string;
    h1: string;
    headings: Array<{ level: 2 | 3; text: string }>;
    imageAlt: string;
    imageFilename: string;
    anchorText: string;
    anchorUrl: string;
  };
}

// Boilerplate requirements sent to every publisher. Edit wording here — it is
// the same for all articles. Keep it factual and easy for an editor to follow.
export const PUBLISHER_REQUIREMENTS: Array<{ label: string; value: string }> = [
  { label: 'Link attribute', value: 'The link MUST be dofollow. Do not add rel="nofollow", "sponsored", or "ugc".' },
  { label: 'Indexing', value: 'The page must be indexable — no "noindex" meta/header — and included in the sitemap.' },
  { label: 'Canonical', value: 'The page must be self-canonical. Do not point rel="canonical" to another domain.' },
  { label: 'Internal linking', value: 'Add at least one internal link from a relevant existing page to this article.' },
  { label: 'Content policy', value: 'Publish the content verbatim. Do not edit, shorten, or reword without written approval.' },
  { label: 'Originality', value: 'This content is unique and is not published anywhere else.' },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/** First <h1> text from the body, tags stripped. */
export function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]) : '';
}

/** Ordered H2/H3 outline from the body. */
export function extractHeadings(html: string): Array<{ level: 2 | 3; text: string }> {
  const out: Array<{ level: 2 | 3; text: string }> = [];
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[2]);
    if (text) out.push({ level: Number(m[1]) as 2 | 3, text });
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Extract the commercial anchor from the body, preferring links to the client site. */
export function extractAnchor(html: string, clientSite?: string): { text: string; url: string } {
  const re = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{ text: string; url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    links.push({ url: m[1].trim(), text: stripTags(m[2]) });
  }
  if (links.length === 0) return { text: '', url: '' };
  const clientHost = clientSite ? hostOf(clientSite.startsWith('http') ? clientSite : `https://${clientSite}`) : '';
  if (clientHost) {
    const match = links.find((l) => hostOf(l.url) === clientHost);
    if (match) return match;
  }
  return links[0];
}

export function buildPublisherSheet(input: PublisherSheetInput): PublisherSheet {
  const body = input.articleBodyHtml || '';
  const h1 = extractH1(body) || input.titleTag || '';
  const slug = slugify(h1 || input.titleTag || 'article');
  const headings = extractHeadings(body);

  let anchorText = (input.anchorText || '').trim();
  let anchorUrl = (input.anchorUrl || '').trim();
  if (!anchorText || !anchorUrl) {
    const fromBody = extractAnchor(body, input.clientSite);
    anchorText = anchorText || fromBody.text;
    anchorUrl = anchorUrl || fromBody.url;
  }

  const imageAlt = (input.imageAlt || h1 || input.titleTag || '').trim();
  const imageFilename = input.imageFilename || `${slug}-hero.png`;

  const fields = {
    seoTitle: input.titleTag || '',
    metaDescription: input.metaDescription || '',
    slug,
    h1,
    headings,
    imageAlt,
    imageFilename,
    anchorText,
    anchorUrl,
  };

  // ---- HTML (Google-Docs friendly table) ----
  const dash = (v: string) => (v ? escapeHtml(v) : '—');
  const headingsHtml = headings.length
    ? `<ul style="margin:0;padding-left:1.1rem;">${headings
        .map((h) => `<li>${h.level === 3 ? '&nbsp;&nbsp;— ' : ''}${escapeHtml(h.text)} <span style="color:#888;">(H${h.level})</span></li>`)
        .join('')}</ul>`
    : '—';
  const anchorLinkHtml = anchorUrl
    ? `<a href="${escapeHtml(anchorUrl)}">${escapeHtml(anchorUrl)}</a>`
    : '—';

  const rows: Array<[string, string]> = [
    ['SEO Title', dash(fields.seoTitle)],
    ['Meta Description', dash(fields.metaDescription)],
    ['URL slug', dash(fields.slug)],
    ['H1', dash(fields.h1)],
    ['Recommended H2/H3', headingsHtml],
    ['Featured image', dash(fields.imageFilename) + ' <span style="color:#888;">(attached separately)</span>'],
    ['Image alt text', dash(fields.imageAlt)],
    ['Anchor text (exact — do not alter)', `<strong>${dash(fields.anchorText)}</strong>`],
    ['Link target URL', anchorLinkHtml],
    ...PUBLISHER_REQUIREMENTS.map((r) => [r.label, escapeHtml(r.value)] as [string, string]),
  ];

  const cellLabel = 'border:1px solid #000;padding:6px 10px;text-align:left;background-color:#f5f5f5;font-weight:600;white-space:nowrap;vertical-align:top;';
  const cellVal = 'border:1px solid #000;padding:6px 10px;text-align:left;vertical-align:top;';
  const tableRows = rows
    .map(([k, v]) => `<tr><td style="${cellLabel}">${escapeHtml(k)}</td><td style="${cellVal}">${v}</td></tr>`)
    .join('');

  const html =
    `<div class="publisher-sheet" style="margin:0 0 1.5rem 0;">` +
    `<p style="font-weight:700;color:#b00020;margin:0 0 .25rem 0;">— PUBLISHER INSTRUCTIONS · DO NOT PUBLISH THIS SECTION —</p>` +
    `<table style="border-collapse:collapse;width:100%;border:1px solid #000;">${tableRows}</table>` +
    `<hr style="margin:1.25rem 0;border:none;border-top:2px solid #000;" />` +
    `</div>`;

  // ---- Plain text ----
  const textRows: Array<[string, string]> = [
    ['SEO Title', fields.seoTitle],
    ['Meta Description', fields.metaDescription],
    ['URL slug', fields.slug],
    ['H1', fields.h1],
    ['Recommended H2/H3', headings.map((h) => `${h.level === 3 ? '  - ' : '- '}${h.text} (H${h.level})`).join('\n') || '—'],
    ['Featured image', `${fields.imageFilename} (attached separately)`],
    ['Image alt text', fields.imageAlt],
    ['Anchor text (exact — do not alter)', fields.anchorText],
    ['Link target URL', fields.anchorUrl],
    ...PUBLISHER_REQUIREMENTS.map((r) => [r.label, r.value] as [string, string]),
  ];
  const text =
    '— PUBLISHER INSTRUCTIONS · DO NOT PUBLISH THIS SECTION —\n' +
    textRows.map(([k, v]) => `${k}: ${v || '—'}`).join('\n') +
    '\n\n----------------------------------------\n';

  return { html, text, fields };
}
