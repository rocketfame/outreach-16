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
    id: "ink_wash_action_ninja_illustration",
    name: "Ink-wash action character",
    description: "Energetic watercolor/ink sketch of a dynamic character in motion, textured paper, loose linework, and bold brush accents",
    promptTemplate: `BOX 25 – "Ink-wash action character"

Goal:
Create a dynamic watercolor/ink hero illustration inspired by a hand-drawn sketch: expressive linework, loose brush strokes, and motion energy. The result should feel like a premium editorial illustration, not a kids' cartoon or generic AI art.

Core style rules:
- Watercolor + ink sketch look with visible paper texture (off-white, slightly warm).
- Loose, expressive linework with imperfect edges and hand-drawn energy.
- Broad brush accents and paint drips/splashes to suggest motion.
- Palette: muted teal/blue + warm coral/orange accents, with a few punchy highlights.

Character and action:
- One dynamic character in mid-action (leaping, twisting, striking), captured with strong motion lines.
- Outfit can be stylized (mask, scarf, layered clothing, light armor, sports gear), but keep it editorial and tasteful.
- Use ONE prop related to the topic if it makes sense (e.g., racket, mic, camera, headset), drawn as part of the sketch.
- Emphasize energy and flow (fabric trails, swooshes, diagonal composition).

Background:
- Minimal background; mostly blank paper.
- Add vertical paint washes or abstract strokes behind the character for depth.
- No detailed scenery or environment.

Brand/platform integration:
- If [[MAIN_PLATFORM]] needs to be referenced, hint at it with an abstract shape or color cue only.
- No readable text, logos, or UI elements.

Context:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

Format:
- 16:9 horizontal hero image, subject centered or slightly off-center, with ample negative space.
- Professional quality, editorial illustration feel.`
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
    id: "signal_hands",
    name: "Signal Hands",
    description: "Bold minimalist hero image with stylized hands (robotic/cybernetic/human) and abstract platform symbols on clean background",
    promptTemplate: `BOX 3 – "Signal Hands"

Goal:
Create a bold, minimalist hero image for the article "[[ARTICLE_TITLE]]" (niche: [[NICHE]], platform: [[MAIN_PLATFORM]]) built around expressive hands and social-media symbols.

Core visual system (style framework, NOT a fixed scene):
- 1–4 large stylized hands rising from the bottom or sides of the frame.
- Hands can be robotic, cybernetic, gloved, or slightly futuristic human – always graphic and stylized, not photorealistic.
- Each hand shows a different gesture (peace sign, rock sign, pointing, open palm, fist, etc.) and interacts with abstract [[MAIN_PLATFORM]]-inspired symbols (holding them, pinching them, lifting them up, or having them attached like antennas).
- Symbols are simple black or dark abstract shapes that clearly hint at the platform but are not exact copyrighted logos.

Global style rules:
- Clean vector / comic-ink look with crisp outlines and flat or very simple shading.
- Strong negative space: most of the background is empty and clean.
- Background is solid light or white (off-white, very pale pastel, or pure white).
- Hands use 2–4 strong contrasting colors (for example cyan, magenta, electric blue, soft pink, lemon yellow). Hands can have different colors from each other.
- Mechanical details on hands (joints, screws, tiny LEDs) are allowed but must remain graphic and readable, not cluttered.

Variation parameters (the model SHOULD randomize inside these rules):
- Number of hands (1–4) and their positions (centered column, diagonal composition, spread across width, etc.).
- Gestures for each hand.
- Color assigned to each hand.
- Presence and exact position of [[MAIN_PLATFORM]]-inspired symbols on or around the hands.
- Perspective (front view, slight 3/4 tilt, slight low angle) while keeping the overall image mostly flat, not isometric.

Brand / mood:
- [[BRAND_NAME]] mood is conveyed only through bold color combinations and confident graphic style, never through text.
- Overall feel: energetic, rebellious, "creator culture", but still clean and editorial.

Hard constraints:
- Absolutely NO text or lettering on the image.
- NO isometric 3D cubes or dashboards.
- NO full UI, screens, buttons, or device frames.
- Avoid crowded backgrounds – the focus must stay on hands and symbols.

Format:
- 16:9 horizontal hero image, with the main group of hands roughly in the center and plenty of breathing space around.

Result:
Every time BOX 3 is used, the model produces a new "signal hands" composition that follows this graphic system but changes the number of hands, gestures, colors, and arrangement, so images feel related in style but never identical.

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
  {
    id: "pixel_creature_vault",
    name: "Pixel Creature Vault",
    description: "Playful pixel-art hero image with quirky creature guarding/interacting with digital vault and pixel particle effects on dark background",
    promptTemplate: `BOX 5 – "Pixel Creature Vault"

Goal:
Create a playful but smart pixel-art hero image for the article "[[ARTICLE_TITLE]]" (niche: [[NICHE]], platform: [[MAIN_PLATFORM]]), built around a quirky creature guarding or interacting with a digital vault.

Core visual system (style framework, NOT a fixed scene):
- One main cartoonish creature (can be dino, monster, robot, alien, animal, etc.) standing next to or on top of a simple box / vault / device that metaphorically stores [[MAIN_PLATFORM]] content or signals.
- Above or around the creature, pixel particle effects fly out of or into the box: coins, stars, hearts, icons, abstract pixels, or glitched fragments.
- The creature is expressive (wide eyes, funny grin, surprised face, mischievous look) and clearly focused on the box or the particles.

Global style rules:
- Pure 8-bit / 16-bit pixel art style with visible pixels and limited color palette.
- Dark, almost black background that creates a "void" with the character and box as the only main elements.
- Strong contrast: bright creature colors (neon reds, oranges, greens, cyans, purples) against the dark background.
- The box / vault is simple: blocky, pixelated, with one or two details (slot, handle, lock), not over-detailed.
- [[MAIN_PLATFORM]]-inspired symbol appears on the box as a simple abstract black/white emblem, not a full official logo.

Variation parameters (the model SHOULD randomize inside these rules):
- Type of creature (species, silhouette, size) and its color scheme.
- Emotion and pose: sneaking, proud, excited, confused, caught-in-the-act, etc.
- Type, number, color, and direction of pixel particles.
- Exact design of the box (tall, wide, slightly tilted, on a pedestal, etc.).
- Light source position (top, side, below) while keeping the scene simple and readable.

Brand / mood:
- [[BRAND_NAME]] mood is conveyed through edgy humor and contrast: fun character in a dark, almost cinematic void.
- Overall feel: playful, slightly rebellious "we hacked the system" energy, but still clean and minimal.

Hard constraints:
- Absolutely NO text or lettering on the image.
- NO hi-res smooth illustration – must be clearly pixel-art.
- NO complex UI, dashboards, or realistic devices.
- Keep background almost empty to maintain focus on the creature + box.

Format:
- 16:9 horizontal hero image, creature and box placed slightly off-center with plenty of negative space.

