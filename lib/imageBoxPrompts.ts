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

