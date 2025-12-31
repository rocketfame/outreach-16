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
  {
    id: "retro_futuristic_space_studio",
    name: "Retro-futuristic space studio",
    description: "Cinematic retro-futuristic studio scene with character in futuristic helmet, vintage audio gear, and deep space background",
    promptTemplate: `Retro-futuristic "space studio" hero image for the article "[[ARTICLE_TITLE]]". Niche: [[NICHE]], Platform: [[MAIN_PLATFORM]].

Overall look:
- Cinematic 16:9 horizontal composition, like a movie still.
- One main character sitting in a retro-futuristic studio: big vintage audio gear, CRT monitors, synths, control panels, cables, soft bags on the floor.
- Deep space background with 1–2 large planets or moons and smooth atmospheric gradients.

Character:
- Human in a futuristic helmet or visor with a glowing strip, wearing casual modern clothes (jeans, sneakers, bomber jacket, hoodie, etc.).
- Pose shows confusion or overthinking: leaning forward, slouched, looking at a device, holding helmet, or resting arms on knees.
- Vary gender, body type and ethnicity between generations.

Platform logo integration:
- Integrate the [[MAIN_PLATFORM]] logo only as part of the environment:
  - on one of the CRT screens,
  - or as a small hologram above a device,
  - or as a subtle glowing icon on the helmet.
- The logo must look like a luminous UI element, not a flat pasted sticker, and must not dominate the frame.
- No other text or words on the image.

Mood and colors:
- Retro-sci-fi mood: analog studio hardware mixed with futuristic details.
- Color palette: deep violets, dark blues, and magentas with neon accents (cyan, hot pink, electric violet) and smooth gradients in the background.
- Strong contrast between dark studio and glowing screens, visor, and planets.

Details and variability:
- Optional glowing abstract "question" symbol above the character's head (no readable text).
- Devices can vary (sampler, drum machine, keyboard, mixing console, CRT stacks), but always arranged as a coherent studio.
- No UI text, captions, or legible words anywhere.

Style and quality:
- High-end digital illustration or polished 3D render with soft cinematic lighting.
- Not childish, not low-poly, not isometric 3D.
- Premium creative-agency quality visual, suitable as a hero banner for a professional article.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "minimalist_conceptual_poster_bike",
    name: "Minimalist conceptual poster with bike",
    description: "Clean minimalist poster with motorbike launching from abstract logo symbol, engagement trail icons, and pastel background",
    promptTemplate: `Minimalist conceptual poster for the article "[[ARTICLE_TITLE]]". Niche: [[NICHE]], Platform: [[MAIN_PLATFORM]].

Overall look:
- Clean 16:9 horizontal composition with a single bold scene in the center.
- Flat or slightly textured illustration, NOT 3D, NOT photorealistic.
- Huge, thick, black abstract symbol on the bottom (inspired by the [[MAIN_PLATFORM]] logo shape but simplified, no text, no trademark details).
- A motorbike or scooter launching off this symbol like a ramp.

Character:
- One rider on the bike in mid-air, dynamic pose (jumping, leaning forward, wheel slightly up).
- Rider in simple clothes or light gear, helmet with dark visor (no visible face).
- Gender, body type and outfit can vary each time, but always readable and modern.

Engagement trail:
- From the back wheel or exhaust, a stream of small colorful social icons:
  - abstract hearts, thumbs-up, stars, speech bubbles, reaction blobs.
  - No platform-specific icons with letters, just recognizable engagement shapes.
- Icons are scattered in different sizes, creating a feeling of speed and "viral boost".

Background and colors:
- Solid or very gently textured pastel background (lavender, soft blue, mint, or similar).
- High contrast between the black logo shape, the rider, and the pastel background.
- Icons in bright candy colors (pink, cyan, yellow, light blue, soft red) that pop on the background.

Composition:
- Large empty negative space around the scene to keep it calm and premium.
- Main action placed slightly above center, logo-ramp anchored at the bottom.
- No other objects, no horizon line, no extra environment.

Brand and text rules:
- [[MAIN_PLATFORM]] is represented only through the abstract logo shape and engagement idea, not with text.
- Absolutely NO words, letters, or readable text anywhere on the image.
- No UI elements or screenshots.

Style and quality:
- Editorial poster style, clean lines, crisp shapes, slightly comic-book or graphic-novel inspired.
- Professional, witty, conceptual visual that would work as a hero banner on a design-forward website.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "velocity_poster",
    name: "Velocity Poster",
    description: "Dynamic minimalist poster with moving subject, abstract platform symbol, and colorful engagement trail on pastel background",
    promptTemplate: `BOX 4 – "Velocity Poster"

Goal:
Create a dynamic minimalist poster-style hero image for the article "[[ARTICLE_TITLE]]" (niche: [[NICHE]], platform: [[MAIN_PLATFORM]]). The image should express speed, growth, and a burst of social engagement in a clean, iconic way.

Core visual system (framework, NOT a fixed scene):
- One main subject moving diagonally across the canvas (the model can choose: motorcycle, BMX, futuristic scooter, hoverboard, rocket board, running or jumping character, etc.).
- The subject is always interacting with a huge flat black [[MAIN_PLATFORM]]-inspired symbol near the bottom of the frame (standing on it, jumping from it, riding over it, using it as a ramp, etc.).
- Behind the subject there is a flowing "wake" or trail made from many small colorful abstract engagement symbols (hearts, likes, comment bubbles, stars, music notes, arrows, etc.). The exact shapes, density, and pattern of this trail must be varied every time.

Global style rules for BOX 4:
- Clean vector / comic-ink line style with flat or very simple shading.
- Background: single solid pastel color from a soft palette (lavender, mint, light cyan, soft peach, light yellow, etc.). Each generation can use a different pastel tone.
- Strong use of negative space: big empty background, compact central composition.
- High-contrast silhouettes: the moving subject and the black platform symbol are the main dark shapes against the pastel background.
- Color accents: the vehicle/character and engagement trail use 2–4 vivid accent colors (for example electric blue, coral, magenta, lemon yellow) that can change each time.
- No UI, no device frames, no dashboards, no cityscapes, no extra props that clutter the scene.

Variation parameters (LLM/image model SHOULD actively randomize within these bounds):
- Type of motion medium (bike, scooter, board, rocket, futuristic vehicle, running character, etc.).
- Pose of the subject (leaning forward, mid-jump, wheelie, drifting, sharp turn, etc.).
- Direction of movement (left-to-right or right-to-left).
- Shape and density of the engagement trail (long arc, short burst, scattered particles, tight stream, etc.).
- Background pastel color and accent color combination.
- Camera angle (slightly low angle, side view, or 3/4 view) while staying simple and not isometric.

Brand and platform integration:
- [[MAIN_PLATFORM]] is represented only through the large abstract black symbol and overall social-media energy, not through exact copyrighted logos.
- [[BRAND_NAME]] mood is conveyed subtly via color choices and confident graphic style; no visible brand text.

Hard constraints:
- Absolutely NO text or lettering on the image at all.
- NO isometric 3D; if depth is present, keep it simple, mostly flat graphic perspective.
- NO realistic screenshots, UI elements, buttons, or interface modules.
- Character faces can be stylized, masked, visor-covered, or abstract to avoid real-person likeness.

Format:
- 16:9 horizontal hero image, optimized for web article headers, with the composition centered and plenty of clean margin.

Result:
Every time BOX 4 is used, the model must produce a new "velocity poster" that follows this visual system but changes the subject, pose, colors, and engagement trail details, so images feel related in style but never identical.

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