Result:
Every time BOX 5 is used, the model produces a new pixel-art "creature + vault" composition that changes creature type, pose, particles, and box design, while keeping the same dark minimal pixel-art aesthetic.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "neon_twins_solid_color",
    name: "Neon Twins On Solid Color",
    description: "Bold editorial hero image with futuristic human figures, visor glasses, and platform emblem on single loud background color",
    promptTemplate: `BOX 6 – "Neon Twins On Solid Color"

Goal:
Create a bold editorial hero image for the article "[[ARTICLE_TITLE]]" (niche: [[NICHE]], platform: [[MAIN_PLATFORM]]) built around futuristic human figures on a single, loud background color.

Core visual system (style framework, NOT a fixed scene):
- One or two stylized human figures (androgynous, fashion-like, slightly robotic) shown from waist or chest up.
- Faces and skin are monochrome / grayscale, while clothing and accessories are glossy and futuristic.
- Each figure wears oversized futuristic visor glasses / AR frames that contain bright abstract UI panels or reflections connected to [[MAIN_PLATFORM]].
- A floating circular emblem inspired by [[MAIN_PLATFORM]] appears near the heads: simplified, abstract, glowing, without exact logo copy.

Global style rules:
- Ultra-clean minimalism: large single-color background (neon pink, electric cyan, vivid orange, or deep purple).
- High contrast between grayscale faces and intense background color.
- Clothing: sleek suits with subtle sci-fi details (grid patterns, reflective vinyl, simple armor-like plates) but not cluttered.
- Overall composition remains simple: characters occupy 25–40% of frame, everything else is clean negative space.

Variation parameters (the model SHOULD randomize inside these rules):
- Number of characters (1 or 2), gender presentation, and poses (profile, 3/4 view, both looking up, mirrored, back-to-back, etc.).
- Background color choice within a small set of loud solid colors.
- Design of visor glasses: panel layout, color accents, reflection style.
- Clothing pattern: smooth, grid, slight texture changes; different necklines and silhouettes.
- Position, size, and glow of the [[MAIN_PLATFORM]]-inspired circular emblem.

Brand / mood:
- [[BRAND_NAME]] mood through confident posture, modern fashion energy, and strong use of color.
- Overall feel: stylish, editorial, slightly cyberpunk but very clean and graphic.

Hard constraints:
- Absolutely NO text or lettering on the image.
- NO realistic UI screens, dashboards, or detailed interfaces – only abstract shapes inside glasses.
- NO busy backgrounds, cityscapes, or props; the background must stay mostly flat and minimal.
- NO direct copy of any real [[MAIN_PLATFORM]] logo – only abstract, platform-inspired symbol.

Format:
- 16:9 horizontal hero image with characters placed off-center to create striking negative space.

Result:
Every time BOX 6 is used, the model produces a new minimalistic "neon background + futuristic figure(s) with visor glasses + platform emblem" composition that changes characters, poses, colors, and visor design, while maintaining the same clean, high-fashion sci-fi aesthetic.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box7_surreal_central_object_gradient",
    name: "Surreal central object on soft gradient background",
    description: "Surreal editorial hero illustration with 3D-looking central object on soft gradient background with floating platform-inspired symbols",
    promptTemplate: `Create a surreal editorial hero illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, designed as a cover-style visual for [[MAIN_PLATFORM]] content.

CORE STYLE:
- Single central object in the middle of the frame, 3D-looking but illustrated, like a surreal toy, gadget, abstract device, or symbolic prop related to music, social media, or digital culture
- The object type MUST vary from image to image (for example: camera, tape recorder, strange controller, futuristic speaker, abstract tool, symbolic icon), never always the same
- Object is rendered in glossy translucent plastic or glass with subtle iridescent reflections and tiny liquid-like details

BACKGROUND:
- Clean soft vignette gradient background with lots of negative space
- Smooth transition from darker edges to lighter center behind the object
- Use cool futuristic colors: deep blues, cyans, violets, and magentas
- Avoid teal/orange/gold clichés

DETAIL ELEMENTS:
- Around the object, add a few small floating symbols or particles inspired by [[MAIN_PLATFORM]] (distorted icon fragments, tiny flames, droplets, music notes, or reaction shapes)
- These elements should look like energy or motion coming from the object, not like UI icons or interface buttons

COMPOSITION:
- Object fills 60–70% of the image height, centered horizontally
- Strong focus on the silhouette and material of the object
- Minimalistic layout with a lot of empty space, no clutter
- NO text on image, NO UI, NO dashboards, NO grids, NO isometric cubes

MOOD & BRAND:
- Futuristic, edgy, slightly playful but still editorial and premium
- Subtle [[BRAND_NAME]] mood only through color and atmosphere, no large logos or typography
- 16:9 horizontal format, high-end digital illustration quality suitable for a campaign hero banner.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box8_minimal_monumental_sphere_plinth",
    name: "Minimal monumental object on plinth in empty space",
    description: "Minimalist editorial hero illustration with large geometric form on plinth and tiny human figures in vast empty space",
    promptTemplate: `Create a minimalist editorial hero illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, designed as a premium visual for [[MAIN_PLATFORM]] content.

CORE STYLE:
- Monument-like central object: a single large geometric form (sphere, capsule, rounded cube, or abstract smooth shape) floating slightly above a clean rectangular plinth or platform
- Object surface is dark and textured or softly reflective, with a bold neon symbol, line, or abstract mark inspired by [[MAIN_PLATFORM]] colors
- NO literal UI, no buttons, no dashboards, no isometric cubes

ENVIRONMENT:
- Vast empty gallery or plaza with lots of negative space
- Subtle floor grid or fine lines to show perspective, very clean and minimal
- Background in soft neutral tones: light grey, warm beige, or off-white, with gentle vignette
- Lighting is calm, like a museum spotlight on the central object

DETAIL ELEMENTS:
- 1–3 tiny human figures standing near the plinth, treated as small silhouettes or simple minimal characters
- Their presence must emphasize the scale of the central object, not become the main focus
- No facial details, no fashion focus — just scale markers

COLOR PALETTE:
- Overall restrained, muted, and elegant
- Accents in neon cyan, magenta, or electric pink inspired by [[MAIN_PLATFORM]], used only on the object's symbol/line and small light reflections
- Avoid teal/orange/gold clichés and overly saturated full-background gradients

COMPOSITION:
- Central object + plinth sit in the middle or slightly off-center, occupying ~40–60% of the frame
- Horizon line low, lots of empty space above
- Perspective is natural and cinematic, not heavy isometric
- No text on image, no logos, no interface elements

MOOD & BRAND:
- Feels like a high-end art installation about digital culture and social platforms
- Calm, futuristic, slightly mysterious, with a museum / design-biennale mood
- Subtle [[BRAND_NAME]] presence only through color, atmosphere, and overall taste level
- 16:9 horizontal format, ultra-clean, award-winning contemporary illustration quality.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box9_minimal_split_panel_character_icons",
    name: "Minimal split-panel character with platform icons",
    description: "Minimal editorial hero illustration with split-panel composition, character at split line, and platform-inspired icons",
    promptTemplate: `Create a minimal editorial hero illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, designed for [[MAIN_PLATFORM]] content.

CORE STYLE:
- Clean split-panel composition: upper panel in a light neutral tone, lower panel as a deep dark block
- A single character placed at the horizontal split line: only head and hands visible, as if they are emerging from behind the dark panel
- Character is stylized but elegant, with strong eyes and simple shapes, not cartoonish or childish

PLATFORM ICON LANGUAGE:
- Simplified, flat icons inspired by the [[MAIN_PLATFORM]] logo
- A few monochrome icons above the character in the light panel
- A few colored icons (using the brand accent color of [[MAIN_PLATFORM]]) below the character in the dark panel
- Icons should be graphic, flat, and consistent; no glossy or 3D effects

COLOR PALETTE:
- Very limited and controlled palette
- Background: warm white / ivory for the top, deep charcoal / black for the bottom
- Accent color: one or two bold tones taken from [[MAIN_PLATFORM]] (for example orange, red, pink, or cyan depending on platform identity)
- Skin tones natural but slightly stylized
- No teal/orange/gold blockbuster grading, no noisy gradients

