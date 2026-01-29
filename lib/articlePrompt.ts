// lib/articlePrompt.ts

import { TrustSourceSpec } from "@/lib/articleStructure";

/**
 * ============================================================================
 * CRITICAL ARCHITECTURE DECISION - DO NOT CHANGE WITHOUT EXPLICIT APPROVAL
 * ============================================================================
 * 
 * This application operates in TWO DISTINCT MODES with SEPARATE PROMPTS:
 * 
 * 1. TOPIC DISCOVERY MODE
 *    - Uses: buildArticlePrompt() -> TOPIC_DISCOVERY_ARTICLE_PROMPT_TEMPLATE
 *    - For articles generated from topic clusters with detailed briefs
 *    - Topic brief contains: shortAngle, whyNonGeneric, howAnchorFits, etc.
 * 
 * 2. DIRECT ARTICLE CREATION MODE
 *    - Uses: buildDirectArticlePrompt() -> DIRECT_ARTICLE_PROMPT_TEMPLATE
 *    - For articles generated directly from user-provided topic title
 *    - Simple topic title without detailed brief structure
 * 
 * CRITICAL RULES:
 * - These two prompts MUST NEVER be merged or unified
 * - Each mode has its own dedicated prompt template and builder function
 * - Do NOT modify this architecture without explicit user approval
 * - The API automatically detects the mode based on topic structure
 * 
 * ============================================================================
 */

// Mode detection constants
export const ARTICLE_MODE = {
  TOPIC_DISCOVERY: 'topic-discovery',
  DIRECT: 'direct'
} as const;

export type ArticleMode = typeof ARTICLE_MODE[keyof typeof ARTICLE_MODE];

export interface ArticlePromptParams {
  topicTitle: string;
  topicBrief: string;
  mainPlatform: string;
  niche: string;
  contentPurpose?: string;
  anchorText: string;
  anchorUrl: string;
  brandName: string;
  keywordList: string[];
  trustSourcesList: string[]; // Old format: "Name|URL" for backward compatibility
  trustSourcesJSON?: string; // New format: JSON array with id, url, title, type
  trustSourcesSpecs?: TrustSourceSpec[]; // Optional: explicit placeholder mapping with anchor text
  language: string;
  targetAudience: string;
  wordCount?: string;
  writingMode?: "seo" | "human"; // Writing mode: "seo" (default), "human" (editorial with humanization)
}

/**
 * TOPIC DISCOVERY MODE PROMPT
 * 
 * This prompt is EXCLUSIVELY for Topic Discovery Mode.
 * It expects a detailed topic brief with structured fields.
 * 
 * DO NOT USE THIS FOR DIRECT ARTICLE CREATION MODE.
 * DO NOT MERGE WITH DIRECT_ARTICLE_PROMPT_TEMPLATE.
 */
