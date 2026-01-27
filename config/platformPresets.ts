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
  it: [
    "Web app",
    "Mobile app",
    "API product",
    "Developer tools",
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
  vpn: ["VPN app", "Browser extension"],
  hr: ["HR SaaS", "ATS platform", "Job board"],
  default: [],
};

/**
 * Maps "Main niche or theme" display values (preset labels) to keys in PLATFORM_PRESETS.
 * When user picks a niche preset, we use this to choose which platform presets to show.
 * When user types a custom niche (no preset), we use PLATFORM_PRESETS.default.
 */
export const NICHE_TO_PRESET_KEY: Record<string, string> = {
  "Music industry": "music_industry",
  "Social media / SMM": "social_media",
  IT: "it",
  "Med tech": "med_tech",
  "Mil tech": "mil_tech",
  Casino: "casino",
  Gambling: "gambling",
  VPN: "vpn",
  HR: "hr",
};

/** Ordered list of niche preset labels for the "Main niche or theme" chips. */
export const NICHE_PRESET_LABELS: string[] = [
  "Music industry",
  "Social media / SMM",
  "IT",
  "Med tech",
  "Mil tech",
  "Casino",
  "Gambling",
  "VPN",
  "HR",
];