COMPOSITION:
- Character centered horizontally, eyes near the upper third of the frame to create a strong focal point
- Hands rest on or hang over the split edge, adding tension and rhythm
- Icons arranged in simple, balanced patterns above and below, without clutter
- Lots of negative space; very clean and graphic

MOOD & BRAND:
- Slightly mysterious, editorial, and conceptual — feels like a magazine illustration about visibility, reach, or discovery on [[MAIN_PLATFORM]]
- Sophisticated, calm, and confident; not loud or chaotic
- Subtle [[BRAND_NAME]] presence only through quality of design and tasteful color echo, no text or logo

TECHNICAL:
- Flat or very soft shading, no heavy 3D rendering
- No text on the image
- Natural, non-isometric perspective
- 16:9 horizontal format, high-resolution modern digital illustration.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box10_drowned_device_surrealism",
    name: "Drowned Device Surrealism",
    description: "Cinematic surreal hero image with futuristic device partly submerged in liquid, dark moody 3D render with platform logo integration",
    promptTemplate: `Create a cinematic surreal hero image for "[[ARTICLE_TITLE]]" about [[NICHE]] on [[MAIN_PLATFORM]].

BOX 10 STYLE – DROWNED DEVICE SURREALISM

CORE AESTHETIC:
- Dark, moody, premium 3D / CGI render with subtle photographic lighting
- Single central object: a futuristic electronic device or irregular tech block partly submerged in glossy liquid
- The object may subtly merge with a human face or sculpted facial features (eyes, nose, cheeks) to create a surreal hybrid
- Strong focus on reflections and surface detail (wet metal, glass, chrome, plastic)

COMPOSITION:
- Minimalist composition with a lot of negative space
- Horizon line of liquid across the lower part of the frame, dark background above
- Central object tilted or emerging from the water at an angle, as if it's sinking or surfacing
- No additional clutter, no busy environment – everything supports the main object

PLATFORM LOGO INTEGRATION:
- Integrate the [[MAIN_PLATFORM]] logo as a glowing, simple geometric element:
  - floating behind or beside the main object
  - or softly projected as light/reflection on the water or on the device surface
- Logo must feel like part of the world, not a sticker or overlay
- NO additional text, labels, or typography on the object or background

COLOR PALETTE:
- Deep purples, midnight blues, and near-blacks for background and water
- Contrasting neon accent color taken from [[MAIN_PLATFORM]] (e.g. Spotify green, TikTok cyan/magenta, YouTube red, etc.)
- Subtle iridescent / holographic highlights on the device surfaces
- Overall: dark, cinematic, atmospheric

VARIATION RULES:
- The central object can change between images:
  - cube, cassette, futuristic speaker, data block, helmet, phone, etc.
  - sometimes with visible human facial features, sometimes more abstract
- The angle and level of submersion can vary: almost underwater, half-sunk, or just touching the surface
- Keep one strong focal point, never turn this into a busy scene

DO NOT:
- Do not add any readable words or UI on the object or in the scene
- Do not use isometric grid or tech dashboards
- Do not make it cartoonish or childish
- No violent or aggressive context – the device is symbolic, not a weapon

OVERALL MOOD:
- Premium, editorial, mysterious, slightly eerie but stylish
- Feels like a high-end campaign visual for [[BRAND_NAME]], not a stock render

FORMAT:
- 16:9 horizontal hero image, optimized for web article header.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box11_neon_gradient_creator_portrait",
    name: "Neon Gradient Creator Portrait",
    description: "Futuristic creator portrait hero image with stylized 3D/2D hybrid portrait and soft neon gradient background",
    promptTemplate: `Create a futuristic creator portrait hero image for "[[ARTICLE_TITLE]]" about [[NICHE]] on [[MAIN_PLATFORM]].

BOX 11 STYLE – NEON GRADIENT CREATOR PORTRAIT

CORE AESTHETIC:
- Highly stylized 3D/2D hybrid portrait of a modern digital creator or influencer
- Smooth skin shading, clean facial features, subtle stylization (not photoreal, not cartoon)
- Calm, confident, clever expression – feels like a strategic, thoughtful creator
- Portrait can be half-body or bust, slightly turned, with a clear focal point on the face and eyes

BACKGROUND:
- Full-screen soft gradient background (duotone or tritone)
- Colors: modern neon pastels – mixes of cyan, lime, violet, magenta, or soft blue
- No detailed environment, only gradient and very minimal abstract shapes if needed

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo appears only as a subtle graphic element:
  - reflected in glasses, earrings, or accessories
  - or as small floating icons near the portrait
- Logo must be clean, simple, and integrated into the style – not pasted on top
- Absolutely NO text, slogans, or UI screens inside the logo or elsewhere

COLOR & LIGHTING:
- Cool-toned skin (blue, purple, or cyan-tinted) with soft contrasting highlights
- Light accents that echo [[MAIN_PLATFORM]] brand colors
- Gentle rim light or glow around the silhouette to separate from the gradient background

VARIATION RULES:
- Change gender, ethnicity, hairstyle, and accessories between images
- Glasses, earrings, piercings, headphones, or minimalist jewelry can be used as style accents
- Composition can place the portrait slightly left or right, leaving negative space on the opposite side
- Optional small abstract icon rows or dots as decorative elements ONLY – no readable text

DO NOT:
- Do not include any written words, UI screens, or app interfaces
- Do not use heavy textures, noise, or grunge effects
- Do not make it childish or comic-style; keep it sleek and editorial
- No isometric 3D tech objects or dashboards

OVERALL MOOD:
- Premium, editorial, future-facing portrait of a social media creator
- Feels like a campaign image for [[BRAND_NAME]] aimed at smart, ambitious artists and influencers

FORMAT:
- 16:9 horizontal hero image, optimized for web article header.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box12_neon_lounge_pop_art",
    name: "Neon Lounge Pop Art",
    description: "Bold pop-art hero image with relaxed creator lounging, hyper-saturated neon palette, and 80s/90s vaporwave mood",
    promptTemplate: `Create a bold pop-art hero image for "[[ARTICLE_TITLE]]" about [[NICHE]] on [[MAIN_PLATFORM]].

BOX 12 STYLE – NEON LOUNGE POP ART

CORE AESTHETIC:
- Relaxed creator lounging on a sofa, chair, or casual interior setup
- Strong graphic outlines, simplified anatomy, pop-art illustration style
- 80s/90s inspired vaporwave mood: playful, stylish, slightly surreal
- Character can be any gender or ethnicity; always looks confident and cool

COLOR & TEXTURE:
- Hyper-saturated neon palette: lime, teal, magenta, violet, hot orange, electric yellow
- Flat fields of color combined with soft noise or grain for depth
- Clear color separation between character, furniture, and background
- Optional subtle halftone or retro-print texture, but keep image clean and crisp

BACKGROUND & COMPOSITION:
- Interior scene suggested with minimal shapes: sofa, cushions, simple decor blocks
- Large colored rectangles and geometric panels behind or around the character
- Asymmetric composition with strong horizontal flow and lots of negative space
- Character occupies ~40–60% of the frame, legs or arms creating dynamic diagonals

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo used as a small object: sticker on device, pin on clothing, small floating disc, or decor element
- Logo is graphic and flat, fully integrated into the pop-art style
- Absolutely NO readable UI, captions, app screens, or text in the image

VARIATION RULES:
- Change poses: lounging, half-reclining, sitting cross-legged, leaning on armrest
- Vary outfits: oversized t-shirt, shorts, streetwear, socks, sneakers, etc.
- Accessories like sunglasses, headphones, or a handheld device are allowed but stylized
- Background blocks and gradients should shift layout and colors for each new image

DO NOT:
- Do not include any written words, captions, or interface elements
- Do not use realistic photography or bland gradients only
- Do not make it childish or comic-strip; keep it edgy, editorial, and design-driven
- No isometric 3D dashboards, screens, or complex tech objects

OVERALL MOOD:
- Feels like a poster for a modern social media culture magazine
- Fun, relaxed, and visually loud, but still minimal and sophisticated
- Clearly aligned with [[BRAND_NAME]] as a bold, creative, youth-oriented brand

FORMAT:
- 16:9 horizontal hero illustration, ready for use as an article header.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box13_bubble_pop_crew",
    name: "Bubble Pop Crew",
    description: "Playful pop-art hero image with 2-4 friends, overlapping circles/bubbles, and bright flat colors",
    promptTemplate: `Create a playful pop-art hero image for "[[ARTICLE_TITLE]]" about [[NICHE]] on [[MAIN_PLATFORM]].

