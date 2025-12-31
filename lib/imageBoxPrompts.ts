// lib/imageBoxPrompts.ts
// Image Box Prompts / Components for hero image generation
// Each component defines a specific visual style and approach for generating article hero images

export interface ImageBoxPrompt {
  /**
   * Unique identifier for this image box component
   */
  id: string;
  
  /**
   * Human-readable name for this component
   */
  name: string;
  
  /**
   * Short description of the visual style/approach
   */
  description: string;
  
  /**
   * Detailed prompt template for image generation
   * Supports placeholders: [[ARTICLE_TITLE]], [[NICHE]], [[MAIN_PLATFORM]], [[BRAND_NAME]]
   */
  promptTemplate: string;
}

/**
 * Collection of Image Box Prompts / Components
 * Each component provides a detailed reference for how to create the image
 * 
 * Components will be populated with detailed prompts provided by the user
 * Placeholders in prompts:
 * - [[ARTICLE_TITLE]] - The article title
 * - [[NICHE]] - The niche/topic area
 * - [[MAIN_PLATFORM]] - The main platform (e.g., "Spotify", "YouTube", "TikTok")
 * - [[BRAND_NAME]] - The brand name (optional)
 */
export const IMAGE_BOX_PROMPTS: ImageBoxPrompt[] = [
  {
    id: "bw_photo_color_collage_character",
    name: "B&W portrait + colorful collage overlay",
    description: "Hybrid editorial collage with high-contrast black-and-white photographic portrait and bold colorful illustrated/collage elements",
    promptTemplate: `Hybrid editorial collage.

BASE STYLE:
- High-contrast black-and-white photographic portrait as the main subject.
- Single person, waist-up or chest-up, centered or slightly off-center.
- Minimal background: dark or nearly black backdrop with soft vignette, subtle film grain.
- Focus is on the character, not on the environment.

COLOR COLLAGE LAYER:
- Add 1–3 bold, colorful illustrated or collage elements on top of the B&W photo.
- These elements can be, for example:
  - bright cartoon-style headphones
  - a vibrant portable music player or cassette
  - abstract colorful mask over the eyes
  - Warhol-like poster fragment intersecting with the face or body
  - flowing graphic shapes wrapping around part of the character
- The model should choose a small combination of these treatments each time so every image feels different.
- Keep shapes clean, modern, slightly surreal, with smooth curves and simple geometry.

COLOR PALETTE:
- Strong contrast against the monochrome photo: deep reds, electric blues, vivid cyans, rich violets, warm oranges, off-white.
- Use 2–4 main accent colors only, no gradients with gold or teal/orange clichés.
- Background stays dark and minimal; color lives mostly in the collage pieces.

PLATFORM INTEGRATION:
- If the [[MAIN_PLATFORM]] logo appears, integrate it as a tiny abstract element inside the collage:
  on a sticker, small badge on the player, subtle symbol on a mask or object.
- The logo must feel like part of the collage, not a separate overlay.
- No visible text labels or words anywhere on the image.

COMPOSITION:
- Character remains the main focal point, occupying 50–70% of the frame.
- Color elements sit on or around the character, guiding the eye to the face or gesture.
- Asymmetric layout with generous negative space and a clear hierarchy.
- Everything should feel like a high-end magazine cover collage: minimal, sharp, stylish.

MOOD:
- Modern, edgy, slightly surreal mix of real photography and bold illustration.
- Feels like an artful visual for music, youth culture, or digital creators, not a stock photo or generic AI art.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
];

/**
 * Replace placeholders in prompt template with actual values
 */
export function buildImagePromptFromBox(
  boxPrompt: ImageBoxPrompt,
  params: {
    articleTitle: string;
    niche: string;
    mainPlatform: string;
    brandName: string;
  }
): string {
  let prompt = boxPrompt.promptTemplate;
  
  prompt = prompt.replaceAll("[[ARTICLE_TITLE]]", params.articleTitle);
  prompt = prompt.replaceAll("[[NICHE]]", params.niche);
  prompt = prompt.replaceAll("[[MAIN_PLATFORM]]", params.mainPlatform);
  prompt = prompt.replaceAll("[[BRAND_NAME]]", params.brandName || "");
  
  return prompt.trim();
}

/**
 * Select a random Image Box Prompt component based on article title hash
 * This ensures consistent selection for the same article title
 */
export function selectImageBoxPrompt(articleTitle: string): ImageBoxPrompt {
  if (IMAGE_BOX_PROMPTS.length === 0) {
    throw new Error("IMAGE_BOX_PROMPTS array is empty. Please add image box prompt components.");
  }
  
  // Deterministic hash-based selection for consistency
  const hash = articleTitle
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const index = Math.abs(hash) % IMAGE_BOX_PROMPTS.length;
  return IMAGE_BOX_PROMPTS[index];
}