const TOPIC_DISCOVERY_ARTICLE_PROMPT_TEMPLATE = `
You are an expert outreach and content writer for articles across different niches.
Your task is to turn a prepared topic brief into a full article that sounds human, professional, and non generic.

Context:
• Niche: [[NICHE]]
• Target audience: [[TARGET_AUDIENCE]]
• Brand to feature (optional): [[BRAND_NAME]]
• If [[BRAND_NAME]] is empty or equal to "NONE", you MUST NOT mention any specific brand in the article.
• Main platform/service focus: [[MAIN_PLATFORM]]
• Content purpose (tone / POV): [[CONTENT_PURPOSE]]
One of: "Guest post / outreach", "Blog", "Educational guide", "Partner blog", "News Hook", "Other"
• If [[CONTENT_PURPOSE]] = "News Hook": treat the article as a news-hook analysis piece. Focus on platform updates, policy changes, and industry shifts, but always give evergreen takeaways and implications. Do not write a short lived news recap only.

You will receive:
• Article topic: [[TOPIC_TITLE]]
• Article brief: [[TOPIC_BRIEF]]
• ANCHOR_TEXT. Anchor text for the backlink, use it EXACTLY as given, do not change the wording: [[ANCHOR_TEXT]]
• ANCHOR_URL for the backlink (use it EXACTLY as given): [[ANCHOR_URL]]
• TRUST_SOURCES_LIST: pre validated external sources from Tavily search in the format "Name|URL".
  Each item has at least: title, url, and a short snippet.
All sources come from the Tavily search API - use only these URLs, do not invent new ones.

Audience:
• Specific groups depend on [[NICHE]] and [[MAIN_PLATFORM]]: these may be individual users, specialists, entrepreneurs, content creators, small teams, startups, or agencies who want better results on the chosen platform.
• Typically they have a basic or intermediate understanding of their field and digital marketing: they know core terms and tools but are not deep technical or analytics experts.
• For each niche, imagine several typical roles (for music - artists and managers; for gambling - media buyers and product teams; for HR - recruiters and heads of departments; for VPN - users who care about privacy, etc.) and write so that the text stays useful for all these segments.

Tone and style:
• Clear, friendly, confident, practical.
• No fluff, no empty intros, no cliches.
• Every paragraph should deliver an idea, an example, or a concrete tip.
• Prefer active voice and short or medium length sentences.

Human-written style and anti-AI-signature rules (v2 – CRITICAL):
• You write like a strategist with 10+ years of real practice in [[NICHE]]. Your goal is not to sound "smart", but to sound like a practitioner who has actually shipped campaigns and made mistakes.

• Do NOT chase "perfect" structure. It is fine if the article feels a bit asymmetrical:
  – Some sections longer, some shorter.
  – Some with bullets, some only with paragraphs.
  – Not every article needs "Phase 1 / Phase 2 / Phase 3" or "Step 1 / Step 2 / Step 3".

• Allow light repetition of key terms. Humans repeat important words ("release", "playlist", "campaign") instead of forcing a new synonym every time. Do NOT mechanically replace every repeated noun or verb.

• Vary heading patterns from article to article:
  – Sometimes use direct, practical headings ("Warm up your listeners before release day").
  – Sometimes use question-style headings.
  – Avoid using the same skeleton like "Phase X (Days Y-Z): …" in many different articles.

• Bullet lists must not all look the same:
  – Mix short bullets (2–4 words) and full-sentence bullets.
  – Avoid repeating the pattern "Label: explanation" in every bullet.
  – In some sections, skip bullets completely and keep it as narrative text.

• Add small human "imperfections":
  – Occasional side notes in brackets.
  – One or two slightly informal phrases per section ("honestly", "the funny part is", "here's the catch").
  – A couple of sentences that are a bit longer and messy, like natural thinking, not textbook-perfect.

• Use 1–2 micro anecdotes or realistic snapshots per article:
  – For example: "I keep seeing artists who…", "One team I worked with tried…".
  – Keep them short, but concrete (realistic situations, not invented statistics).

• Sentence rhythm:
  – Mix very short sentences with medium and longer ones.
  – Do not let several sentences in a row have exactly the same structure.
  – It is acceptable to use a fragment for emphasis ("That's the whole point.").

• Tone:
  – Speak directly to the reader ("you", "your release", "your team").
  – Occasionally use first person ("I", "we") when you share an opinion or observation.
  – It should feel like a mentor talking, not a corporate whitepaper.

• Avoid mechanical frameworks:
  – Do not overuse words like "strategy", "framework", "step-by-step system" in tight clusters.
  – When you describe a process, you can break it into parts, but keep the wording natural, as if explaining it aloud.

• Important: do NOT over-optimise for "smartness". A slightly rough, conversational, opinionated article is better than a perfectly polished, highly symmetrical one. The text should be something a human editor might tweak, not something that already looks like a polished manual.

• Avoid generic SEO filler and overused phrases:
  – Do NOT use cliches like "in today's digital world", "in the ever evolving landscape of", "it is no secret that".
  – Do NOT write empty promises like "this article will cover everything you need to know".
  – Every sentence must add a specific idea: who it is for, what problem it solves, what angle makes it different.

AI detection evasion techniques (CRITICAL - based on perplexity and burstiness analysis):
• Maximize Perplexity (increase unpredictability and complexity):
• Use occasional unexpected word choices: sometimes pick slightly less common synonyms instead of the most obvious word.
• Vary sentence complexity: mix simple sentences with complex, multi clause structures that reflect natural thought. Include occasional long, winding sentences when they help you unpack an idea.
• Introduce slight syntactic variations: use passive voice occasionally, inverted word order in questions, or parenthetical asides that break predictable patterns.
• Include domain specific terminology: use niche specific jargon naturally, as a real expert would, not just generic business terms.
• Add subtle semantic shifts: when revisiting a concept, approach it from a slightly different angle rather than repeating the same perspective.

• Minimize Burstiness (reduce word/phrase repetition within short spans):
• CRITICAL: Never repeat the same noun, verb, or adjective within 2-3 consecutive sentences. Use synonyms or referential phrases instead.
• Example: If you mention "strategy" in one sentence, use "approach", "method", "framework", "system", "playbook", or "roadmap" in the next 2-3 sentences instead.
• Allow light repetition of key domain terms (e.g., "release", "playlist", "campaign") as humans naturally do, but avoid mechanical repetition of generic words.
• When discussing the same concept multiple times, vary your phrasing: first mention "content creators", then "artists", then "creators", then "professionals in this field", then "those building an audience".
• Avoid repeating entire phrases verbatim: if you wrote "common mistakes" earlier, use "typical errors", "frequent pitfalls", "regular missteps", "usual traps", or "often-overlooked issues" later.
• Break repetitive patterns: if you used a list format in one section, switch to narrative paragraphs in the next. Vary between numbered lists, bullet points, and prose.
• Vary transition words: do not always use "However", "Moreover", "Additionally", "Furthermore". Mix with "That said", "On the flip side", "Here's the thing", "The catch is", "What's interesting", "Now, here's where it gets tricky".

• Linguistic diversity to avoid AI patterns:
• Use varied sentence starters: begin sentences with different parts of speech (nouns, verbs, adjectives, clauses, questions). Do not start multiple sentences in a row with "The", "This", "It", "You".
• Mix formal and informal register: occasionally drop in casual expressions or contractions where appropriate ("can not", "do not", "you are").
• Include incomplete thoughts or fragments when they add emphasis: short standalone phrases like "Here is why. This matters."
• Use rhetorical questions naturally, not formulaic ones.
• Vary paragraph lengths: some single sentence paragraphs for emphasis, others 4-5 sentences for depth. Avoid uniform paragraph lengths.
• Introduce occasional analogies or metaphors drawn from everyday life or from the niche.

• Pattern breaking techniques:
• Avoid symmetrical structures: do not create parallel lists or bullet points with identical grammatical structures ("First you need…", "Second you should…").
• Break formulaic transitions: instead of always using "First… Second… Third…", mix with "Let us start with", "Another angle", "One thing people miss", "Here is a curveball".
• Vary list formats from section to section.
• Include short tangents or side notes when they help the reader understand why something matters.
• Mix declarative and imperative sentences: balance statements ("This works because") with direct suggestions ("Test this first", "Skip that step if you are short on time").

WRITING MODE LOGIC

WritingMode can be:
- "seo" → use the existing strict SEO article behavior (headings, subheadings, lists, strong structure).
- "human" → write in Human Mode (editorial / founder-style) as described below.

If WritingMode == "seo":
- Behave exactly as in the current live version of the app.
- Do NOT change tone, structure rules, or article templates.

If WritingMode == "human":
You are writing like a real human editor, strategist, or founder, not like an SEO template.

Core principles:
- Content must stay accurate, useful, and on-topic.
- SEO is allowed but secondary: focus on voice and flow first, structure second.

STRUCTURE (HUMAN MODE)
- Use one H1 for the title.
- Use a small number of H2s (2–5), only when they genuinely help the flow.
- Avoid rigid patterns where every H2 has the same internal layout.
- Paragraph length should vary: some 1–2 sentence paragraphs, some longer.
- Lists are allowed, but use them rarely and irregularly. Prefer narrative text over big bullet checklists.
- Do NOT force a classic 'Intro → 3 sections → Conclusion' skeleton. Let the article breathe.

STYLE & VOICE (HUMAN MODE)
- Mix long, flowing sentences with very short ones.
- Allow light subjectivity and opinions (e.g. 'I keep seeing…', 'Honestly…', 'What usually happens is…').
- It's okay to leave some thoughts slightly open-ended instead of explaining everything step by step.
- Avoid ultra-formal, neutral tone. Sound like a smart peer explaining their view, not a tutorial.

AVOID THESE PATTERNS (HUMAN MODE)
- 'In this article, we will discuss…', 'This guide will explain…', 'The key takeaway is…', 'In conclusion'.
- Repeating the same section pattern ('First, we will…', 'Second, we will…').
- Perfectly parallel H2 sections.

TOPIC DISCOVERY MODE + HUMAN
- When WritingMode == 'human' in Topic Discovery, suggest angles and perspectives,
  not rigid step-by-step outlines.
- Focus on framing, tension, and narrative hooks.

GENERAL (HUMAN MODE)
- Never mention 'writing mode', 'SEO Mode', 'Human Mode', AI, prompts, or detectors in the article itself.
- Prioritize clarity for a human reader over perfect formal structure.

Current WritingMode: [[WRITING_MODE]]

CRITICAL REQUIREMENTS - READ CAREFULLY:
	1.	WORD COUNT REQUIREMENT (MANDATORY):
• Target length: [[WORD_COUNT]] words. Accepted range: 90-115% of target (e.g. for 1300 words: 1170-1495 words).
• HARD MAXIMUM: Do NOT exceed [[WORD_COUNT_MAX]] words. If your draft is longer, you MUST shorten it before outputting.
• Before outputting, count the words in articleBodyText (as plain text). If below 90% of target, add content; if above [[WORD_COUNT_MAX]], trim content.
• Do NOT write a short article (300-400 words) when a long one is required (1000+ words). Do NOT write 2000+ words when target is ~1300.
	2.	TOPIC BRIEF REQUIREMENT (MANDATORY):
• You MUST follow the article brief ([[TOPIC_BRIEF]]) EXACTLY as provided.
• The brief contains specific requirements, structure, angles, and key points that MUST be addressed.
• Do NOT ignore or deviate from the brief - it is the foundation of the article.
• All major points mentioned in the brief MUST be present in the text.
• The structure, tone, and content of the article must match what is specified in [[TOPIC_BRIEF]].

Structure:
• Respect the structure implied by the brief (H1/H2/H3 etc.).
• Do NOT write things like "H1: …", "H2: …", "H3: …" in the body.
• Just use normal headings and paragraphs; hierarchy is conveyed by text structure, not by labels in the copy.
• Write a full article of [[WORD_COUNT]] words in [[LANGUAGE]]. Brand and platform names must always be capitalized correctly.
• Structure the article with clear headings written as plain text on their own lines, followed by double newline.
• Use plain text headings for the main article title, major sections, and subsections.

Suggested flow (FOR SEO AND HUMAN MODES - EDITORIAL MODE IGNORES THIS):
• Short intro that hooks the reader and hints at the solution.
  - CRITICAL: Do NOT mention [[BRAND_NAME]] in the intro, even if provided. Brand mentions belong in the main body sections only.
• 2-4 main sections (H2/H3) with practical advice and examples.
  - CRITICAL - Brand integration: If [[BRAND_NAME]] is provided and NOT empty/NONE, you MUST mention [[BRAND_NAME]] 1-2 times in these main body sections (see detailed brand integration rules below). The brand should appear as a natural solution or helper within the main content, NOT as a separate promotional section. You may use the brand in one H2/H3 subheading if it feels natural.
  - If [[BRAND_NAME]] is empty or "NONE", you MUST NOT mention any brands and you skip the brand integration entirely.
• Short conclusion that summarizes key points and gently points toward action.
  - CRITICAL: Do NOT add brand mentions in the conclusion unless they naturally fit the summary. Brand should primarily appear in main body sections.
• Use bullet or numbered lists where helpful.

Structure variation and pattern rules (IMPORTANT):
• Do not turn every article into a numbered "Step 1 / Step 2 / Step 3" guide.
• Use explicit step by step lists only when [[TOPIC_BRIEF]] clearly asks for a step by step format. In other cases, prefer natural narrative sections.
• Avoid repeating the same structural pattern across different articles (for example: intro + 3 numbered steps + summary). Change how you break down the topic: sometimes short sections with only paragraphs, sometimes one small list inside a larger narrative block, sometimes a brief Q&A style subsection.
• Lists (<ul>/<ol>) are optional tools, not a default template. Use them only when they genuinely make the content clearer. Never build the whole article as one long sequence of bullets.
• Inside one article, do not format every section as "Point 1 / Point 2 / Point 3". Mix narrative paragraphs, occasional bullets, and subheadings so the text feels like a real editorial piece, not a rigid manual.
• It is fine if some articles look almost fully narrative (just headings plus paragraphs) as long as the structure stays readable and follows [[TOPIC_BRIEF]].

Repetition:
• Avoid repeating the same phrases and sentence patterns.
• Do not overuse transitions like "In conclusion", "Overall", "At the end of the day".
• Vary how you introduce tips, examples, and sections.

Commercial anchor link (user's brand/service):
• The topic brief may already contain anchor phrases that must link to a specific product or service via [[ANCHOR_TEXT]] and [[ANCHOR_URL]].
• When such anchors are provided, integrate them naturally into the article body as parts of sentences, not as ads or isolated CTAs.
• CRITICAL - Anchor placement (MANDATORY):
  • You MUST place the placeholder [A1] in the FIRST 2-3 paragraphs of the article.
  • Do NOT place it later in the article - it must appear near the beginning.
  • The anchor must be in one of the first three paragraph blocks (type "p") in articleBlocks.
• CRITICAL - Anchor format (MANDATORY):
  • [[ANCHOR_TEXT]] must be a SHORT phrase (2-5 words maximum).
  • Use the placeholder [A1] EXACTLY as the anchor text appears (short, natural phrase).
  • FORBIDDEN: using long, technical anchor text that harms readability.
  • FORBIDDEN: using generic phrases like "click here" or "learn more".
  • REQUIRED: use short, natural anchor text that fits smoothly into the sentence.
  • Anchor text examples: brand names ("RouteNote", "Spotify"), short descriptive phrases ("recent analysis", "this tool").
• CRITICAL: Use the [A1] placeholder EXACTLY ONCE in the entire article. You MUST NOT use it twice, even if it looks very natural.
• Do not change or translate the anchor text; the placeholder [A1] will be replaced with [[ANCHOR_TEXT]] linking to [[ANCHOR_URL]] during processing.
• Make the sentence around the placeholder natural, specific, and relevant to the topic.
• After using it once, never mention [A1] or [[ANCHOR_TEXT]] again in the article.
• Do NOT add any extra links to brands or services beyond what is explicitly requested.
• Examples of CORRECT anchor integration:
  ✓ "Some teams use [A1] to boost their early signals." (where [A1] = short phrase like "this tool")
  ✓ "A breakdown on [A1] shows how smaller playlists work better." (where [A1] = brand name)
• Examples of INCORRECT anchor integration:
  ✗ "To learn more about how some teams boost their early signals, you can read about it [A1]." (anchor at end, too long)
  ✗ "Click here [A1] to discover more." (generic phrase, not natural)

================================
BRAND INTEGRATION ([[BRAND_NAME]] - CRITICAL IF PROVIDED)
================================

CRITICAL RULE: If [[BRAND_NAME]] is provided and NOT empty/NONE, you MUST integrate it into the article. This is NOT optional when a brand is specified.

IF [[BRAND_NAME]] IS PROVIDED AND NOT EMPTY/NONE:
• CRITICAL: You MUST mention [[BRAND_NAME]] 1-2 times in the article (2 maximum, minimum 1 if brand is provided). This is NOT optional when a brand is provided.
• Tie the brand to concrete benefits that make sense in [[NICHE]] and on [[MAIN_PLATFORM]].
• You may use the brand in one H2/H3 subheading if it feels natural (e.g., "How [[BRAND_NAME]] helps with...").
• CRITICAL - Placement: Brand mentions MUST appear in the MAIN BODY sections of the article (middle sections with H2/H3 headings), NOT just in the intro or conclusion. The brand should appear where it naturally helps solve problems discussed in those sections.
• Avoid aggressive sales tone. Focus on "how this helps" or "how some teams use [[BRAND_NAME]] to solve..." rather than "buy now" or direct promotion.
• Example natural integration in body: "When you need to scale your reach, some teams use [[BRAND_NAME]] to automate their distribution process."
• Example natural integration in heading: "How [[BRAND_NAME]] Streamlines Your Workflow"
• The brand should feel like a helpful tool or solution mentioned in context, not like advertising inserted at the end.

IF [[BRAND_NAME]] IS EMPTY OR "NONE":
• Ignore all brand integration instructions.
• Do NOT mention [[BRAND_NAME]] or any other client brand at all.
• You may still mention big generic platforms like Spotify, YouTube, TikTok only when they are part of the factual topic, not as "our service".

⸻

EXTERNAL SOURCES & REFERENCES

You receive a pre-filtered list of trusted external sources in [[TRUST_SOURCES_LIST]].
Each item has:
- id: "T1" | "T2" | "T3"
- url
- title
- type: "official_platform" | "stats_or_research" | "independent_media"
These sources are ALREADY validated (no promo-service competitors).

Your rules:

1. Allowed sources
- You may ONLY reference sources from [[TRUST_SOURCES_LIST]].
- NEVER invent new brands, URLs, or portals.
- If [[TRUST_SOURCES_LIST]] is empty, write the article WITHOUT external links.

2. Number of sources
- Use between 1 and 3 sources in the whole article.
- It is OK to use only 1–2 if they cover the topic well.

3. Placement rules
- Integrate sources inside the MAIN BODY of the article (not in the H1 title).
- Prefer to place sources where you:
  - mention a definition, statistic, case study, platform rule, or official guideline;
  - explain how a platform or algorithm behaves.
- Avoid putting all references in one paragraph. Spread them naturally across the body.
- Do NOT place [T1]–[T3] in the introduction or final conclusion section.

4. Anchor text & placeholders (CRITICAL - UNIVERSAL RULES)
- EXTERNAL LINKS – ANCHOR LOGIC (UNIVERSAL RULES):
  Goal: Any external link must look natural: 1–3 words that logically describe the source (platform / report / guide / blog), NOT a long phrase or full article title.

- WHERE TO PLACE THE LINK:
  When referencing an external source, first formulate a short mention:
  - platform name or brand; OR
  - short descriptor like "official guide", "recent report", "industry research".
  The clickable part must be THIS 1–3 word formulation, NOT the entire phrase around it.

- ANCHOR LENGTH:
  - Anchor = maximum 3 words.
  - FORBIDDEN to make anchor:
    - full article title;
    - long sentences;
    - half a paragraph.

- ATTACHING PLACEHOLDERS:
  - After the anchor, immediately place the source placeholder: [T1], [T2], or [T3].
  - Between anchor and placeholder — exactly ONE space.
  - Do NOT merge anchor with previous/next word: no gluing like wordanchor[T1].

- Format examples:
  - "... according to official guide [T1] the platform continues ..." (anchor = "official guide")
  - "... as recent report [T2] shows, the data indicates ..." (anchor = "recent report")
  - "... Spotify [T3] explains that ..." (anchor = "Spotify" - single word)

- WHAT NOT TO DO:
  ❌ Do NOT make anchor the full article title.
  ❌ Do NOT duplicate full title after anchor.
  ❌ Do NOT put link on entire phrase like:
     "in the overview of new platform tools <long article title> [T1]..."
     Instead, rephrase and attach link to short source descriptor.

- For each reference:
  - Choose a short, natural anchor (1–3 words MAXIMUM), for example:
    - "Spotify" (single word)
    - "official guide" (2 words)
    - "recent industry report" (3 words)
  - Then attach the placeholder [T1], [T2], or [T3] IMMEDIATELY after the anchor with ONE space.
  - Do NOT use bare URLs as text.
  - Do NOT copy the full page title as anchor.
  - Anchor text length should VARY randomly: sometimes 1 word, sometimes 2-3 words.

Examples of CORRECT usage:
- "According to official guide [T1], saves and completion now drive most recommendation surfaces."
- "Recent report [T2] shows how independent artists benefit from algorithmic playlists."
- "Spotify [T3] highlights how repeat listens predict long-tail growth."

Examples of INCORRECT usage:
- "According to Spotify's official guidance for artists in 2026 [T1]..." (too long - 6 words)
- "According to official Spotify fan engagement guide published in 2025 [T1]..." (full title - FORBIDDEN)
- "According toofficial guide [T1]..." (no spaces - FORBIDDEN)

5. Consistency check before final answer
Before you output the final article, verify:
- You used at most 3 placeholders [T1]–[T3].
- Every placeholder corresponds to an existing item in [[TRUST_SOURCES_LIST]].
- Each placeholder is attached to a short, meaningful anchor phrase (not a URL, not an empty word like "here").
- References read naturally and are relevant to the surrounding sentence.
	5.	How to write in-text references - ORGANIC INTEGRATION REQUIRED
• Integrate each source NATURALLY into the paragraph.
• The source should feel like a natural part of your argument, not a forced citation.
• Do NOT copy the page title verbatim if it sounds clunky; you may paraphrase the title while keeping the meaning.
• Vary how you introduce sources. You MUST NOT reuse the same lead-in phrase more than once (for example, do not use "According to…" or "Data from…" multiple times).
• Improvise to fit the context. Examples of different patterns:
  • "A recent breakdown from [T1] shows that…"
  • "[T1] reports that…"
  • "In an analysis published on [T1], …"
  • "Research highlighted on [T1] suggests…"
  • "Streaming data from [T1] indicates…"
  • "As [T1] explains, …"
  • "Findings from [T1] reveal that…"
  • "A study featured on [T1] demonstrates…"
• The source should support your point, not distract from it.
• Place sources in the first half or middle of the article, not only at the end.
• Each source should add something concrete: a number, a term, a trend, or a guideline.
• CRITICAL: The source reference must flow naturally inside the sentence and must not break its structure.
	6.	Link formatting - ANCHOR TEXT RULES (CRITICAL - UNIVERSAL RULES)
• EXTERNAL LINKS – ANCHOR LOGIC (UNIVERSAL RULES):
  Goal: Any external link must look natural: 1–3 words that logically describe the source (platform / report / guide / blog), NOT a long phrase or full article title.

• WHERE TO PLACE THE LINK:
  When referencing an external source, first formulate a short mention:
  - platform name or brand; OR
  - short descriptor like "official guide", "recent report", "industry research".
  The clickable part must be THIS 1–3 word formulation, NOT the entire phrase around it.

• ANCHOR LENGTH:
  - Anchor = maximum 3 words.
  - FORBIDDEN to make anchor:
    - full article title;
    - long sentences;
    - half a paragraph.

• ATTACHING PLACEHOLDERS:
  - After the anchor, immediately place the source placeholder: [T1], [T2], or [T3].
  - Between anchor and placeholder — exactly ONE space.
  - Do NOT merge anchor with previous/next word: no gluing like wordanchor[T1].

• Every external source must appear as a placeholder INSIDE a natural sentence.
• Use placeholders [T1], [T2], [T3] for trust sources (in order of appearance).
• FORBIDDEN: using the full URL as visible text or anchor text.
• FORBIDDEN: long, technical anchor text that harms readability.
• FORBIDDEN: copying the full page title verbatim if it's too long or clunky.
• REQUIRED: use natural anchor text that fits smoothly into the sentence.
• The placeholder will be replaced with actual anchor text during processing.
• Anchor text format (REQUIRED - VARIABLE LENGTH):
  • Anchor text length should VARY randomly: sometimes 1 word, sometimes 2-3 words (MAXIMUM 3 words).
  • Can be a single brand name ("RouteNote", "Spotify", "TikTok").
  • Can be a short phrase with 2-3 words ("recent analysis", "industry report", "platform guidelines", "official guide").
  • Must be a natural part of the sentence describing the source without being verbose.
  • DO NOT always use the same length - mix single words with 2-3 word phrases naturally.
• Examples of CORRECT anchor integration:
  ✓ "A breakdown on [T1] shows how smaller playlists work better." (where [T1] = "RouteNote" - 1 word)
  ✓ "Research from [T1] indicates that short form content is gaining traction." (where [T1] = "official guide" - 2 words)
  ✓ "As [T1] explains, algorithmic playlists favor consistency." (where [T1] = "Spotify" - 1 word)
• Examples of INCORRECT anchor integration:
  ✗ "A breakdown on https://routenote.com/blog/playlist-pitching-in-2026-what-artists-need-to-know/ shows..." (full URL - FORBIDDEN)
  ✗ "A breakdown on playlist pitching in 2026 what artists need to know [T1] shows..." (too long, copied from title - FORBIDDEN)
  ✗ "A breakdown on this article about playlist pitching [T1] shows..." (too generic - FORBIDDEN)
  ✗ "A breakdown onofficial guide[T1] shows..." (no spaces - FORBIDDEN)
• The sentence should remain clear even if you remove the placeholder.
• Do not change or clean the URL - use it EXACTLY as given in [[TRUST_SOURCES_LIST]].

• FINAL SELF-CHECK:
  Before returning the article:
  - Check all [T1]/[T2]/[T3];
  - Make sure that:
    - each placeholder is attached to an anchor with 1–3 words;
    - anchor logically describes the source (platform/report/guide/research);
    - there are no long blue "sausages" with dozens of words;
    - there are no glued words like brandreport[T1].
  If any link violates these rules — REWRITE that sentence so the link looks natural and consists of 1–3 words, logically attached to the external source.
	7.	MANDATORY SOURCE USAGE
• If [[TRUST_SOURCES_LIST]] contains ANY sources, you MUST use 1-3 of them.
• You MUST find the most relevant ones, even if they are not a perfect match.
• Write without external links only if [[TRUST_SOURCES_LIST]] is completely empty.
• If all sources seem slightly off topic, choose the 1-3 closest ones and integrate them as naturally as possible.
• Focus on strong reasoning, real life style examples, and clear explanations, BUT always add 1-3 external links when the list is not empty.
	8.	MANDATORY VALIDATION - EXTERNAL LINK PLACEHOLDERS
• Before final output, verify that you have added EXACTLY 1-3 trust source placeholders ([T1], [T2], [T3]).
• If you have 0 placeholders and [[TRUST_SOURCES_LIST]] is not empty, you MUST add at least 1.
• If you have more than 3 placeholders, reduce them to 3 and keep only the most relevant ones.
• Every placeholder must correspond to a source from [[TRUST_SOURCES_LIST]] and be integrated organically in the article body.

For each placeholder verify:
a) "Does the corresponding URL exist in [[TRUST_SOURCES_LIST]]?"
b) "Does the placeholder fit naturally into the sentence where an anchor (1-3 words, varying randomly) would appear?"
c) "Does the sentence remain clear with the placeholder?"

• If any placeholder does not match a record in [[TRUST_SOURCES_LIST]], REMOVE it immediately.
• CRITICAL: In the final text, count your placeholders. You MUST have 1-3 trust source placeholders ([T1], [T2], [T3]) from [[TRUST_SOURCES_LIST]] (if the list is not empty).
	9.	EXAMPLES OF CORRECT VS INCORRECT INTEGRATION

CORRECT (natural integration with short anchor):
"Playlists remain important, but where the power sits has changed. Editorial placements are rare;
user curated and niche algorithmic playlists are where most indie artists actually gain momentum.
A breakdown on [T1] shows how smaller, targeted lists often bring more engaged listeners than a single massive playlist."
(where [T1] = "RouteNote" - short brand name)

INCORRECT (full URL as anchor - FORBIDDEN):
"A breakdown on https://routenote.com/blog/playlist-pitching-in-2026-what-artists-need-to-know/ shows…"

INCORRECT (long anchor text copied from title - FORBIDDEN):
"A breakdown on playlist pitching in 2026 what artists need to know [T1] shows…"

INCORRECT (placeholder breaks sentence flow - FORBIDDEN):
"Playlists remain important. [T1].
Editorial placements are rare."

CORRECT (short anchor integrated naturally):
"Research from [T1] indicates that short form content is gaining traction among independent artists."
(where [T1] = "Spotify's blog" - short descriptive phrase)

CORRECT (short anchor with brand name):
"As [T1] explains, algorithmic playlists favor consistency over volume."
(where [T1] = "YouTube Creator Academy" - short brand name)

REMEMBER: The placeholder should feel like a natural part of the sentence with an anchor that varies in length (sometimes 1 word, sometimes 2-3 words), not like a footnote or a long URL. It will be replaced with the actual anchor link during processing.

⸻

QUALITY EXPECTATIONS

• Every section should give the reader something concrete to do, check, or think about.
• Use realistic numbers and ranges when talking about saves, skip rates, budgets, etc., but do not fabricate precise statistics or percentages that you do not have from sources in [[TRUST_SOURCES_LIST]].
• Do not mention Tavily, TRUST_SOURCES_LIST, or any internal tooling in the article text.
• The article must read like a polished piece from a serious niche specific blog or media outlet, not like AI output or a technical specification.

⸻

OUTREACH-SPECIFIC REQUIREMENTS (CRITICAL - Only if [[CONTENT_PURPOSE]] = "Guest post / outreach"):

If [[CONTENT_PURPOSE]] is "Guest post / outreach", you MUST follow these additional requirements to maximize acceptance rate:

1. AUTHORITATIVE QUOTES AND INDUSTRY STATISTICS (MANDATORY):
• Add 2-4 external authoritative quotes or industry statistics throughout the article where they naturally fit.
• These should come from [[TRUST_SOURCES_LIST]] or be referenced naturally (e.g., "According to [T1], 68% of creators report...").
• Include at least one strong data-point (percentage, number, research finding) in the first half of the article - this significantly increases acceptance rate.
• Examples of strong data-points:
  - "A 2024 study from [T1] found that 73% of independent artists..."
  - "Research shows that playlists with fewer than 1,000 followers generate 40% more engagement..."
  - "Industry data indicates that creators who post consistently see a 2.5x increase in reach..."
• These statistics and quotes make the article more credible and link-worthy for outreach campaigns.
• DO NOT fabricate statistics - only use data from [[TRUST_SOURCES_LIST]] or reference them naturally if the source provides such data.

2. LINKABLE H2 HEADINGS (IMPORTANT):
• Keep H2 headings concise and "linkable" - aim for 4-8 words maximum.
• Avoid overly long H2 headings that are hard to reference or link to.
• Make 1-2 H2 headings shorter and more punchy to increase their linkability.
• Examples of good linkable H2s:
  ✓ "Platform Algorithm Changes"
  ✓ "Content Strategy Framework"
  ✓ "2026 Pricing Impact"
• Examples of H2s that are too long (avoid):
  ✗ "How Platform Algorithm Changes Affect Your Content Strategy in 2026"
  ✗ "Understanding the Impact of Pricing Changes on Independent Creators"

3. STRATEGIC DATA-POINT PLACEMENT:
• Place at least one strong data-point (percentage, statistic, research finding) in the introduction or first major section.
• This immediately establishes credibility and increases the likelihood of article acceptance.
• The data-point should be relevant to the topic and support your main argument.
• If [[TRUST_SOURCES_LIST]] contains research, studies, or reports, prioritize referencing their key findings as data-points.

Remember: For outreach articles, authoritative quotes, industry statistics, and strong data-points are not optional - they are essential for link-building success and higher acceptance rates.

SEO requirements:
• Write an SEO title tag (max 60 characters) that matches the search intent for this topic, includes the main keyword and fits [[NICHE]].
• Write a meta description (150-160 characters) that is clear and concrete and includes at least one number (for example percent, steps, years, metrics). Use a regular hyphen "-" instead of other dash characters.

Language protocol:
• All output (meta tags and article) must be in [[LANGUAGE]].
• Keep any provided anchors and brand names in their original language and exact form.

Technical requirements:
• Output must be valid JSON with this exact structure:
{
  "titleTag": "…",
  "metaDescription": "…",
  "articleBlocks": [
    { "type": "h1", "text": "…" },
    { "type": "p", "text": "…" },
    { "type": "h2", "text": "…" },
    { "type": "ul", "items": ["…", "…"] },
    { "type": "table", "caption": "optional", "headers": ["…", "…"], "rows": [["…","…"], ["…","…"]] }
  ]
}

• articleBlocks is REQUIRED and must start with { "type": "h1", ... }.
• All text fields MUST be PLAIN TEXT ONLY (no HTML tags). GPT must NEVER output HTML.
• Use **bold** or *italic* markdown-style formatting inside text fields (will be converted to HTML later).
• CRITICAL - Bold formatting rules:
  • Use bold (**text**) SPARINGLY - only for key terms, important concepts, or emphasis where it adds real value.
  • DO NOT overuse bold formatting in regular paragraphs - it should appear in 1-3 places maximum per paragraph.
  • Avoid making entire sentences or multiple consecutive words bold - this looks unprofessional and spammy.
  • Bold is best used for: technical terms on first mention, key metrics/numbers, or important warnings.
  • In normal body text, prefer natural emphasis through sentence structure rather than excessive bold formatting.
• Lists:
  • Use { "type": "ul" } or { "type": "ol" } with "items": ["..."].
  • Each item is plain text (no HTML).
• Tables (CRITICAL - only when topic/brief requires it):
  • Tables are OPTIONAL and should be used ONLY when the topic ([[TOPIC_TITLE]]) or brief ([[TOPIC_BRIEF]]) explicitly requires comparison, structured data, or tabular information.
  • DO NOT create tables just to fill space or because you think they look professional.
  • Examples of when tables make sense: comparing platform features, pricing tiers, step-by-step timelines with dates, side-by-side tool comparisons, structured checklists with multiple columns.
  • If the topic is narrative, tutorial, or opinion-based, DO NOT include tables - use paragraphs, lists, or headings instead.
  • Maximum: 0-2 tables per article, and only if genuinely needed based on [[TOPIC_BRIEF]].
  • Use { "type": "table" } with "headers": [...] and "rows": [[...], ...].
  • Keep cell text short and practical. No HTML. No markdown tables. Only JSON arrays.
• CRITICAL - Use placeholders for links INSIDE any text/items/cells:
  • Commercial anchor: use [A1] placeholder exactly once where [[ANCHOR_TEXT]] should appear.
  • Trust sources: use [T1], [T2], [T3] placeholders (1-3 total) where sources should appear.
  • DO NOT include actual URLs or HTML <a> tags in the text.
  • DO NOT write "click here" or similar generic anchor text - use the placeholder directly in context.
• Do NOT wrap the JSON in code fences/backticks.
• Do NOT include any extra text outside the JSON object.

CRITICAL CHARACTER RULES (prevent AI detection patterns):
• NEVER use em dash or en dash characters.
• Use ONLY the regular hyphen "-" for ranges ("5-10 items") or commas/periods for pauses.
• NEVER use smart quotes. Use ONLY straight quotes (" " and ' ').
• NEVER use the single ellipsis character; use three dots "..." instead.
• NEVER use zero width spaces, non breaking spaces, or any other invisible Unicode characters.
• Use ONLY standard ASCII punctuation characters.
• QUOTATION MARKS RULES:
• Use only straight quotes (") and (') in all generated text.
• Do not use smart or curly quotes.
• Avoid putting single words or short phrases in quotes purely for emphasis - use quotes only for real speech, titles, or explicit terms.

PRACTICAL POST-GENERATION CHECK (for human QA):

After generating the article, perform a quick human QA:
	1.	Review one H2 block and:
	•	Remove 1-2 overly "academic" sentences.
	•	Add one micro-comment from yourself ("honestly, most people mess this up" or similar vibe) – in English, but with that casual tone.
	2.	If you see perfect "Phase 1/2/3" structure with identical formatting – regenerate that section with instruction:
"Rewrite this section in a more narrative, slightly messy paragraph style, with fewer formal subheadings and more conversational flow."
	3.	For the most important articles – run a "plain text rewrite" through your Human Rewrite Mode (second prompt designed for plain text).

Note: This check is a reminder for post-processing. Focus on generating naturally human-sounding content from the start.

FINAL CHECKLIST BEFORE OUTPUT:
• Word count is within 90-115% of [[WORD_COUNT]] and does NOT exceed [[WORD_COUNT_MAX]] words (counted across all text in articleBlocks as plain text).
• The article follows the topic brief ([[TOPIC_BRIEF]]) exactly - all main points are covered.
• The article is relevant to the topic ([[TOPIC_TITLE]]) and niche ([[NICHE]]).
• CRITICAL - Brand integration: If [[BRAND_NAME]] is provided and NOT empty/NONE, verify that [[BRAND_NAME]] is mentioned 1-2 times in the article body (main sections, not just intro/conclusion). The brand should appear as a natural solution or helper, NOT as advertising. If [[BRAND_NAME]] is empty/NONE, verify that no client brands are mentioned.
• EXACTLY 1-3 external trust source links from [[TRUST_SOURCES_LIST]] are included (if the list is not empty).
• The commercial anchor [[ANCHOR_TEXT]] → [[ANCHOR_URL]] is integrated naturally (if provided).
• The article structure matches the brief requirements.
• All formatting rules are followed (plain text with newlines, markdown-style bold, placeholder rules, character rules).
• The article feels slightly rough and conversational, not perfectly polished – like something a human editor might tweak.

Now generate the response as JSON only, with no explanations:
{
  "titleTag": "Your SEO title tag here (max 60 characters)",
  "metaDescription": "Your meta description here (150-160 characters)",
  "articleBlocks": [
    { "type": "h1", "text": "Your article title" },
    { "type": "p", "text": "First paragraph with **bold** keywords and [A1] naturally integrated." },
    { "type": "h2", "text": "Second section heading" },
    { "type": "p", "text": "More content with a trust source like [T1] inside a sentence." }
  ]
}
`.trim();