BOX 13 STYLE – BUBBLE POP CREW

CORE AESTHETIC:
- 2–4 friends standing close together, arms on shoulders or casually grouped
- Faces and bodies stylized in bold pop-art illustration or photo-collage style
- Exaggerated expressions: laughing, smiling, mischievous, high-energy vibe
- Characters can be any mix of genders and ethnicities, always feeling like a real crew

COLOR & TEXTURE:
- Flat, bright background in a single color (yellow, mint, peach, sky blue, etc.)
- Large overlapping circles and dots in multiple neon / pastel tones (cyan, magenta, lime, violet)
- Characters painted in unexpected colors (blue skin, pink shadows, etc.) but with clear shapes
- Soft grain or subtle noise allowed; overall look remains clean and graphic

BACKGROUND & COMPOSITION:
- Full frame filled with circles / bubbles of different sizes
- Characters centered and occupying ~40–60% of the width
- Circles can overlap characters slightly to create depth and playfulness
- Asymmetric, dynamic composition with a clear main focal point on the group

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo appears as a small graphic bubble, badge, or sticker near the group
- Logo is flat and stylized to match the pop-art palette
- Absolutely NO text labels, UI panels, or readable words anywhere in the image

VARIATION RULES:
- Vary number of characters and their poses (side hugs, leaning in, stacked heights)
- Change clothing styles: streetwear, casual tees, caps, sunglasses, etc.
- Let circle patterns and color schemes differ on each render for high visual variety
- Keep the mood celebratory and social, like a party snapshot turned into pop art

DO NOT:
- Do not include any captions, banners, or interface elements
- Do not use realistic photographic background scenes
- Do not make the style childish; it should feel like edgy editorial illustration
- No isometric 3D dashboards or complex tech objects

OVERALL MOOD:
- Feels like a poster for a youth culture / social media event
- Fun, loud, and energetic, yet still clean and design-driven
- Subtly aligned with [[BRAND_NAME]] as a bold, community-focused brand

FORMAT:
- 16:9 horizontal hero illustration for an article header.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box14_neon_organic_anti_bot",
    name: "Neon Portrait – Organic Anti-Bot Energy",
    description: "Bold neon digital illustration with modern music creator, polished digital painting, and vivid magenta background",
    promptTemplate: `Create a bold neon digital illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. Use a SINGLE main character as the clear focal point (60–70% of the composition): a modern music creator / producer / digital native in headphones, hoodie or jacket, sitting with a laptop, sampler, or DJ gear in front of them.

STYLE & RENDERING:
- Highly polished digital painting with sharp outlines and glossy shading, between comic-book and concept-art quality
- Skin and clothing rendered in cool blue / violet tones with subtle gradients, not realistic skin tones
- Strong expressive lighting from the laptop / equipment, reflecting on face, glasses, headphones, and clothing
- Avoid childish style, avoid flat vector; it should feel like premium illustration for an editorial cover

COLOR & BACKGROUND:
- Clean, flat neon background in vivid magenta / hot pink with soft vignetting toward the edges
- Accent colors: electric cyan, deep violet, saturated teal, small touches of lime or neon green
- Background mostly empty for negative space; can include minimal waveforms, glitch streaks, or abstract sound waves behind the character

MOOD & SYMBOLISM:
- Overall mood: "real person, real sound, no bots" – organic, authentic, a bit rebellious
- Convey the anti-bot / organic feeling through visual metaphors only:
  - Stickers on the laptop or gear with simple iconography (shield, leaf, heart, waveform), NO readable words
  - Optional cat, plant, or small side-object to add personality, but keep it secondary
- Expression: confident, focused, or laughing with joy while listening to music on headphones

COMPOSITION:
- Centered or slightly off-center character, chest-up or half-body framing
- Hands visible on the keyboard, mixer, or pushing headphones to ears
- Foreground gear simplified: blocks of knobs and faders, no detailed UI, no brand names, no text
- Use strong contrast between bright character and flat neon background for immediate impact

PLATFORM LOGO INTEGRATION:
- Integrate the [[MAIN_PLATFORM]] logo subtly:
  - as a small glowing icon on the laptop lid
  - or as a minimal badge on headphones or clothing
  - or as a soft, semi-transparent hologram floating behind the character
- The logo must feel naturally embedded into the scene, not pasted on top

BRAND MOOD:
- Light hint of [[BRAND_NAME]] through color choices and overall vibe only, NO visible "PROMOSOUND", NO slogans, NO readable typography at all.

FORMAT:
- 16:9 horizontal hero image
- High resolution, crisp details, ready to use as a premium website or article cover.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box15_crew_fisheye_circle",
    name: "Fisheye Creator Crew Circle",
    description: "Dynamic group-portrait illustration with fisheye/ultra-wide perspective, diverse crew of creators in circular arrangement",
    promptTemplate: `Create a dynamic group-portrait illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. Use a FISHEYE / ULTRA-WIDE perspective: the viewer looks up from the center of a circle, surrounded by a diverse crew of modern creators leaning in toward the "camera".

STYLE & RENDERING:
- Stylized semi-realistic digital painting (not photo, not comic, not 3D render)
- Clean, slightly softened outlines with smooth shading
- Faces expressive and clearly different from each other (age, gender, ethnicity, hairstyles)
- No recognizable movie/IP costumes; outfits should feel like futuristic streetwear, music studio or digital-creator clothing

COMPOSITION:
- Circular arrangement of 6–10 characters around the edge of the frame, all looking toward the viewer
- Strong fisheye distortion: heads closer to the edge appear larger and curved
- Camera placed low in the center, pointed upward, creating a tunnel-like feeling
- Foreground can include a few abstract devices (mics, headphones, controllers) near the lens, simplified with no detailed UI

BACKGROUND:
- Interior hint of a futuristic studio / spaceship-like hub / creative control room, but kept soft and defocused
- Use smooth shapes, arches, cables, light panels—no specific franchise elements, no logos from movies

COLOR & LIGHT:
- Duotone or tritone gradient overlay: deep violet to magenta to warm orange, softly sweeping across the frame
- Strong rim light on faces from the circular opening, creating dramatic highlights
- Maintain enough contrast so every face reads clearly against the environment

