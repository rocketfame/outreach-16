/**
 * Platform presets per niche. Used by "Main platform focus" to show
 * relevant quick-entry options based on "Main niche or theme".
 * Keys must match NICHE_TO_PRESET_KEY values (see below).
 */
export const PLATFORM_PRESETS: Record<string, string[]> = {
  music_industry: [
    "Spotify",
    "YouTube",
    "TikTok",
    "Instagram",
    "SoundCloud",
    "Beatport",
    "Deezer",
    "Tidal",
  ],
  social_media: [
    "TikTok",
    "Instagram",
    "YouTube",
    "Facebook",
    "X (Twitter)",
    "LinkedIn",
  ],
  creator_growth: [
    "TikTok",
    "Instagram",
    "YouTube",
    "Spotify",
    "Newsletter",
    "Community",
  ],
  ecommerce: [
    "Shopify",
    "Amazon",
    "Etsy",
    "WooCommerce",
    "Marketplace",
    "DTC store",
  ],
  saas: [
    "B2B SaaS",
    "Product-led growth",
    "CRM",
    "Analytics platform",
    "Workflow automation",
  ],
  ai_tools: [
    "AI writing tool",
    "AI image tool",
    "AI assistant",
    "Automation platform",
    "No-code AI app",
  ],
  cybersecurity: [
    "Security SaaS",
    "Password manager",
    "Endpoint security",
    "Compliance platform",
    "Privacy tool",
  ],
  fintech: [
    "Banking app",
    "Payments",
    "Crypto platform",
    "Budgeting app",
    "Trading app",
  ],
  med_tech: [
    "Med app",
    "Telehealth platform",
    "EHR system",
  ],
  mil_tech: [
    "Defense SaaS",
    "Simulation platform",
    "Hardware + software stack",
  ],
  casino: [
    "Casino brand",
    "Sportsbook",
    "Slots",
    "Poker room",
  ],
  gambling: [
    "Casino brand",
    "Sportsbook",
    "Slots",
    "Poker room",
  ],
  igaming: [
    "Casino",
    "Sportsbook",
    "Slots",
    "Poker",
    "Affiliate portal",
  ],
  vpn: ["VPN app", "Browser extension", "Privacy app", "Secure DNS"],
  hr: ["HR SaaS", "ATS platform", "Job board", "Recruiting platform", "Employee engagement"],
  astrology_spirituality: [
    "Astrology app",
    "Tarot",
    "Spiritual coaching",
    "Meditation app",
    "Wellness community",
    "Personal growth",
  ],
  default: [],
};

/**
 * Maps "Main niche or theme" display values (preset labels) to keys in PLATFORM_PRESETS.
 * When user picks a niche preset, we use this to choose which platform presets to show.
 * When user types a custom niche (no preset), we use PLATFORM_PRESETS.default.
 */
export const NICHE_TO_PRESET_KEY: Record<string, string> = {
  "Music industry": "music_industry",
  "Creator growth": "creator_growth",
  "Social media / SMM": "social_media",
  "Social media marketing": "social_media",
  IT: "saas",
  "Software / IT": "saas",
  Ecommerce: "ecommerce",
  SaaS: "saas",
  "AI tools": "ai_tools",
  Cybersecurity: "cybersecurity",
  Fintech: "fintech",
  "Med tech": "med_tech",
  "Mil tech": "mil_tech",
  Casino: "casino",
  Gambling: "gambling",
  iGaming: "igaming",
  VPN: "vpn",
  "VPN / Privacy": "vpn",
  HR: "hr",
  "HR / Recruiting": "hr",
  "Astrology / Spirituality": "astrology_spirituality",
};

/** Ordered list of niche preset labels for the "Main niche or theme" chips. */
export const NICHE_PRESET_LABELS: string[] = [
  "Music industry",
  "Creator growth",
  "Social media marketing",
  "Ecommerce",
  "SaaS",
  "AI tools",
  "Cybersecurity",
  "Fintech",
  "Med tech",
  "HR / Recruiting",
  "VPN / Privacy",
  "iGaming",
  "Astrology / Spirituality",
];