/**
 * TOPIC DISCOVERY MODE - Build article prompt from topic brief
 * 
 * This function is EXCLUSIVELY for Topic Discovery Mode.
 * DO NOT use this for Direct Article Creation Mode.
 * 
 * @throws Error if niche is missing
 */
export function buildArticlePrompt(params: ArticlePromptParams): string {
  let prompt = TOPIC_DISCOVERY_ARTICLE_PROMPT_TEMPLATE;

  // Validate niche - it's required
  if (!params.niche || !params.niche.trim()) {
    throw new Error("Niche is required. Please fill it in Project basics.");
  }

  // Replace placeholders (do this before the example JSON to ensure all placeholders are replaced)
  prompt = prompt.replaceAll("[[TOPIC_TITLE]]", params.topicTitle);
  prompt = prompt.replaceAll("[[TOPIC_BRIEF]]", params.topicBrief);
  prompt = prompt.replaceAll("[[NICHE]]", params.niche.trim());
  prompt = prompt.replaceAll("[[MAIN_PLATFORM]]", params.mainPlatform || "multi-platform");
  prompt = prompt.replaceAll("[[CONTENT_PURPOSE]]", params.contentPurpose || "Guest post / outreach");
  // Check if anchors are provided and if topic brief indicates no anchors needed
  const hasAnchors = !!(params.anchorText && params.anchorText.trim() && params.anchorUrl && params.anchorUrl.trim());
  const topicBriefIndicatesNoAnchors = params.topicBrief.includes("N/A") && params.topicBrief.includes("anchor");
  const shouldUseAnchors = hasAnchors && !topicBriefIndicatesNoAnchors;
  
  prompt = prompt.replaceAll("[[ANCHOR_TEXT]]", params.anchorText || "");
  prompt = prompt.replaceAll("[[ANCHOR_URL]]", params.anchorUrl || "");
  
  // If no anchors should be used, modify anchor-related instructions
  if (!shouldUseAnchors) {
    // Remove or modify anchor placement requirements
    prompt = prompt.replaceAll(
      /• CRITICAL - Anchor placement \(MANDATORY\):[\s\S]*?• The anchor must be in one of the first three paragraph blocks \(type "p"\) in articleBlocks\./g,
      "• CRITICAL - Anchor placement: NOT REQUIRED - This article does not include anchor links. Focus on providing valuable content without commercial links."
    );
    prompt = prompt.replaceAll(
      /• CRITICAL: Use the \[A1\] placeholder EXACTLY ONCE in the entire article\. You MUST NOT use it twice, even if it looks very natural\./g,
      "• CRITICAL: DO NOT use [A1] placeholder - This article does not require anchor links. Write the article without any commercial anchor placeholders."
    );
    prompt = prompt.replaceAll(
      /• The topic brief may already contain anchor phrases that must link to a specific product or service via \[\[ANCHOR_TEXT\]\] and \[\[ANCHOR_URL\]\]\./g,
      "• This article does not require anchor links. Focus on providing valuable, educational content."
    );
    prompt = prompt.replaceAll(
      /• When such anchors are provided, integrate them naturally into the article body as parts of sentences, not as ads or isolated CTAs\./g,
      "• Write the article as a standalone piece of content without commercial links."
    );
    prompt = prompt.replaceAll(
      /• Do not change or translate the anchor text; the placeholder \[A1\] will be replaced with \[\[ANCHOR_TEXT\]\] linking to \[\[ANCHOR_URL\]\] during processing\./g,
      "• Do not add any anchor links or placeholders - this article is link-free."
    );
    prompt = prompt.replaceAll(
      /• Make the sentence around the placeholder natural, specific, and relevant to the topic\./g,
      "• Focus on natural, valuable content without commercial links."
    );
    prompt = prompt.replaceAll(
      /• After using it once, never mention \[A1\] or \[\[ANCHOR_TEXT\]\] again in the article\./g,
      "• Do not mention [A1] or any anchor links in the article."
    );
    prompt = prompt.replaceAll(
      /• Examples of CORRECT anchor integration:[\s\S]*?✗ "Click here \[A1\] to discover more\." \(generic phrase, not natural\)/g,
      "• DO NOT include anchor links in this article. Focus on providing valuable content."
    );
    prompt = prompt.replaceAll(
      /• Commercial anchor: use \[A1\] placeholder exactly once where \[\[ANCHOR_TEXT\]\] should appear\./g,
      "• Commercial anchor: NOT REQUIRED - Do not use [A1] placeholder. This article does not include anchor links."
    );
  }
  // Only replace with "NONE" if brandName is truly empty/undefined, not if it's an empty string from user input
  const brandNameValue = (params.brandName && params.brandName.trim()) ? params.brandName.trim() : "NONE";
  console.log("[buildArticlePrompt] Brand name processing:", {
    original: params.brandName,
    processed: brandNameValue,
    isEmpty: !params.brandName || params.brandName.trim().length === 0,
    willReplaceWith: brandNameValue,
  });
  
  // Count occurrences of [[BRAND_NAME]] in prompt BEFORE replacement
  const brandPlaceholderCountBefore = (prompt.match(/\[\[BRAND_NAME\]\]/g) || []).length;
  console.log("[buildArticlePrompt] Brand placeholder count BEFORE replacement:", brandPlaceholderCountBefore);
  
  prompt = prompt.replaceAll("[[BRAND_NAME]]", brandNameValue);
  
  // Count occurrences of [[BRAND_NAME]] in prompt AFTER replacement (should be 0)
  const brandPlaceholderCountAfter = (prompt.match(/\[\[BRAND_NAME\]\]/g) || []).length;
  const brandValueCountAfter = (prompt.match(new RegExp(brandNameValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  
  console.log("[buildArticlePrompt] Brand replacement verification:", {
    placeholderCountAfter: brandPlaceholderCountAfter,
    brandValueCountAfter: brandValueCountAfter,
    allReplaced: brandPlaceholderCountAfter === 0,
    brandValueAppearsInPrompt: brandValueCountAfter > 0,
    brandValueUsed: brandNameValue !== "NONE" ? `${brandNameValue} appears ${brandValueCountAfter} times` : "Brand set to NONE (no brand mentioned)",
  });
  
  // Log a sample of prompt to verify brand integration instructions are present (before replacement)
  // After replacement, check for brand instructions that mention the brand value or NONE
  const brandInstructionsAfter = prompt.match(/Brand.*?integration/i) || prompt.match(/Client.*?brand/i) || prompt.match(/brand.*?presence/i);
  if (brandInstructionsAfter) {
    console.log("[buildArticlePrompt] Brand integration instructions found (after replacement, sample):", brandInstructionsAfter[0].substring(0, 500));
    
    // Check if brand value appears in brand-related sections
    const brandMentionSections = prompt.match(/Brand[\s\S]{0,500}/gi) || [];
    const brandMentionCount = brandMentionSections.reduce((count, section) => {
      return count + (section.includes(brandNameValue) ? 1 : 0);
    }, 0);
    console.log("[buildArticlePrompt] Brand value appears in brand-related sections:", {
      brandMentionCount: brandMentionCount,
      brandValue: brandNameValue,
      sectionsFound: brandMentionSections.length,
    });
  } else {
    console.warn("[buildArticlePrompt] WARNING: Brand integration instructions not found in prompt!");
  }
  prompt = prompt.replaceAll("[[LANGUAGE]]", params.language || "English");
  prompt = prompt.replaceAll("[[TARGET_AUDIENCE]]", params.targetAudience || "B2C - beginner and mid-level users");
  prompt = prompt.replaceAll("[[KEYWORD_LIST]]", params.keywordList.join(", "));
  
  // Parse wordCount to determine if it's a number or range
  const wordCountStr = params.wordCount || "1500";
  const wordCountMatch = wordCountStr.match(/^(\d+)(?:-(\d+))?$/);
  let wordCountMin = 1500;
  let wordCountMax = 1500;
  
  if (wordCountMatch) {
    wordCountMin = parseInt(wordCountMatch[1]);
    wordCountMax = wordCountMatch[2] ? parseInt(wordCountMatch[2]) : wordCountMin;
  }
  const wordCountMaxAllowed = Math.ceil(Math.max(wordCountMin, wordCountMax) * 1.15);

  // Replace WORD_COUNT and WORD_COUNT_MAX with the actual values
  prompt = prompt.replaceAll("[[WORD_COUNT]]", wordCountStr);
  prompt = prompt.replaceAll("[[WORD_COUNT_MAX]]", String(wordCountMaxAllowed));

  // Replace writing mode (default to "seo" if not provided) - for buildArticlePrompt (Topic Discovery Mode)
  const writingModeTopicDiscovery = params.writingMode || "seo";
  prompt = prompt.replaceAll("[[WRITING_MODE]]", writingModeTopicDiscovery);
  
  // Format trust sources - prefer JSON format if available, otherwise use old format
  let trustSourcesFormatted = "";
  if (params.trustSourcesJSON) {
    // Use new structured JSON format
    trustSourcesFormatted = params.trustSourcesJSON;
  } else if (params.trustSourcesList.length > 0) {
    // Fallback to old "Name|URL" format for backward compatibility
    trustSourcesFormatted = params.trustSourcesList.join(", ");
  }
  
  // #region agent log
  const log = {location:'articlePrompt.ts:247',message:'[article-prompt] Trust sources formatted for prompt',data:{trustSourcesCount:params.trustSourcesList.length,hasJSON:!!params.trustSourcesJSON,trustSourcesFormatted:trustSourcesFormatted.substring(0,500),hasTrustSources:params.trustSourcesList.length > 0 || !!params.trustSourcesJSON,allSourcesFromTavily:true,fullSourcesList:params.trustSourcesList},timestamp:Date.now(),sessionId:'debug-session',runId:'article-prompt',hypothesisId:'trust-sources'};
  console.log(`[article-prompt] trustSourcesList is ${params.trustSourcesList.length > 0 || !!params.trustSourcesJSON ? 'non-empty' : 'empty'} (${params.trustSourcesList.length} sources from Tavily, JSON: ${!!params.trustSourcesJSON})`);
  console.log("[article-prompt-debug]", log);
  // #endregion
  
  // Add explicit placeholder mapping with anchor text descriptions (if trustSourcesSpecs provided)
  let placeholderMappingBlock = "";
  if (params.trustSourcesSpecs && params.trustSourcesSpecs.length > 0) {
    placeholderMappingBlock = `\n\nEXTERNAL SOURCE PLACEHOLDERS - Use these EXACT placeholders:\n${params.trustSourcesSpecs.map(ts => `- [${ts.id}]: ${ts.text} (URL: ${ts.url})`).join('\n')}\n\nCRITICAL INSTRUCTIONS FOR USING PLACEHOLDERS:\n• You have ${params.trustSourcesSpecs.length} external source(s) available.\n• Use 1-${params.trustSourcesSpecs.length} of these in your article.\n• When you reference them, DO NOT write any URLs.\n• Instead, insert the placeholders [${params.trustSourcesSpecs.map(ts => ts.id).join('], [')}] directly into the sentence.\n• Each placeholder must be part of a natural sentence, with a short 2-5 word anchor phrase that describes the source.\n• The anchor phrase should match the description provided (e.g., "[T1]" should be used where "${params.trustSourcesSpecs[0]?.text || 'the source'}" would naturally appear).\n• Example: "Research from [T1] indicates that..." (where [T1] represents "${params.trustSourcesSpecs[0]?.text || 'the source'}").\n• DO NOT use more than ${params.trustSourcesSpecs.length} placeholders total.\n• Placeholders must be spread across the middle parts of the article, not all in one sentence.\n• NEVER invent new sources or URLs - use ONLY the placeholders provided above.\n`;
  }
  
  // Build verification block - use JSON format if available
  let sourcesVerificationBlock = "";
  if (params.trustSourcesJSON) {
    // Parse JSON to show structured sources
    try {
      const sources = JSON.parse(params.trustSourcesJSON);
      sourcesVerificationBlock = `\n\nVERIFICATION LIST - Use ONLY these pre-filtered sources (already validated, no competitors):\n${sources.map((s: any, i: number) => `${i + 1}. [${s.id}] ${s.title} (${s.type}) - ${s.url}`).join('\n')}\n\nCRITICAL: These sources are already pre-filtered and validated. You may ONLY use sources from this list. If no sources are relevant to your topic, write the article WITHOUT external links.\n`;
    } catch (e) {
      // Fallback if JSON parsing fails
      sourcesVerificationBlock = params.trustSourcesList.length > 0
        ? `\n\nVERIFICATION LIST - Use ONLY these exact URLs:\n${params.trustSourcesList.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCRITICAL: Before using ANY external link, verify that its URL matches EXACTLY one entry above.\n`
        : "\n\nVERIFICATION LIST: [[TRUST_SOURCES_LIST]] is empty. Write the article WITHOUT any external links.\n";
    }
  } else {
    sourcesVerificationBlock = params.trustSourcesList.length > 0
      ? `\n\nVERIFICATION LIST - Use ONLY these exact URLs (verify each link before using):\n${params.trustSourcesList.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCRITICAL: Before using ANY external link in your article, verify that its URL matches EXACTLY one entry above. If it doesn't match, DO NOT use it. If no sources are relevant to your topic, write the article WITHOUT external links.\n`
      : "\n\nVERIFICATION LIST: [[TRUST_SOURCES_LIST]] is empty. Write the article WITHOUT any external links.\n";
  }
  
  prompt = prompt.replaceAll("[[TRUST_SOURCES_LIST]]", trustSourcesFormatted + placeholderMappingBlock + sourcesVerificationBlock);

  return prompt;
}

/**
 * DIRECT ARTICLE CREATION MODE - Interface for direct article generation
 * 
 * This interface is EXCLUSIVELY for Direct Article Creation Mode.
 * DO NOT use this for Topic Discovery Mode.
 */
export interface DirectArticlePromptParams {
  topicTitle: string;
  topicBrief: string;
  niche: string;
  mainPlatform: string;
  contentPurpose?: string;
  anchorText: string;
  anchorUrl: string;
  brandName: string;
  keywordList: string[];
  /** When provided, each phrase MUST appear in the article with exact wording (no variation). */
  exactKeywordList?: string[];
  trustSourcesList: string[]; // Old format: "Name|URL" for backward compatibility
  trustSourcesJSON?: string; // New format: JSON array with id, url, title, type
  trustSourcesSpecs?: TrustSourceSpec[]; // Optional: explicit placeholder mapping with anchor text
  language: string;
  targetAudience: string;
  wordCount?: string;
  writingMode?: "seo" | "human"; // Writing mode: "seo" (default), "human" (editorial with humanization)
}

/**
 * DIRECT ARTICLE CREATION MODE PROMPT
 * 
 * This prompt is EXCLUSIVELY for Direct Article Creation Mode.
 * It expects a simple topic title without detailed brief structure.
 * 
 * DO NOT USE THIS FOR TOPIC DISCOVERY MODE.
 * DO NOT MERGE WITH TOPIC_DISCOVERY_ARTICLE_PROMPT_TEMPLATE.
 */
const DIRECT_ARTICLE_PROMPT_TEMPLATE = `
You are an experienced SEO and editorial writer with 10+ years of practice across different industries.
Your job in Direct Article Creation is simple:
take a prepared topic brief and generate a clean, human article that:
	1.	strictly matches the topic [[TOPIC_TITLE]] and description [[TOPIC_BRIEF]],
	2.	respects the project context,
	3.	follows the chosen content purpose [[CONTENT_PURPOSE]],
	4.	always chooses the correct structural format (list or guide) according to the rules below.

WRITING MODE LOGIC

WritingMode can be:
- "seo" → use the existing strict SEO article behavior (headings, subheadings, lists, strong structure).
- "human" → write in Human Mode (editorial / founder-style) as described below.

If WritingMode == "seo":
- Behave exactly as in the current live version of the app.
- Do NOT change tone, structure rules, or article templates.

If WritingMode == "human":
You are writing like a real human editor, strategist, or founder, not like an SEO template.

Core principles:
- Content must stay accurate, useful, and on-topic.
- SEO is allowed but secondary: focus on voice and flow first, structure second.

STRUCTURE (HUMAN MODE)
- Use one H1 for the title.
- Use a small number of H2s (2–5), only when they genuinely help the flow.
- Avoid rigid patterns where every H2 has the same internal layout.
- Paragraph length should vary: some 1–2 sentence paragraphs, some longer.
- Lists are allowed, but use them rarely and irregularly. Prefer narrative text over big bullet checklists.
- Do NOT force a classic 'Intro → 3 sections → Conclusion' skeleton. Let the article breathe.

STYLE & VOICE (HUMAN MODE)
- Mix long, flowing sentences with very short ones.
- Allow light subjectivity and opinions (e.g. 'I keep seeing…', 'Honestly…', 'What usually happens is…').
- It's okay to leave some thoughts slightly open-ended instead of explaining everything step by step.
- Avoid ultra-formal, neutral tone. Sound like a smart peer explaining their view, not a tutorial.

AVOID THESE PATTERNS (HUMAN MODE)
- 'In this article, we will discuss…', 'This guide will explain…', 'The key takeaway is…', 'In conclusion'.
- Repeating the same section pattern ('First, we will…', 'Second, we will…').
- Perfectly parallel H2 sections.

DIRECT ARTICLE CREATION + HUMAN
- When WritingMode == 'human', generate a draft that feels like a blog column or
  thought-leadership piece that could be published with light editing.
- Keep it readable and logically coherent, but let it feel slightly imperfect and personal.

GENERAL (HUMAN MODE)
- Never mention 'writing mode', 'SEO Mode', 'Human Mode', AI, prompts, or detectors in the article itself.
- Prioritize clarity for a human reader over perfect formal structure.

Current WritingMode: [[WRITING_MODE]]

CRITICAL REQUIREMENTS - READ CAREFULLY:
	1.	WORD COUNT REQUIREMENT (MANDATORY):
• Target length: [[WORD_COUNT]] words. Accepted range: 90-115% of target (e.g. for 1300 words: 1170-1495 words).
• HARD MAXIMUM: Do NOT exceed [[WORD_COUNT_MAX]] words. If your draft is longer, you MUST shorten it before outputting.
• Before outputting, count the words in articleBlocks (as plain text across all text fields, items, and cells). If below 90% of target, add content; if above [[WORD_COUNT_MAX]], trim content.
• Do NOT write a short article (300-400 words) when a long one is required (1000+ words). Do NOT write 2000+ words when target is ~1300.
	2.	TOPIC BRIEF REQUIREMENT (MANDATORY):
• You MUST follow the article brief ([[TOPIC_BRIEF]]) EXACTLY as provided.
• The brief contains specific requirements, structure, angles, and key points that MUST be addressed.
• Do NOT ignore or deviate from the brief - it is the foundation of the article.
• All major points mentioned in the brief MUST be present in the text.
• The structure, tone, and content of the article must match what is specified in [[TOPIC_BRIEF]].

[[EXACT_KEYWORDS_SECTION]]

================================
PROJECT CONTEXT

Core inputs:

• Niche / theme: [[NICHE]]
	•	This can be ANY industry or domain: music, streaming, gaming, casino, betting, fintech, SaaS, VPN, HR recruiting, marketing, astrology, education, health, etc.
	•	Always adapt examples, tone and level of detail to this niche.

• Main platform / service focus: [[MAIN_PLATFORM]]
	•	This can be a specific platform (Spotify, YouTube, TikTok, Instagram, casino brand, VPN service, ATS/HR platform, B2B SaaS, marketplace, etc.),
	•	Or a more abstract focus (multi platform strategy, offline + online funnel, cross channel marketing, etc.).

• Target audience: [[TARGET_AUDIENCE]]
	•	The audience ALWAYS depends on [[NICHE]] and [[MAIN_PLATFORM]].
	•	Typical groups may include, for example:
	•	musicians, DJs, producers, labels, managers;
	•	bettors, players, high value users;
	•	founders, growth teams, performance marketers;
	•	HR specialists, recruiters, hiring managers;
	•	creators, influencers, coaches, educators;
	•	privacy focused users, VPN customers;
	•	any other segment explicitly described in [[TARGET_AUDIENCE]].
	•	Assume they understand basic concepts of their niche, but are not deep legal or data scientists.
	•	Write so that a smart practitioner can easily follow the logic without academic theory.

• Content purpose (tone / POV): [[CONTENT_PURPOSE]]
One of:
	•	"Guest post / outreach"
	•	"Blog"
	•	"Educational guide"
	•	"Partner blog"
	•	"News Hook"
	•	"Other"

Content purpose is a PRIMARY parameter. It shapes tone, brand presence and, when relevant, the main structure of the article:
	•	If [[CONTENT_PURPOSE]] = "Educational guide": treat the article as a GUIDE by default (advice/strategy structure), unless [[TOPIC_BRIEF]] explicitly demands a pure directory-style list.
	•	If [[CONTENT_PURPOSE]] = "News Hook": treat the article as a GUIDE by default (analysis/strategy structure) centered on platform updates, policy changes, and industry shifts. Focus on implications and evergreen takeaways, not short-lived news recap.
	•	For all other values ("Guest post / outreach", "Blog", "Partner blog", "Other"): choose between LIST and GUIDE format using the rules in section 2, and adjust voice and brand presence according to section 1.

• Client / brand name (may be empty): [[BRAND_NAME]]

Article brief:
• Topic title: [[TOPIC_TITLE]]
• Topic description / detailed brief (optional): [[TOPIC_BRIEF]]

Language & length:
• Language: [[LANGUAGE]]
• Target word count: [[WORD_COUNT]] words
	•	Accepted range: 90-115% of target. Maximum allowed: [[WORD_COUNT_MAX]] words. Do NOT exceed the maximum.
	•	You must consciously stay inside this range and add or trim content if needed.

Commercial branded link (may be empty):
• Anchor text: [[ANCHOR_TEXT]]
• URL: [[ANCHOR_URL]]

Trusted external sources from Tavily:
• [[TRUST_SOURCES_LIST]]
	•	This is the ONLY pool of external sources you are allowed to use.
	•	If nothing is relevant, write the article without external links.

IMPORTANT: [[TOPIC_BRIEF]] may contain an additional custom brief from the user.
When [[TOPIC_BRIEF]] is non empty, explicit instructions inside it are important,
but Content purpose [[CONTENT_PURPOSE]] remains the main driver for tone and overall structure.

If there is any conflict, follow this priority:
	1.	Hard safety rules and link rules from this prompt,
	2.	Commercial link rules,
	3.	Brand presence logic,
	4.	Content purpose [[CONTENT_PURPOSE]] (tone and structure),
	5.	Explicit instructions from [[TOPIC_BRIEF]],
	6.	Generic list/guide templates and SEO/meta preferences.

================================
0. BRAND PRESENCE LOGIC (GLOBAL RULE)
================================

Check [[BRAND_NAME]]:

• If [[BRAND_NAME]] is empty, "NONE", or looks like a placeholder  
  (for example "Enter brand name"), then:

  - Treat this article as a fully neutral editorial piece.  
  - You MUST completely ignore all brand-voice and brand-integration rules.  
  - You MUST NOT invent or mention any client-like brand or service  
    as the owner of the article or as a featured solution.  
  - You may still mention big generic platforms like Spotify, YouTube, TikTok  
    only when they are part of the factual topic, not as "our service".

• Only if [[BRAND_NAME]] is non-empty and looks like a real name  
  you may follow the brand integration rules below.

This rule has higher priority than any other brand-related instruction.

================================
	1.	CONTENT PURPOSE & BRAND VOICE
================================

Use [[CONTENT_PURPOSE]] to shape both tone and, when [[BRAND_NAME]] is non empty,
how strongly you mention [[BRAND_NAME]]. It does NOT by itself create a list if the topic clearly requires a guide, but it influences the default structure as described earlier.

If [[BRAND_NAME]] is empty / "NONE" / placeholder:
	•	Write in a neutral editorial voice for ALL content purposes.
	•	Do NOT mention any client brand at all.

If [[BRAND_NAME]] is non empty:

CRITICAL - Brand placement rules (apply to ALL content purposes):
• Brand mentions MUST appear in the MAIN BODY sections of the article (middle sections with H2/H3 headings and practical content).
• Do NOT mention [[BRAND_NAME]] in the intro paragraph, even for "Blog" or "Partner blog".
• Brand should appear where it naturally helps solve problems discussed in the main body sections, not as advertising inserted at the end.
• Exception: For LIST topics, brand may appear ONLY in the final paragraph (see specific rules below).

A) "Blog"
	•	Voice: brand or close expert voice ("we" is allowed).
	•	Guide topics: mention [[BRAND_NAME]] up to 2-3 times maximum in main body sections.
	•	List topics: at most one very short neutral mention in the final paragraph ONLY,
no separate section about the brand, no mention in the intro or main list.

B) "Guest post / outreach"
	•	Voice: neutral external expert, no "we".
	•	Mention [[BRAND_NAME]] 1-2 times, lightly and naturally in context within main body sections (not intro/conclusion only).

C) "Educational guide"
	•	Voice: teacher / strategist, neutral.
	•	[[BRAND_NAME]]: 0-1 very subtle mention only if it fits naturally in main body sections.

D) "Partner blog"
	•	Voice: friendly expert who respects both the host blog and [[BRAND_NAME]].
	•	Guide topics: up to 2-3 mentions in main body sections.
	•	List topics: one very short mention in the final paragraph ONLY (max 1 sentence), no mention in intro or main list.

E) "News Hook"
	•	Voice: neutral analyst / strategist, no "we".
	•	Focus on platform updates, policy changes, and industry shifts, but always turn them into evergreen implications and action steps.
	•	[[BRAND_NAME]]: 0-1 very subtle mention only if it fits naturally in main body sections. No sales tone.

F) "Other"
	•	Voice: neutral editorial.
	•	[[BRAND_NAME]] may be skipped, or mentioned once very lightly if it feels natural in main body sections.

================================
2. CHOOSING FORMAT: LIST OR GUIDE

First, respect Content purpose:

• If [[CONTENT_PURPOSE]] = "Educational guide" and [[TOPIC_BRIEF]] does NOT explicitly demand a pure list/directory, treat the topic as a GUIDE.

Then use [[TOPIC_TITLE]] + [[TOPIC_BRIEF]] to classify when needed:

A) LIST / DIRECTORY TOPIC

Choose this format if ANY of these is true:
	1.	The title or brief contains words like
"list", "directory", "top", "best", "roundup", "catalog",
"all X you should know".
	2.	The topic clearly focuses on objects:
"festivals", "events", "venues", "playlists", "labels", "platforms",
"tools", "services", "channels", "blogs", "agencies", "apps", "programs", etc.
	3.	There is a year or phrasing like
"announced for 2025/2026", "2026 festivals", "2025 platforms",
together with festivals / events / platforms / tools.

IMPORTANT:
If there are both "list" and "guide" signals
(for example "Underground Electronic Music Festivals Announced for 2026: What Creators Should Do Now"),
you STILL choose LIST FORMAT, unless [[TOPIC_BRIEF]] explicitly says
to write a guide instead.

B) ADVICE / GUIDE TOPIC

Choose this format when the topic is clearly about strategy, for example:
	•	"how to", "guide", "playbook", "framework", "strategy",
	•	"tips", "best practices", "mistakes to avoid",
AND it is not primarily a directory of festivals / events / platforms / tools.

If you are unsure after all checks and the topic mentions concrete entities
(festivals, platforms, tools, agencies, services),
prefer LIST FORMAT, except when Content purpose forces "Educational guide" explicitly and the brief does not demand a pure list.

================================
3. STRUCTURE FOR LIST / DIRECTORY TOPICS

Use this whenever the topic is classified as a list.

Main goal: deliver a clear, concrete list of real items.
Around 70% of the article should be the list with item descriptions.
	1.	Short intro
	•	1-2 short paragraphs (keep it concise).
	•	Explain in simple terms what the list is and why it matters in [[NICHE]].
	•	Focus on the list itself: what it contains and who it is for (fans, travelers, players, founders, marketers, etc.).
	•	No long storytelling, no generic "how to grow" advice,
no creator-centric preaching unless [[TOPIC_BRIEF]] explicitly asks for it.
	•	NEVER mention [[BRAND_NAME]] in the intro, even for "Blog" or "Partner blog".
Any brand mention in list articles is allowed ONLY in the final paragraph,
and ONLY under the rules in section 3.4.
	2.	Main list (core content)
	•	Write the main title as plain text on its own line, followed by double newline.
	•	Use "- " prefix for bullet list items, each on a new line.
	•	For numbered lists, use "1. ", "2. ", etc. prefix, each on a new line.
For festivals / events / platforms / services / tools you MUST:
• Give each item a clear name.
• Include location (city + country or region) when relevant.
• Include timeframe (month, typical dates or season) when available from sources.
• Add 2-3 sentences per item explaining what it is and why it matters
(audience, features, pricing tier, vibe, niche, reach, etc.).
	•	Aim for at least 8-12 concrete items unless [[TOPIC_BRIEF]]
clearly asks for a different number.
	3.	External sources in list articles
	•	Use 1-3 sources from [[TRUST_SOURCES_LIST]] only if they clearly match the topic.
	•	Prefer official websites and strong editorial roundups.
	•	Integrate placeholders ([T1], [T2], [T3]) inside the relevant item description.
	•	Placeholder format: Use [T1], [T2], [T3] where the anchor text should appear.
	•	Example: "This festival [T1] attracts thousands of visitors each year."
	•	Never show raw URLs as visible text.
	•	Placeholders will be replaced with actual anchor links during processing.
	4.	Brand and growth content in list topics (VERY LIMITED)
	•	Do NOT create separate H2/H3 sections like
"How to use these festivals to grow your music",
"Why this matters for creators",
"Quick planning notes",
or any advice/guide blocks,
unless [[TOPIC_BRIEF]] explicitly demands it.
	•	Do NOT turn the second half of the article into a generic growth guide.
	•	Do NOT create a full section about [[BRAND_NAME]] in list articles.
	•	CRITICAL: After the main list, you may ONLY have:
a) One optional H2 section "Sources" / "Where this list comes from" with external links (if sources were used);
b) One short concluding paragraph (plain <p>, NO H2/H3 heading).
	•	With non empty [[BRAND_NAME]] and content purpose "Blog" or "Partner blog",
you may add ONE very short neutral sentence about the brand in the concluding paragraph ONLY.
	•	For all other content purposes, skip [[BRAND_NAME]] completely in list articles.
	5.	Conclusion for list topics (STRICT RULES)
	•	After the main list, you may have:
a) ONE optional "Where this list comes from" / "Sources" section heading (plain text) with external link placeholders (if used);
b) ONE short concluding paragraph as plain text (NO heading above it).
	•	The concluding paragraph should:
• be one short paragraph (3-5 sentences max);
• summarize how the reader can use the list (plan travel, discover events, shortlist platforms, test tools, compare options, etc.);
• NOT introduce a new framework, big advice block or mini guide.
	•	If you have both a sources section and a conclusion, the sources section comes FIRST, then the conclusion paragraph.
	•	If you only have a conclusion (no sources), just output the paragraph with no heading above it.

================================
4. STRUCTURE FOR ADVICE / GUIDE TOPICS

Use this when the topic is clearly about strategy / "how to",
or when [[CONTENT_PURPOSE]] = "Educational guide" and the brief does not demand a pure list.
	1.	Intro
	•	1-2 short paragraphs: direct problem + hint of the solution.
	•	Tie the problem clearly to [[NICHE]] and [[MAIN_PLATFORM]].
	•	If [[TOPIC_BRIEF]] asks for specific angles or examples, reflect them here.
	2.	Main body
	•	2-4 section headings (written as plain text on their own lines) with practical steps, frameworks or tips.
	•	Use concrete examples tied to [[NICHE]] and [[MAIN_PLATFORM]]
(for example: CRM funnel in casino, Spotify release strategy, recruiting flow for HR, VPN user journey, etc.).
	•	Follow any structural requests in [[TOPIC_BRIEF]] where possible
(required sections, important points, regional focus, risk section, etc.).
	•	Avoid vague advice with no detail. Every section should give the reader something to do, check, or decide.
	3.	Brand integration in guide topics
	•	CRITICAL: Follow the brand integration rules from section "1. CONTENT PURPOSE & BRAND VOICE" above. These rules are MANDATORY and apply to guide topics.
	•	All brand placement rules and frequency rules from section "1. CONTENT PURPOSE & BRAND VOICE" apply to guide topics.
	•	For guide topics specifically: You may optionally create one very short subsection (within the main body) showing how [[BRAND_NAME]] helps solve a specific problem discussed in that section (not a hard ad, just a natural mention as part of the solution discussion).
	•	Always focus on how the brand helps the reader solve a concrete problem discussed in the article, not on "buy now" copy.
	•	Brand mentions should feel like natural solutions to problems, not like advertising inserted at the end.
	4.	Conclusion
	•	Short, concrete recap with 1-3 key takeaways or next steps.
	•	Avoid clichés like "in conclusion", "in today's digital world", "at the end of the day".
	•	If [[TOPIC_BRIEF]] requests a specific type of closing (for example "give next steps"
or "end with a short checklist"), follow that as long as it stays concise.

================================
5. COMMERCIAL BRANDED LINK LOGIC

The commercial anchor is independent from [[BRAND_NAME]].
	1.	If anchor text OR URL are invalid
(empty, placeholder like "Enter anchor text", or URL is empty / "https://example.com" / whitespace only):
	•	You MUST NOT insert any commercial anchor placeholder at all.
	•	You MUST NOT use [A1] placeholder.
	•	You MUST NOT guess or invent a branded link.
	•	If you see [[ANCHOR_TEXT]] or [[ANCHOR_URL]] in the prompt but they are empty/invalid,
treat the article as if no commercial link was requested.
	2.	If BOTH [[ANCHOR_TEXT]] and [[ANCHOR_URL]] are valid (non empty, not placeholders):
	•	CRITICAL - Anchor placement (MANDATORY):
	  •	You MUST place the placeholder [A1] in the FIRST 2-3 paragraphs of the article.
	  •	Do NOT place it later in the article - it must appear near the beginning.
	  •	The anchor must be in one of the first three paragraph blocks (type "p") in articleBlocks.
	•	CRITICAL - Anchor format (MANDATORY):
	  •	[[ANCHOR_TEXT]] must be a SHORT phrase (2-5 words maximum).
	  •	Use the placeholder [A1] EXACTLY as the anchor text appears (short, natural phrase).
	  •	FORBIDDEN: using long, technical anchor text that harms readability.
	  •	FORBIDDEN: using generic phrases like "click here" or "learn more".
	  •	REQUIRED: use short, natural anchor text that fits smoothly into the sentence.
	  •	Anchor text examples: brand names ("RouteNote", "Spotify"), short descriptive phrases ("recent analysis", "this tool").
	•	CRITICAL: Use [A1] placeholder only once in the whole article.
	•	The placeholder will be replaced with the actual anchor link during processing.
	•	Do not translate or modify the anchor text - the placeholder represents [[ANCHOR_TEXT]].
	•	Examples of CORRECT anchor integration:
	  ✓ "Some teams use [A1] to boost their early signals." (where [A1] = short phrase like "this tool")
	  ✓ "A breakdown on [A1] shows how smaller playlists work better." (where [A1] = brand name)
	•	Examples of INCORRECT anchor integration:
	  ✗ "To learn more about how some teams boost their early signals, you can read about it [A1]." (anchor at end, too long)
	  ✗ "Click here [A1] to discover more." (generic phrase, not natural)

================================
6. EXTERNAL SOURCES & REFERENCES

You receive a pre-filtered list of trusted external sources in [[TRUST_SOURCES_LIST]].
Each item has:
- id: "T1" | "T2" | "T3"
- url
- title
- type: "official_platform" | "stats_or_research" | "independent_media"
These sources are ALREADY validated (no promo-service competitors).

Your rules:

1. Allowed sources
- You may ONLY reference sources from [[TRUST_SOURCES_LIST]].
- NEVER invent new brands, URLs, or portals.
- If [[TRUST_SOURCES_LIST]] is empty, write the article WITHOUT external links.

2. Number of sources
- Use between 1 and 3 sources in the whole article.
- It is OK to use only 1–2 if they cover the topic well.

3. Placement rules
- Integrate sources inside the MAIN BODY of the article (not in the H1 title).
- Prefer to place sources where you:
  - mention a definition, statistic, case study, platform rule, or official guideline;
  - explain how a platform or algorithm behaves.
- Avoid putting all references in one paragraph. Spread them naturally across the body.
- Do NOT place [T1]–[T3] in the introduction or final conclusion section.

4. Anchor text & placeholders (CRITICAL - UNIVERSAL RULES)
- EXTERNAL LINKS – ANCHOR LOGIC (UNIVERSAL RULES):
  Goal: Any external link must look natural: 1–3 words that logically describe the source (platform / report / guide / blog), NOT a long phrase or full article title.

- WHERE TO PLACE THE LINK:
  When referencing an external source, first formulate a short mention:
  - platform name or brand; OR
  - short descriptor like "official guide", "recent report", "industry research".
  The clickable part must be THIS 1–3 word formulation, NOT the entire phrase around it.

- ANCHOR LENGTH:
  - Anchor = maximum 3 words.
  - FORBIDDEN to make anchor:
    - full article title;
    - long sentences;
    - half a paragraph.

- ATTACHING PLACEHOLDERS:
  - After the anchor, immediately place the source placeholder: [T1], [T2], or [T3].
  - Between anchor and placeholder — exactly ONE space.
  - Do NOT merge anchor with previous/next word: no gluing like wordanchor[T1].

- Format examples:
  - "... according to official guide [T1] the platform continues ..." (anchor = "official guide")
  - "... as recent report [T2] shows, the data indicates ..." (anchor = "recent report")
  - "... Spotify [T3] explains that ..." (anchor = "Spotify" - single word)

- WHAT NOT TO DO:
  ❌ Do NOT make anchor the full article title.
  ❌ Do NOT duplicate full title after anchor.
  ❌ Do NOT put link on entire phrase like:
     "in the overview of new platform tools <long article title> [T1]..."
     Instead, rephrase and attach link to short source descriptor.

- For each reference:
  - Choose a short, natural anchor (1–3 words MAXIMUM), for example:
    - "Spotify" (single word)
    - "official guide" (2 words)
    - "recent industry report" (3 words)
  - Then attach the placeholder [T1], [T2], or [T3] IMMEDIATELY after the anchor with ONE space.
  - Do NOT use bare URLs as text.
  - Do NOT copy the full page title as anchor.
  - Anchor text length should VARY randomly: sometimes 1 word, sometimes 2-3 words.

Examples of CORRECT usage:
- "According to official guide [T1], saves and completion now drive most recommendation surfaces."
- "Recent report [T2] shows how independent artists benefit from algorithmic playlists."
- "Spotify [T3] highlights how repeat listens predict long-tail growth."

Examples of INCORRECT usage:
- "According to Spotify's official guidance for artists in 2026 [T1]..." (too long - 6 words)
- "According to official Spotify fan engagement guide published in 2025 [T1]..." (full title - FORBIDDEN)
- "According toofficial guide [T1]..." (no spaces - FORBIDDEN)

5. Consistency check before final answer
Before you output the final article, verify:
- You used at most 3 placeholders [T1]–[T3].
- Every placeholder corresponds to an existing item in [[TRUST_SOURCES_LIST]].
- Each placeholder is attached to a short, meaningful anchor phrase (not a URL, not an empty word like "here").
- References read naturally and are relevant to the surrounding sentence.
• Placeholders will be replaced with actual anchor links during processing.
• Examples of CORRECT anchor integration:
  ✓ "A breakdown on [T1] shows how smaller playlists work better." (where [T1] = "RouteNote" - short brand name)
  ✓ "Research from [T1] indicates that short form content is gaining traction." (where [T1] = "Spotify's blog" - short descriptive phrase)
  ✓ "As [T1] explains, algorithmic playlists favor consistency." (where [T1] = "YouTube Creator Academy" - short brand name)
• Examples of INCORRECT anchor integration:
  ✗ "A breakdown on https://routenote.com/blog/playlist-pitching-in-2026-what-artists-need-to-know/ shows..." (full URL)
  ✗ "A breakdown on playlist pitching in 2026 what artists need to know [T1] shows..." (too long, copied from title)
  ✗ "A breakdown on this article about playlist pitching [T1] shows..." (too generic)
• The sentence should remain clear even if you remove the placeholder.
• Do not change or clean the URL - use it EXACTLY as given in [[TRUST_SOURCES_LIST]].

Relevance rules:
	•	Use a source only if:
a) the title/snippet clearly relates to [[TOPIC_TITLE]] and [[TOPIC_BRIEF]], and
b) it adds clear value to the paragraph.
	•	If a source is about a different platform or niche than your article,
you MUST NOT use it, unless it supports a universal principle that genuinely fits your point.

If no source in [[TRUST_SOURCES_LIST]] fits the topic, write the article without external links.

================================
6.5. OUTREACH-SPECIFIC REQUIREMENTS (CRITICAL - Only if [[CONTENT_PURPOSE]] = "Guest post / outreach"):

If [[CONTENT_PURPOSE]] is "Guest post / outreach", you MUST follow these additional requirements to maximize acceptance rate:

1. AUTHORITATIVE QUOTES AND INDUSTRY STATISTICS (MANDATORY):
	•	Add 2-4 external authoritative quotes or industry statistics throughout the article where they naturally fit.
	•	These should come from [[TRUST_SOURCES_LIST]] or be referenced naturally (e.g., "According to [T1], 68% of creators report...").
	•	Include at least one strong data-point (percentage, number, research finding) in the first half of the article - this significantly increases acceptance rate.
	•	Examples of strong data-points:
	  - "A 2024 study from [T1] found that 73% of independent artists..."
	  - "Research shows that playlists with fewer than 1,000 followers generate 40% more engagement..."
	  - "Industry data indicates that creators who post consistently see a 2.5x increase in reach..."
	•	These statistics and quotes make the article more credible and link-worthy for outreach campaigns.
	•	DO NOT fabricate statistics - only use data from [[TRUST_SOURCES_LIST]] or reference them naturally if the source provides such data.

2. LINKABLE H2 HEADINGS (IMPORTANT):
	•	Keep H2 headings concise and "linkable" - aim for 4-8 words maximum.
	•	Avoid overly long H2 headings that are hard to reference or link to.
	•	Make 1-2 H2 headings shorter and more punchy to increase their linkability.
	•	Examples of good linkable H2s:
	  ✓ "Platform Algorithm Changes"
	  ✓ "Content Strategy Framework"
	  ✓ "2026 Pricing Impact"
	•	Examples of H2s that are too long (avoid):
	  ✗ "How Platform Algorithm Changes Affect Your Content Strategy in 2026"
	  ✗ "Understanding the Impact of Pricing Changes on Independent Creators"

3. STRATEGIC DATA-POINT PLACEMENT:
	•	Place at least one strong data-point (percentage, statistic, research finding) in the introduction or first major section.
	•	This immediately establishes credibility and increases the likelihood of article acceptance.
	•	The data-point should be relevant to the topic and support your main argument.
	•	If [[TRUST_SOURCES_LIST]] contains research, studies, or reports, prioritize referencing their key findings as data-points.

Remember: For outreach articles, authoritative quotes, industry statistics, and strong data-points are not optional - they are essential for link-building success and higher acceptance rates.

================================
7. HUMAN-WRITTEN STYLE AND ANTI-AI-SIGNATURE RULES (v2 – CRITICAL)

• You write like a strategist with 10+ years of real practice in [[NICHE]]. Your goal is not to sound "smart", but to sound like a practitioner who has actually shipped campaigns and made mistakes.

• Do NOT chase "perfect" structure. It is fine if the article feels a bit asymmetrical:
	– Some sections longer, some shorter.
	– Some with bullets, some only with paragraphs.
	– Not every article needs "Phase 1 / Phase 2 / Phase 3" or "Step 1 / Step 2 / Step 3".

• Allow light repetition of key terms. Humans repeat important words ("release", "playlist", "campaign") instead of forcing a new synonym every time. Do NOT mechanically replace every repeated noun or verb.

• Vary heading patterns from article to article:
	– Sometimes use direct, practical headings ("Warm up your listeners before release day").
	– Sometimes use question-style headings.
	– Avoid using the same skeleton like "Phase X (Days Y-Z): …" in many different articles.

• Bullet lists must not all look the same:
	– Mix short bullets (2–4 words) and full-sentence bullets.
	– Avoid repeating the pattern "Label: explanation" in every bullet.
	– In some sections, skip bullets completely and keep it as narrative text.

• Add small human "imperfections":
	– Occasional side notes in brackets.
	– One or two slightly informal phrases per section ("honestly", "the funny part is", "here's the catch").
	– A couple of sentences that are a bit longer and messy, like natural thinking, not textbook-perfect.

• Use 1–2 micro anecdotes or realistic snapshots per article:
	– For example: "I keep seeing artists who…", "One team I worked with tried…".
	– Keep them short, but concrete (realistic situations, not invented statistics).

• Sentence rhythm:
	– Mix very short sentences with medium and longer ones.
	– Do not let several sentences in a row have exactly the same structure.
	– It is acceptable to use a fragment for emphasis ("That's the whole point.").

• Tone:
	– Speak directly to the reader ("you", "your release", "your team").
	– Occasionally use first person ("I", "we") when you share an opinion or observation.
	– It should feel like a mentor talking, not a corporate whitepaper.

• Avoid mechanical frameworks:
	– Do not overuse words like "strategy", "framework", "step-by-step system" in tight clusters.
	– When you describe a process, you can break it into parts, but keep the wording natural, as if explaining it aloud.

• Important: do NOT over-optimise for "smartness". A slightly rough, conversational, opinionated article is better than a perfectly polished, highly symmetrical one. The text should be something a human editor might tweak, not something that already looks like a polished manual.

• Avoid generic SEO filler and overused phrases:
	– Do NOT use clichés like "in today's digital world", "in the ever-evolving landscape of…", "it's no secret that…".
	– Do NOT write empty promises like "this article will cover everything you need to know".
	– Do NOT use phrases such as "as a creator, you know that", "now more than ever", or similar boilerplate.
	– Replace them with concrete, down to earth observations.
	– Every sentence must add a specific idea: who it is for, what exact problem it solves, what angle makes it different.

AI detection evasion techniques (CRITICAL - based on perplexity and burstiness analysis):
• Maximize Perplexity (increase unpredictability and complexity):
	•	Use unexpected word choices: occasionally pick slightly less common synonyms instead of the most obvious word (e.g., "navigate" instead of "use", "tackle" instead of "solve", "unpack" instead of "explain").
	•	Vary sentence complexity: mix simple sentences with complex, multi-clause structures that show natural human thinking patterns. Include occasional long, winding sentences that reflect real thought processes.
	•	Introduce slight syntactic variations: use passive voice occasionally ("This approach was tested by many teams" instead of always "Many teams tested this"), inverted word order in questions, or parenthetical asides that break predictable patterns.
	•	Include domain-specific terminology: use niche-specific jargon naturally, as a real expert would, not just generic business terms. For example, in music: "pitch", "drop", "remix"; in HR: "ATS", "ROI of hiring", "time-to-fill".
	•	Add subtle semantic shifts: when revisiting a concept, approach it from a slightly different angle rather than repeating the same perspective. First discuss "strategies", then later refer to "tactics" or "approaches" or "frameworks".

• Minimize Burstiness (reduce word/phrase repetition within short spans):
	•	CRITICAL: Never repeat the same noun, verb, or adjective within 2-3 consecutive sentences. Use synonyms or referential phrases instead.
	•	Example: If you mention "strategy" in one sentence, use "approach", "method", "framework", "system", "playbook", or "roadmap" in the next 2-3 sentences instead.
	•	Allow light repetition of key domain terms (e.g., "release", "playlist", "campaign") as humans naturally do, but avoid mechanical repetition of generic words.
	•	When discussing the same concept multiple times, vary your phrasing: first mention "content creators", then "artists", then "creators", then "professionals in this field", then "those building an audience".
	•	Avoid repeating entire phrases verbatim: if you wrote "common mistakes" earlier, use "typical errors", "frequent pitfalls", "regular missteps", "usual traps", or "often-overlooked issues" later.
	•	Break repetitive patterns: if you used a list format in one section, switch to narrative paragraphs in the next. Vary between numbered lists, bullet points, and prose.
	•	Vary transition words: don't always use "However", "Moreover", "Additionally", "Furthermore". Mix with "That said", "On the flip side", "Here's the thing", "The catch is", "What's interesting", "Now, here's where it gets tricky".

• Linguistic diversity to avoid AI patterns:
	•	Use varied sentence starters: begin sentences with different parts of speech (nouns, verbs, adjectives, clauses, questions). Don't start multiple sentences in a row with "The", "This", "It", "You".
	•	Mix formal and informal register: occasionally drop in casual expressions or contractions where appropriate ("can't", "won't", "it's", "you're", "they've"). Balance professional tone with conversational moments.
	•	Include incomplete thoughts or fragments: short, impactful standalone phrases that add emphasis ("Here's why. This matters. Let's break it down.").
	•	Use rhetorical questions naturally: not formulaic ones ("Have you ever wondered?"), but genuine questions that reflect real curiosity or challenge assumptions ("But what if the platform changes the rules tomorrow?").
	•	Vary paragraph lengths dramatically: some single-sentence paragraphs for emphasis ("This changes everything."), others 4-5 sentences for depth. Avoid uniform paragraph lengths.
	•	Introduce unexpected analogies or metaphors: compare niche concepts to unrelated domains to show creative thinking (e.g., "Like a DJ mixing tracks, you're blending different content types").

• Pattern breaking techniques:
	•	Avoid symmetrical structures: don't create parallel lists or bullet points with identical grammatical structures (e.g., avoid "First, you need... Second, you must... Third, you should...").
	•	Break formulaic transitions: instead of always using "First... Second... Third...", mix with "Let's start with...", "Another angle...", "What's interesting here is...", "Here's a curveball...", "One thing people miss...".
	•	Vary list formats: use numbered lists, bullet points, narrative paragraphs, and mixed formats throughout different sections. Don't rely on one format.
	•	Include tangents or asides: brief digressions that a human writer might naturally include (e.g., "This reminds me of a similar situation I saw...", "One thing to watch here is...", "A quick note on this...", "Side note: this is where many creators trip up...").
	•	Mix declarative and imperative sentences: balance statements ("This works because...") with direct commands ("Try this approach", "Avoid that trap", "Test this first").

Character rules for the FINAL OUTPUT (articleBodyText):
	•	NEVER use em dash (—) or en dash (–).
	•	Use ONLY regular hyphen "-" for ranges (for example "5-10 items") or normal commas/periods for pauses.
	•	NEVER use smart quotes (" " or ' '). Use ONLY straight quotes (" " and ' ').
	•	NEVER use the ellipsis character (…). Use three dots "..." instead.
	•	NEVER use zero width spaces, non breaking spaces or any invisible Unicode characters.
	•	Use ONLY standard ASCII punctuation characters.
	•	Avoid putting single words in quotes for emphasis; use quotes only for real speech, titles or clearly marked terms.

Before final output, mentally scan articleBodyText and make sure these character rules are respected.

================================
8. SEO META AND OUTPUT FORMAT

SEO meta (without keyword lists):

• Create an SEO title tag (max 60 characters)
that matches the search intent of [[TOPIC_TITLE]],
fits [[NICHE]] and looks attractive in search results.

• Create a meta description (150-160 characters) with at least one number.
Use regular hyphen "-" for any ranges.

If [[TOPIC_BRIEF]] explicitly contains important phrases or questions,
integrate them naturally, but do not force awkward repetitions.

Technical format:
• All output must be in [[LANGUAGE]].
• Return a valid JSON object with EXACTLY this structure:

{
"titleTag": "…",
"metaDescription": "…",
"articleBlocks": [ ... ]
}

• articleBlocks rules (CRITICAL):
	• articleBlocks MUST be an array and MUST start with { "type": "h1", "text": "..." }.
	• Allowed block types:
	  • "h1","h2","h3","h4","p" with field "text"
	  • "ul","ol" with field "items": ["..."]
	  • "table" with fields:
	    • optional "caption": "..."
	    • "headers": ["...","..."]
	    • "rows": [["...","..."], ["...","..."]]
	• All texts/items/cells MUST be plain text only (NO HTML tags).
	• Use **bold** or *italic* markdown-style formatting inside text fields (will be converted to HTML later).
	• CRITICAL - Bold formatting rules:
	  • Use bold (**text**) SPARINGLY - only for key terms, important concepts, or emphasis where it adds real value.
	  • DO NOT overuse bold formatting in regular paragraphs - it should appear in 1-3 places maximum per paragraph.
	  • Avoid making entire sentences or multiple consecutive words bold - this looks unprofessional and spammy.
	  • Bold is best used for: technical terms on first mention, key metrics/numbers, or important warnings.
	  • In normal body text, prefer natural emphasis through sentence structure rather than excessive bold formatting.
	• Tables (CRITICAL - only when topic/brief requires it):
	  • Tables are OPTIONAL and should be used ONLY when the topic ([[TOPIC_TITLE]]) or brief ([[TOPIC_BRIEF]]) explicitly requires comparison, structured data, or tabular information.
	  • DO NOT create tables just to fill space or because you think they look professional.
	  • Examples of when tables make sense: comparing platform features, pricing tiers, step-by-step timelines with dates, side-by-side tool comparisons, structured checklists with multiple columns.
	  • If the topic is narrative, tutorial, or opinion-based, DO NOT include tables - use paragraphs, lists, or headings instead.
	  • Maximum: 0-2 tables per article, and only if genuinely needed based on [[TOPIC_BRIEF]].
	  • Keep cells short and practical.
	• CRITICAL - Link placeholders:
	  • Commercial anchor: use [A1] placeholder exactly once (and only once).
	  • Trust sources: use [T1], [T2], [T3] placeholders (1-3 total) inside natural sentences.
	  • DO NOT include actual URLs or HTML <a> tags anywhere.
	• Do NOT wrap the JSON in code fences/backticks/markdown.

PRACTICAL POST-GENERATION CHECK (for human QA):

After generating the article, perform a quick human QA:
	1.	Review one H2 block and:
	•	Remove 1-2 overly "academic" sentences.
	•	Add one micro-comment from yourself ("honestly, most people mess this up" or similar vibe) – in English, but with that casual tone.
	2.	If you see perfect "Phase 1/2/3" structure with identical formatting – regenerate that section with instruction:
"Rewrite this section in a more narrative, slightly messy paragraph style, with fewer formal subheadings and more conversational flow."
	3.	For the most important articles – run a "plain text rewrite" through your Human Rewrite Mode (second prompt designed for plain text).

Note: This check is a reminder for post-processing. Focus on generating naturally human-sounding content from the start.

FINAL VERIFICATION BEFORE OUTPUT:
• Confirm the article clearly matches [[TOPIC_TITLE]] and [[TOPIC_BRIEF]].
• Check that the chosen structure (list or guide) follows the rules above and respects [[CONTENT_PURPOSE]].
• Ensure word count is within 90-115% of [[WORD_COUNT]] and does NOT exceed [[WORD_COUNT_MAX]] words (counted as plain text across all text in articleBlocks).
• CRITICAL - Brand integration verification: 
  - If [[BRAND_NAME]] is provided and NOT empty/NONE: Verify that [[BRAND_NAME]] is mentioned according to the brand integration rules for your content purpose (see section "1. CONTENT PURPOSE & BRAND VOICE"):
    * "Blog": Guide topics - 2-3 mentions max; List topics - one short mention in final paragraph ONLY.
    * "Guest post / outreach": 1-2 light mentions in main body sections.
    * "Partner blog": Guide topics - 2-3 mentions; List topics - one short mention in final paragraph ONLY.
    * "Educational guide" / "News Hook" / "Other": 0-1 subtle mention if natural.
  - Brand mentions should appear in MAIN BODY sections (not just intro/conclusion) and feel natural, not like advertising.
  - If [[BRAND_NAME]] is empty/NONE/placeholder: Verify that NO client brands are mentioned (only generic platforms like Spotify, YouTube, TikTok when part of factual topic).
• If [[ANCHOR_TEXT]] and [[ANCHOR_URL]] are valid, check that the [A1] placeholder appears exactly once in the first 2-3 paragraphs.
• Confirm that you used 0-3 relevant trust source placeholders ([T1], [T2], [T3]) from [[TRUST_SOURCES_LIST]].
[[EXACT_KEYWORDS_VERIFICATION]]
• Scan all block texts/items/cells for forbidden characters (em dash, en dash, smart quotes, ellipsis character) and remove or replace them.
• The article feels slightly rough and conversational, not perfectly polished – like something a human editor might tweak.
• Make sure there is NO extra text outside the JSON object.

Now generate ONLY the JSON object, nothing else.
`.trim();

/**
 * DIRECT ARTICLE CREATION MODE - Build article prompt from direct topic title
 * 
 * This function is EXCLUSIVELY for Direct Article Creation Mode.
 * DO NOT use this for Topic Discovery Mode.
 * 
 * @throws Error if niche is missing
 */
export function buildDirectArticlePrompt(params: DirectArticlePromptParams): string {
  let prompt = DIRECT_ARTICLE_PROMPT_TEMPLATE;

  // Validate niche - it's required
  if (!params.niche || !params.niche.trim()) {
    throw new Error("Niche is required. Please fill it in Project basics.");
  }

  // Replace placeholders
  prompt = prompt.replaceAll("[[TOPIC_TITLE]]", params.topicTitle);
  prompt = prompt.replaceAll("[[TOPIC_BRIEF]]", params.topicBrief);
  prompt = prompt.replaceAll("[[NICHE]]", params.niche.trim());
  prompt = prompt.replaceAll("[[MAIN_PLATFORM]]", params.mainPlatform || "multi-platform");
  prompt = prompt.replaceAll("[[CONTENT_PURPOSE]]", params.contentPurpose || "Guest post / outreach");
  prompt = prompt.replaceAll("[[ANCHOR_TEXT]]", params.anchorText || "");
  prompt = prompt.replaceAll("[[ANCHOR_URL]]", params.anchorUrl || "");
  // Only replace with "NONE" if brandName is truly empty/undefined, not if it's an empty string from user input
  const brandNameValue = (params.brandName && params.brandName.trim()) ? params.brandName.trim() : "NONE";
  console.log("[buildDirectArticlePrompt] Brand name processing:", {
    original: params.brandName,
    processed: brandNameValue,
    isEmpty: !params.brandName || params.brandName.trim().length === 0,
    willReplaceWith: brandNameValue,
  });
  
  // Count occurrences of [[BRAND_NAME]] in prompt BEFORE replacement
  const brandPlaceholderCountBefore = (prompt.match(/\[\[BRAND_NAME\]\]/g) || []).length;
  console.log("[buildDirectArticlePrompt] Brand placeholder count BEFORE replacement:", brandPlaceholderCountBefore);
  
  prompt = prompt.replaceAll("[[BRAND_NAME]]", brandNameValue);
  
  // Count occurrences of [[BRAND_NAME]] in prompt AFTER replacement (should be 0)
  const brandPlaceholderCountAfter = (prompt.match(/\[\[BRAND_NAME\]\]/g) || []).length;
  const brandValueCountAfter = (prompt.match(new RegExp(brandNameValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  
  console.log("[buildDirectArticlePrompt] Brand replacement verification:", {
    placeholderCountAfter: brandPlaceholderCountAfter,
    brandValueCountAfter: brandValueCountAfter,
    allReplaced: brandPlaceholderCountAfter === 0,
    brandValueAppearsInPrompt: brandValueCountAfter > 0,
    brandValueUsed: brandNameValue !== "NONE" ? `${brandNameValue} appears ${brandValueCountAfter} times` : "Brand set to NONE (no brand mentioned)",
  });
  
  // Log a sample of prompt to verify brand integration instructions are present (before replacement)
  // After replacement, check for brand instructions that mention the brand value or NONE
  const brandInstructionsAfter = prompt.match(/Brand.*?integration/i) || prompt.match(/Client.*?brand/i) || prompt.match(/brand.*?presence/i);
  if (brandInstructionsAfter) {
    console.log("[buildDirectArticlePrompt] Brand integration instructions found (after replacement, sample):", brandInstructionsAfter[0].substring(0, 500));
    
    // Check if brand value appears in brand-related sections
    const brandMentionSections = prompt.match(/Brand[\s\S]{0,500}/gi) || [];
    const brandMentionCount = brandMentionSections.reduce((count, section) => {
      return count + (section.includes(brandNameValue) ? 1 : 0);
    }, 0);
    console.log("[buildDirectArticlePrompt] Brand value appears in brand-related sections:", {
      brandMentionCount: brandMentionCount,
      brandValue: brandNameValue,
      sectionsFound: brandMentionSections.length,
    });
  } else {
    console.warn("[buildDirectArticlePrompt] WARNING: Brand integration instructions not found in prompt!");
  }
  prompt = prompt.replaceAll("[[LANGUAGE]]", params.language || "English");
  prompt = prompt.replaceAll("[[TARGET_AUDIENCE]]", params.targetAudience || "B2C - beginner and mid-level users");
  prompt = prompt.replaceAll("[[KEYWORD_LIST]]", params.keywordList.join(", "));

  // Exact keywords block (Direct Article only): when provided, writer must include 100% of phrases with exact match
  let exactKeywordsSection = "";
  let exactKeywordsVerification = "";
  if (params.exactKeywordList && params.exactKeywordList.length > 0) {
    const list = params.exactKeywordList.map((k, i) => `${i + 1}. ${k}`).join("\n");
    const count = params.exactKeywordList.length;
    exactKeywordsSection = `
================================
MANDATORY EXACT KEYWORDS (100% INCLUSION - CRITICAL)
================================
• 100% INCLUSION REQUIRED: Every single phrase below MUST appear in the article verbatim. None may be skipped, omitted, or replaced with a synonym or paraphrase.
• There are ${count} mandatory phrase(s). The article is INVALID if even one is missing.
• Each phrase must appear at least once with IDENTICAL wording (same characters, same order). Do not change spelling, hyphenation, or word order.
• If you cannot fit a phrase naturally in one place, add it in another (e.g. in a different paragraph or list item). Every phrase must appear somewhere.

List of exact phrases (ALL must appear in the article):
${list}

• Before writing: plan where each phrase will appear.
• Before outputting: go through the list and confirm each of the ${count} phrases appears verbatim in your article. If any is missing, add a sentence that contains it.
`;
    exactKeywordsVerification = `• CRITICAL - Exact keywords: Verify that ALL ${count} phrase(s) from the MANDATORY EXACT KEYWORDS section appear in your article with exact wording. If any phrase is missing, add it before outputting. Do NOT output until every phrase is present.\n`;
  }
  prompt = prompt.replaceAll("[[EXACT_KEYWORDS_SECTION]]", exactKeywordsSection);
  prompt = prompt.replaceAll("[[EXACT_KEYWORDS_VERIFICATION]]", exactKeywordsVerification);

  // Parse wordCount
  const wordCountStr = params.wordCount || "1500";
  const wordCountMatch = wordCountStr.match(/^(\d+)(?:-(\d+))?$/);
  let wordCountMin = 1500;
  let wordCountMax = 1500;
  
  if (wordCountMatch) {
    wordCountMin = parseInt(wordCountMatch[1]);
    wordCountMax = wordCountMatch[2] ? parseInt(wordCountMatch[2]) : wordCountMin;
  }
  const wordCountMaxAllowedDirect = Math.ceil(Math.max(wordCountMin, wordCountMax) * 1.15);

  prompt = prompt.replaceAll("[[WORD_COUNT]]", wordCountStr);
  prompt = prompt.replaceAll("[[WORD_COUNT_MAX]]", String(wordCountMaxAllowedDirect));

  // Replace writing mode (default to "seo" if not provided) - for buildDirectArticlePrompt
  const writingModeDirect = params.writingMode || "seo";
  prompt = prompt.replaceAll("[[WRITING_MODE]]", writingModeDirect);
  
  // Format trust sources - prefer JSON format if available, otherwise use old format
  let trustSourcesFormatted = "";
  if (params.trustSourcesJSON) {
    // Use new structured JSON format
    trustSourcesFormatted = params.trustSourcesJSON;
  } else if (params.trustSourcesList.length > 0) {
    // Fallback to old "Name|URL" format for backward compatibility
    trustSourcesFormatted = params.trustSourcesList.join(", ");
  }
  
  // Add explicit placeholder mapping with anchor text descriptions (if trustSourcesSpecs provided)
  let placeholderMappingBlock = "";
  if (params.trustSourcesSpecs && params.trustSourcesSpecs.length > 0) {
    placeholderMappingBlock = `\n\nEXTERNAL SOURCE PLACEHOLDERS - Use these EXACT placeholders:\n${params.trustSourcesSpecs.map(ts => `- [${ts.id}]: ${ts.text} (URL: ${ts.url})`).join('\n')}\n\nCRITICAL INSTRUCTIONS FOR USING PLACEHOLDERS:\n• You have ${params.trustSourcesSpecs.length} external source(s) available.\n• Use 1-${params.trustSourcesSpecs.length} of these in your article.\n• When you reference them, DO NOT write any URLs.\n• Instead, insert the placeholders [${params.trustSourcesSpecs.map(ts => ts.id).join('], [')}] directly into the sentence.\n• Each placeholder must be part of a natural sentence, with a short 2-5 word anchor phrase that describes the source.\n• The anchor phrase should match the description provided (e.g., "[T1]" should be used where "${params.trustSourcesSpecs[0]?.text || 'the source'}" would naturally appear).\n• Example: "Research from [T1] indicates that..." (where [T1] represents "${params.trustSourcesSpecs[0]?.text || 'the source'}").\n• DO NOT use more than ${params.trustSourcesSpecs.length} placeholders total.\n• Placeholders must be spread across the middle parts of the article, not all in one sentence.\n• NEVER invent new sources or URLs - use ONLY the placeholders provided above.\n`;
  }
  
  // Build verification block - use JSON format if available
  let sourcesVerificationBlock = "";
  if (params.trustSourcesJSON) {
    // Parse JSON to show structured sources
    try {
      const sources = JSON.parse(params.trustSourcesJSON);
      sourcesVerificationBlock = `\n\nVERIFICATION LIST - Use ONLY these pre-filtered sources (already validated, no competitors):\n${sources.map((s: any, i: number) => `${i + 1}. [${s.id}] ${s.title} (${s.type}) - ${s.url}`).join('\n')}\n\nCRITICAL: These sources are already pre-filtered and validated. You may ONLY use sources from this list. If no sources are relevant to your topic, write the article WITHOUT external links.\n`;
    } catch (e) {
      // Fallback if JSON parsing fails
      sourcesVerificationBlock = params.trustSourcesList.length > 0
        ? `\n\nVERIFICATION LIST - Use ONLY these exact URLs:\n${params.trustSourcesList.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCRITICAL: Before using ANY external link, verify that its URL matches EXACTLY one entry above.\n`
        : "\n\nVERIFICATION LIST: [[TRUST_SOURCES_LIST]] is empty. Write the article WITHOUT any external links.\n";
    }
  } else {
    sourcesVerificationBlock = params.trustSourcesList.length > 0
      ? `\n\nVERIFICATION LIST - Use ONLY these exact URLs (verify each link before using):\n${params.trustSourcesList.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCRITICAL: Before using ANY external link in your article, verify that its URL matches EXACTLY one entry above. If it doesn't match, DO NOT use it. If no sources are relevant to your topic, write the article WITHOUT external links.\n`
      : "\n\nVERIFICATION LIST: [[TRUST_SOURCES_LIST]] is empty. Write the article WITHOUT any external links.\n";
  }
  
  prompt = prompt.replaceAll("[[TRUST_SOURCES_LIST]]", trustSourcesFormatted + placeholderMappingBlock + sourcesVerificationBlock);

  return prompt;
}