PLATFORM LOGO INTEGRATION:
- Subtle [[MAIN_PLATFORM]] logo integrated as a small badge on one device, patch on a jacket, or tiny glowing icon on the ceiling
- Logo must feel part of the environment, not pasted on top; no other readable text

MOOD & STORY:
- Feeling of "creative squad assembling" or "team huddle before launch" – collaborative, slightly epic, but playful
- Characters show a mix of curiosity, focus, excitement, and quiet confidence

BRAND MOOD:
- Gentle echo of [[BRAND_NAME]] through color accents and overall energy only. NO visible brand names, NO slogans, NO readable typography.

FORMAT:
- 16:9 horizontal hero image
- High resolution, designed as a striking website or article cover with strong central focal point and circular composition.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box16_retro_music_collage",
    name: "Surreal Retro Gear Money-Collage",
    description: "Bold surreal collage illustration with stack of retro music devices and abstract money energy elements",
    promptTemplate: `Create a bold surreal collage illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. Center the composition on a towering stack of RETRO MUSIC DEVICES: old-school samplers, cassette decks, synths, radios and boomboxes, all stylized and colorful, arranged like a totem in the middle of the frame.

STYLE & RENDERING:
- High-end digital collage with cut-out feeling, combining illustrated elements and photo-textures
- Sharp, clean shapes with slight grain, inspired by editorial music-magazine covers
- Playful, surreal, slightly absurd – not realistic, not 3D-rendered

COMPOSITION:
- Central vertical stack of various music machines forming one iconic object
- Around the stack, dynamic explosion of abstract "money energy": flying stylized banknotes, tickets, vouchers or geometric shapes that clearly hint at income, without showing real currencies
- Optional quirky character element: a small surreal figure or bird-headed character peeking from behind the gear, adding personality without dominating the frame

BACKGROUND:
- Full-bleed gradient or textured color field (for example warm orange or sunset tones), with subtle noise
- No detailed environment; background must stay clean so the collage pops

COLOR & LIGHT:
- Bright, saturated palette with contrasting accents (neon pinks, cyans, yellows, oranges)
- Use color blocking to separate the devices and keep the stack readable
- Light is mostly flat and graphic, as in poster art, with minimal shadows

PLATFORM LOGO INTEGRATION:
- Subtle [[MAIN_PLATFORM]] logo can appear as a tiny sticker or badge on one of the devices, or as a small glowing icon hidden among the abstract shapes
- Logo must feel embedded into the collage, not pasted on top; no other readable text or branding

MOOD & STORY:
- Visual metaphor of "turning creativity and music tools into income"
- Energetic, fun, slightly chaotic, but still balanced and premium – a celebration of DIY music production and monetization

BRAND MOOD:
- Light echo of [[BRAND_NAME]] through a few accent colors and overall vibe; no visible brand names, slogans or UI elements.

FORMAT:
- 16:9 horizontal hero image
- High resolution, designed as a strong website or article header with a clear central focal point.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box17_neon_stream_lab",
    name: "Neon Stream Strategists Lab",
    description: "Cinematic neon illustration with hooded strategists working on laptops in dark room, cyberpunk/techno-lab mood",
    promptTemplate: `Create a cinematic neon illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. The scene shows a small group of anonymous, hooded music strategists working on laptops in a dark room, lit almost entirely by glowing screens and headphones.

STYLE & RENDERING:
- Minimalist, high-contrast digital illustration with smooth gradients
- Strong cyberpunk / techno-lab mood, but clean and editorial, not gritty
- Characters are stylized silhouettes with simple facial features or glowing glasses, not realistic portraits

COMPOSITION:
- 1–3 seated figures at a desk facing the viewer, arranged in a tight horizontal row
- Each character has headphones and a laptop, forming a rhythmic visual pattern
- Behind the central character, add a large abstract halo or financial icon (e.g. stylized currency shape, waveform, or geometric aura) suggesting revenue and data, not literal dollar signage

COLOR & LIGHT:
- Dominantly monochrome palette based on [[MAIN_PLATFORM]] brand color (for example neon green for Spotify) against almost black background
- Harsh rim light outlines characters and laptops, creating silhouettes
- Subtle secondary hues (deep blues or purples) can be used sparingly for depth

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo appears as glowing icon on laptop lids, headphones, or as a small symbol within the background aura
- Logo must feel integrated into the lighting, not pasted on; no other readable text, stickers, or UI

MOOD & STORY:
- Visual metaphor of a focused, data-driven "stream lab" where campaigns and growth strategies are engineered
- Feels powerful, controlled, and professional – not criminal, not spammy, no bots or hacking references

BRAND MOOD:
- Subtle echo of [[BRAND_NAME]] through overall vibe and color choices; no visible brand names or slogans.

FORMAT:
- 16:9 horizontal hero image
- Designed as a strong website or article header with clear central focal point and plenty of negative space around the figures.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box19_glitch_fighter",
    name: "Glitch Fighter vs Algorithm",
    description: "Bold high-energy illustration with fighter character, glitch energy, and VHS/90s arcade aesthetic",
    promptTemplate: `Create a bold, high-energy illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. The image should feel like a surreal fight against an invisible algorithm, with a strong central fighter figure and intense glitch energy.

STYLE & RENDERING:
- Stylized semi-realistic character, inspired by arcade fighting games or action figures
- Strong anatomy, exaggerated muscles, dynamic pose (punching, blocking, or ready to fight)
- Heavy film grain, slight blur and chromatic aberration for a gritty VHS / 90s arcade feel
- Overall look: editorial poster meets retro game cover, not childish

COMPOSITION:
- One main fighter character, partially cropped on one side of the frame to create tension
- Diagonal band of glitchy neon light crossing the image (RGB streaks, digital noise, distorted pixels)
- Background split into two or three big fields: one noisy/dark, one bright/glitchy, maybe an extra color block
- Clear focal point on the fighter's upper body and pose

COLOR & MOOD:
- Contrast between deep dark areas and bright saturated neons (electric blue, magenta, red, purple)
- Use grain and subtle gradient transitions instead of flat colors
- Mood: defiant, intense, "fighting back" but still stylish and modern

GRAPHIC ELEMENTS (NO REAL TEXT):
- Use bold white rectangular graphic bars or abstract typographic blocks that hint at poster text
- Do NOT include any readable words or letters; keep all text-like elements abstract

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo can appear as a subtle hologram, glitch symbol, or icon in the glitch band or background
- Logo should feel embedded in the digital noise, not slapped on top

BRAND MOOD:
- Subtle [[BRAND_NAME]] vibe through attitude and color choices (smart, rebellious, creator-first), without visible brand wording.

FORMAT:
- 16:9 horizontal hero image
- Designed to work as a website header with a strong left/right composition and clear focal point.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box20_clay_question_energy",
    name: "Clay Question Marks Teaser",
    description: "Teaser-style illustration with soft 3D clay/plastiline abstract question-mark forms and warm gradient background",
    promptTemplate: `Create a teaser-style illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. The image should feel like a playful mystery announcement with bold color and sculpted abstract forms.

STYLE & RENDERING:
- Soft 3D clay / plastiline style shapes with smooth shading and subtle texture
- Abstract question-mark-like forms made of chunky tubes and spheres, NOT literal text characters
- Clean, modern, editorial-quality illustration (no childish clipart vibe)

COMPOSITION:
- 2–4 large abstract "question" forms grouped in the upper part of the frame, leaning diagonally
- Plenty of empty space in the lower part of the image for future typography overlay
- Simple composition with one clear focal cluster, no clutter

COLOR & MOOD:
- Strong warm gradient background: deep red-orange at the top transitioning to lighter orange/yellow at the bottom
- Question shapes in saturated contrasting colors (mustard yellow, lilac, magenta, rich purple accents)
- A few small dots or spheres as secondary elements to add rhythm
- Mood: curious, energetic, "something big is coming" teaser

GRAPHIC ELEMENTS (NO REAL TEXT):
- Do NOT render any readable words or numbers
- You may hint at future text placement using subtle horizontal glow bands or faint rectangular areas near the bottom, but they must stay abstract

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo can appear as a tiny, subtle icon near one of the abstract shapes or as a faint watermark in the background
- Logo must be small and integrated, not dominating the teaser

BRAND MOOD:
- Subtle [[BRAND_NAME]] attitude: bold, confident, creator-focused, expressed only through color and composition (no visible brand wording).

FORMAT:
- 16:9 horizontal hero image
- Designed as a teaser banner/cover with strong top-heavy composition and clean lower area for UI text.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box21_pixel_creator_overload",
    name: "Pixel Creators in Real Tunnel",
    description: "Illustration blending realistic photo-style background with bold pixel-art characters in urban/underground setting",
    promptTemplate: `Create an illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. The image should blend a realistic photo-style background with bold pixel-art characters to capture the chaotic, funny energy of modern creators.

STYLE & MIX:
- Background: soft-focused, realistic urban or underground corridor (e.g. tunnel, hallway, subway, backstage), with graffiti or abstract textures
- Foreground: 2–4 large 8-bit / 16-bit pixel-art human characters standing in a row or cluster
- Characters may have slightly exaggerated or toy-like eyes for a humorous, exhausted-creator vibe
- Overall look: meme-adjacent but still premium, editorial-quality illustration

COMPOSITION:
- Characters occupy the lower and central area of the frame, clearly readable and large
- Background has strong perspective lines (tunnel depth, receding lights) pulling the eye toward the center
- Leave generous empty space in the upper or lower zone for potential text overlays (no text rendered by the model)

COLOR & MOOD:
- Background in moody purples, dark reds, or deep blues with neon accents
- Pixel characters in brighter, contrasting clothing colors to pop against the darker environment
- Lighting that feels like late-night studio/underground vibe: soft glow from overhead lights or distant neon
- Mood: humorous frustration, "creator brain overload", but playful not dark

GRAPHIC RULES:
- NO readable words or UI on the image (no titles, captions, menu bars, etc.)
- Keep any props simple: headphones, hoodies, casual outfits; optional subtle tech/music hints (earbuds, tiny recorder) in pixel form
- Avoid complex equipment renders; keep focus on characters' poses and expressions

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo can appear as a tiny detail: a sticker on a character's pixel hoodie, a far-away sign in the tunnel, or a subtle glowing icon on the wall
- Logo must be integrated and secondary, not the main focal point

BRAND MOOD:
- Subtle [[BRAND_NAME]] spirit: smart, self-aware creator humor, expressed only through color, attitude, and composition.

FORMAT:
- 16:9 horizontal hero image suitable for article headers and landing pages.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box22_dark_brain_grid",
    name: "Dark Sculptural Brain Grid",
    description: "Bold conceptual illustration with repeated grid of surreal sculptural heads revealing glowing brain/core on dark background",
    promptTemplate: `Create a bold conceptual illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. The image should use a dark, almost black background with a repeated grid of surreal sculptural heads or geometric busts that reveal a glowing "brain" or inner core.

STYLE & MIX:
- Stylized, faceted, geometric heads / helmets / masks, rendered like matte metal or stone objects
- Each object has an open top or cut-out revealing an organic brain-like form or bright abstract core
- Clean, minimal layout: repetition as a design device, not clutter
- Overall feeling: smart, slightly unsettling, high-concept editorial poster

COMPOSITION:
- Arrange 6–12 heads/objects in a loose grid or pattern across the frame
- Use subtle variations: different angles, light direction, or expression to avoid perfect uniformity
- Strong central focus: middle row or central object can be slightly larger, brighter, or differently lit
- Large areas of pure black or very dark background to create heavy negative space

COLOR & LIGHT:
- Dominantly monochrome for the heads and background (black, charcoal, dark grey, muted silver)
- Inner "brain/core" rendered in vivid contrasting colors (e.g. saturated reds, magentas, or electric oranges)
- Directional lighting that carves out sharp edges and shadows on the faces, cinematic and moody
- No gradients in the background; keep it flat or subtly textured for a premium print feel

GRAPHIC RULES:
- Absolutely NO typography, slogans, UI elements, or readable text in the illustration
- Avoid visible seams, frames, or boxes around the heads; they should feel integrated into one continuous dark field
- Props are optional; if used, keep them minimal and abstract (thin lines, halos, subtle geometric marks)

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo can appear once as a tiny detail: etched on the side of one head, softly glowing on the inner core of a single object, or as a faint symbol in the background
- Logo must remain secondary; the sculptural grid is the hero

BRAND MOOD:
- Subtle [[BRAND_NAME]] sensibility: smart critique of boring/robotic content, expressed through the repeated "heads" with exposed brains, not through words.

FORMAT:
- 16:9 horizontal hero image suitable for article headers and landing pages.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box23_grainy_crt_glitch_projection",
    name: "Grainy CRT Glitch Projection",
    description: "Retro-futuristic illustration with CRT-style screen projecting neon glitch light, 80s/90s analog tech aesthetic",
    promptTemplate: `Create a retro-futuristic illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. Center the image around an old CRT-style screen or boxy device in a dark room, throwing intense neon glitch light onto the wall.

STYLE & MOOD:
- 80s/90s analog tech aesthetic: chunky CRT monitor or speaker-like box, no visible UI or readable text
- Strong VHS / CRT effects: RGB channel shifts, scanlines, subtle noise, chromatic aberration
- High-contrast, cinematic atmosphere: feels like a still from an underground club or hacker's studio
- Conceptual mood: "algorithmic chaos", shown only through abstract glitch graphics and lighting

COMPOSITION:
- CRT/device sits in the lower part of the frame, angled slightly, occupying 25–40% of the image
- From the screen, project bold glitch shapes onto the wall: jagged bars, distorted graphs, and pixel streaks forming an explosive abstract halo
- Keep the rest of the scene minimal: hint of a table or pedestal, soft shadows, lots of negative space
- Camera viewpoint can be slightly low-angle for drama

COLOR & LIGHT:
- Neon magentas, hot pinks, electric blues, and acid greens as primary glow colors
- Background in deep purples, dark reds, or near-black, with film grain texture
- Light from the screen should cast colorful reflections on nearby surfaces, with soft bloom

GRAPHIC RULES:
- NO readable text, captions, UI screens, or slogans on the device or background
- Use only abstract blocks, bars, and glitch shapes to imply data, sound waves, or algorithms
- Keep shapes sharp and graphic, not messy noise; it should feel designed and intentional

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo can appear once, subtly: as a tiny glowing icon in a corner of the device frame, hidden in the glitch projection, or as a faint reflection
- Logo must be secondary and partially stylized by the CRT/glitch effect, not flatly overlaid

BRAND MOOD:
- Subtle [[BRAND_NAME]] attitude: playful but critical view of "algorithms", expressed only through colors, light, and glitch energy — no direct messaging.

FORMAT:
- Vertical story-friendly format is preferred (9:16), but composition should be adaptable to a cropped 16:9 hero if needed.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box24_neo_punk_creature_poster",
    name: "Neo-Punk Creature Poster",
    description: "Bold neo-punk poster with hand-drawn monster/creature, thick black comic outlines, aggressive typography, and ultra-saturated background",
    promptTemplate: `Create a bold neo-punk poster illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]]. The image should feature a hand-drawn monster/creature as the main character with thick black comic outlines, aggressive attitude, loud typography, and flat, ultra-saturated background.

CORE STYLE:
- Bold neo-punk poster aesthetic with hand-drawn monster/creature as the main character
- Thick black comic outlines with sketchy variations, some hatching and dots like classic comic printing
- Aggressive, expressive attitude with exaggerated anatomy and facial expression
- Flat, ultra-saturated background colors: electric violet, deep purple, or neon magenta
- Optional subtle radial gradient in background (center slightly lighter than edges)
- Very light print/poster grain texture, no visible photo noise

COMPOSITION:
- Central oversized cartoon creature or limb (raptor, dragon, snake, claw, mutated animal, etc.)
- Creature turned slightly in three-quarter view for dynamism
- Occupies 40–60% of canvas height, placed slightly off-center for tension
- Visible teeth, claws, eyes, scales or skin texture with graphic highlights and shadow blocks (cell-shaded, 2–3 tone values max)
- Creature usually in neon green or another loud color that contrasts with violet background

GRAPHIC BURSTS:
- Spikes, comic starburst shapes, halftone triangles, angled shards radiating from behind the creature or from its mouth/limb
- Sharp, high-contrast shapes in black/white or one accent color (orange or magenta), sometimes with halftone dot fill
- 1–2 burst/impact clusters max to avoid clutter

TYPOGRAPHY:
- Large blocky headline: short, punchy 1–3 word slogan (e.g. LAUNCH HARDER, FEED THE FEED, SYSTEM OVERDRIVE – use generic phrases, not article title)
- Mix of brutal grotesk sans-serif for main words and rough marker/brush script for one accent word
- Solid neon fill (neon green or white) with subtle darker drop shadow or outline for readability
- Headline placement: large blocky letters in lower third or upper half, overlapping or hugging the creature
- Optional small subcopy: 2–3 short lines in one corner, clean sans-serif, white or very light color, aligned to grid

VARIATION LOGIC (model should randomize):
- Subject: close-up roaring creature head, side view of long creature claw, serpent/tentacle wrapping around text, or hybrid creature (robot-dino, cyber-dragon)
- Layout: headline at top with creature in middle, creature centered with headline in lower third, or diagonal composition with creature tilted
- Colors: swap background between violet, electric blue, or deep magenta while keeping creature in bright complementary color; sometimes invert scheme (darker creature on lighter neon background)
- Always keep one single creature or limb as hero; no busy crowd scenes
- Headline is always readable, not distorted; never cover entire canvas with text

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo appears as small, subtle logo mark or wordmark near one corner
- Keep tiny and unobtrusive so it doesn't fight with headline
- No other readable branding or text

LIGHTING & TEXTURE:
- Simple poster-style lighting: bold shadows and highlights painted as graphic shapes, not realistic 3D rendering
- Cell-shaded with 2–3 tone values max per color
- Crisp digital illustration with slight retro print feel (small halftone patches, subtle paper grain)

COLOR PALETTE:
- Background: electric violet (#6A3BFF), deep purple, or neon magenta
- Creature: neon green (#28FF54) or another loud contrasting color
- Accents: hot orange (#FF4B1F), white, black
- High contrast combinations, no muted pastel palettes

DO NOT:
- No photographic humans or realistic animals
- No gradients that turn the whole scene into soft 3D – keep it graphic and poster-like
- No muted pastel palettes
- No complex backgrounds with cityscapes or detailed scenery; background must stay simple and flat
- No corporate UI elements or app screenshots
- No readable article title or specific text from the article

BRAND MOOD:
- Subtle [[BRAND_NAME]] attitude: bold, aggressive, creator-focused, expressed only through visual style and color choices (no visible brand wording beyond platform logo).

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box25_neon_balaclava_portraits",
    name: "Neon Balaclava Portraits",
    description: "High-resolution editorial portrait with person wearing striking textured accessory (balaclava/mask), neon accent color, and bold typography",
    promptTemplate: `Create a high-resolution editorial portrait for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]].

STYLE & RENDERING:
- High-resolution editorial portrait, realistic photography mixed with subtle grain
- Strong fabric texture, sharp details on eyes and mouth
- Minimalist layout, bold contemporary typography

SUBJECT:
- Single person in a close-up or medium-close portrait
- Wearing a striking textured accessory that partially covers the face (balaclava, knitted mask, hood, scarf, or similar)
- Eyes or mouth clearly visible and expressive
- Emotion somewhere between frustration, tension, and quiet confidence
- Gender, skin tone, and facial features can vary every time
- Emphasize the knit or fabric texture of the mask/hood and subtle skin details

COLOR & MOOD:
- Dominant neon accessory color (acid green, toxic yellow, or electric cyan) contrasted with natural skin tones
- Background: flat or very soft-gradient (sky blue, warm beige, muted teal, or grainy orange)
- Overall limited palette with one loud accent color and 1–2 supporting tones

COMPOSITION:
- Vertical 9:16 poster format (composition should be adaptable to 16:9 hero if needed)
- Subject filling most of the frame, face cropped tight (forehead, eyes, and mouth are the main focus)
- Plenty of empty negative space on one side or in the upper third for text
- Camera angle straight-on or slight side profile
- Background clean and uncluttered

TYPOGRAPHY:
- Allow one or two short bold white headlines in a clean grotesk font, placed in the negative space
- The exact wording is not important and can be replaced later (use generic phrases, not article title)
- Headlines should be readable and complement the portrait

LIGHTING:
- Soft but directional lighting with gentle shadows that sculpt the face and mask
- Keep everything else simple beyond the lighting

PLATFORM LOGO INTEGRATION:
- [[MAIN_PLATFORM]] logo can appear as a small, subtle mark near one corner or integrated into the typography area
- Logo must be unobtrusive and secondary

EXTRA RULES:
- No logos (except platform logo), no brand names, no readable text from the reference images
- Avoid weapons, gore, or explicit violence; focus on emotional intensity and attitude instead
- Keep focus on the portrait and typography; avoid complex backgrounds or props

BRAND MOOD:
- Subtle [[BRAND_NAME]] attitude: intense, confident, creator-focused, expressed only through visual style and color choices (no visible brand wording beyond platform logo).

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT: 16:9 horizontal hero image. Professional quality - NOT childish, NOT generic AI style.`
  },
  {
    id: "box26_neon_dj_halftone_poster",
    name: "Neon DJ Halftone Poster",
    description: "High-contrast DJ portrait with lime background, halftone dots, diagonal speed lines, and bold screenprint poster vibe",
    promptTemplate: `Create a bold screenprint-style hero image for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]].

STYLE:
- High-contrast black/white subject against a vivid neon-lime background.
- Screenprint / poster aesthetic with crisp edges and slightly rough texture.
- Large halftone dot field and diagonal speed lines to convey energy.
- Limited palette: neon lime, black, white, and optional small accent (dark green or charcoal).

SUBJECT:
- One DJ or music creator, waist-up or mid-shot, wearing headphones and interacting with turntables or mixer.
- Strong silhouette and expressive pose (leaning in, hands on decks).
- No photorealistic skin tones; use stark black/white graphic treatment.

COMPOSITION:
- Subject placed left or center-left; strong negative space on the right.
- Halftone dots and diagonal lines fill the right side for balance.
- Keep background minimal; no clutter or realistic environment.

TEXT/LOGO RULES:
- No readable text from the article.
- If [[MAIN_PLATFORM]] logo appears, keep it small and subtle in a corner or in the negative space.
- No other typography unless it's abstract and unreadable.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT:
- 16:9 horizontal hero image, poster-like layout, professional quality.`
  },
  {
    id: "box27_flat_vector_headphones_portrait",
    name: "Flat Vector Headphones Portrait",
    description: "Clean vector illustration of a confident music creator with headphones on a solid warm background and a single brand color accent",
    promptTemplate: `Create a clean, flat vector-style hero illustration for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]].

STYLE:
- Crisp vector shapes, smooth edges, and minimal shading (2–3 tone blocks max).
- Strong, solid background color (warm orange or amber).
- Limited palette: warm background + one bold accent color + neutral blacks/whites.
- Graphic poster vibe, not photorealistic.

SUBJECT:
- Single confident music creator, waist-up or medium shot, wearing headphones.
- Simple modern streetwear (jacket + t-shirt), stylized but clean.
- Face angled upward or to the side, expressive and aspirational.
- If a logo is needed, integrate [[MAIN_PLATFORM]] as a simplified icon on the shirt or headphone earcup (no readable text).

COMPOSITION:
- Subject placed slightly left or right of center with clear negative space.
- No detailed background; keep it flat and minimal.
- No props or clutter.

TEXT/LOGO RULES:
- No readable text or article title.
- No UI elements, no screenshots.
- Logo use must be minimal and abstract.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT:
- 16:9 horizontal hero image, clean editorial poster quality.`
  },
  {
    id: "box28_liquid_metal_brand_abstraction",
    name: "Liquid Metal Brand Abstraction",
    description: "Abstract liquid-metal forms with glossy reflections and subtle platform-inspired motifs, no text, premium 3D poster vibe",
    promptTemplate: `Create a premium abstract hero image inspired by liquid metal and brand motifs for "[[ARTICLE_TITLE]]" in the [[NICHE]] niche, focused on [[MAIN_PLATFORM]].

STYLE:
- Abstract composition with glossy liquid-metal forms (chrome, molten silver) and smooth reflections.
- Soft gradient background (warm orange/red or deep charcoal) with subtle glow.
- High-end 3D render look, clean and minimal, premium tech/creative feel.

MOTIFS & CONTEXT:
- Integrate subtle abstract shapes inspired by [[MAIN_PLATFORM]] and the niche (e.g., simplified icon geometry, waves, signals, play-like curves), but never exact logos.
- Use 1–3 recognizable motif hints, blended into the liquid forms or floating nearby.
- Keep the references thematic and tasteful; avoid literal icons or UI elements.

COMPOSITION:
- Centered hero cluster of liquid shapes, with ample negative space.
- Depth and layering: foreground glossy forms + soft background glow.
- No characters, no devices, no scenery.

RULES:
- Absolutely no text or readable characters.
- No full logos; only abstract hints.
- No UI screenshots.

CONTEXT:
- Topic: [[ARTICLE_TITLE]]
- Niche: [[NICHE]]
- Platform: [[MAIN_PLATFORM]]
- Brand: [[BRAND_NAME]]

FORMAT:
- 16:9 horizontal hero image, premium abstract poster quality.`
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
    contentPurpose?: string; // Optional: content purpose (e.g., "Blog", "Outreach")
  }
): string {
  let prompt = boxPrompt.promptTemplate;
  
  // Replace placeholders
  prompt = prompt.replaceAll("[[ARTICLE_TITLE]]", params.articleTitle);
  prompt = prompt.replaceAll("[[NICHE]]", params.niche);
  prompt = prompt.replaceAll("[[MAIN_PLATFORM]]", params.mainPlatform);
  prompt = prompt.replaceAll("[[BRAND_NAME]]", params.brandName || "");
  
  // Add context-aware instructions to ensure image relevance
  const contextInstructions = `

CRITICAL CONTEXT REQUIREMENTS - IMAGE MUST BE RELEVANT TO ARTICLE TOPIC:
- The article is about: "${params.articleTitle}"
- The niche/topic area is: ${params.niche}
- The main platform is: ${params.mainPlatform}${params.brandName ? `\n- The brand is: ${params.brandName}` : ""}

VISUAL RELEVANCE RULES:
- ALL characters, props, scenes, and visual elements MUST be directly relevant to the article topic "${params.articleTitle}" and the niche "${params.niche}".
- If the article is about OSINT (Open Source Intelligence), the character should be a researcher, analyst, investigator, or someone working with data/intelligence - NOT a musician, synthesizer user, or unrelated profession.
- If the article is about music marketing, the character should be related to music (artist, producer, marketer) - NOT a cybersecurity expert or unrelated field.
- Props, tools, and visual elements must match the article's topic: for OSINT articles, show research tools, data visualization, screens with information; for music articles, show music-related items; for tech articles, show tech-related elements.
- The scene, setting, and atmosphere must reflect the article's niche and topic, not generic or unrelated themes.
- The character's appearance, clothing, and accessories should be appropriate for the article's niche and topic area.
- DO NOT use generic characters or props that don't relate to the article topic - every visual element must support the article's subject matter.

EXAMPLE: If the article is "OSINT Tools for Investigators", the image should show:
- A character who looks like a researcher/investigator (not a musician or unrelated profession)
- Props related to investigation/research (screens with data, maps, documents, analysis tools)
- Setting appropriate for investigation work (office, research environment, not a music studio)

The visual style from the box prompt above should be maintained, but ALL content (characters, props, scenes) must be relevant to the article topic "${params.articleTitle}" and niche "${params.niche}".`;

  // Append context instructions to the prompt
  prompt = prompt + contextInstructions;
  
  return prompt.trim();
}

/**
 * Select an Image Box Prompt component using random selection with no repeats
 * 
 * - First generation: Completely random box selection (independent of title, niche, platform)
 * - Regeneration: Random selection from unused boxes (no repeats until all boxes are used)
 * - When all boxes are used, cycle resets and starts again
 * 
 * This ensures:
 * 1. Completely random selection for first generation
 * 2. No repeats during regeneration cycle (all boxes used before any repeat)
 * 3. Works with any number of boxes (automatically adapts to IMAGE_BOX_PROMPTS.length)
 * 
 * @param usedBoxIndices - Set of box indices already used for this article (empty for first generation)
 * @returns The selected ImageBoxPrompt and its index
 */
export function selectImageBoxPrompt(
  usedBoxIndices: Set<number> = new Set()
): { box: ImageBoxPrompt; index: number } {
  if (IMAGE_BOX_PROMPTS.length === 0) {
    throw new Error("IMAGE_BOX_PROMPTS array is empty. Please add image box prompt components.");
  }
  
  // If all boxes have been used, reset the cycle
  const availableIndices = usedBoxIndices.size >= IMAGE_BOX_PROMPTS.length
    ? Array.from({ length: IMAGE_BOX_PROMPTS.length }, (_, i) => i) // All boxes available
    : Array.from({ length: IMAGE_BOX_PROMPTS.length }, (_, i) => i)
        .filter(i => !usedBoxIndices.has(i)); // Only unused boxes
  
  // Random selection from available boxes
  const randomIndex = Math.floor(Math.random() * availableIndices.length);
  const selectedIndex = availableIndices[randomIndex];
  
  return {
    box: IMAGE_BOX_PROMPTS[selectedIndex],
    index: selectedIndex,
  };
}

