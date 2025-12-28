// app/api/article-image/route.ts
// Hero image generation endpoint for articles

import { getOpenAIClient, validateApiKeys } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";

// Simple debug logger
const debugLog = (...args: any[]) => {
  console.log("[article-image-debug]", ...args);
};

export interface ArticleImageRequest {
  articleTitle: string;
  niche: string;
  mainPlatform: string;
  contentPurpose: string;
  brandName: string;
}

export interface ArticleImageResponse {
  success: boolean;
  imageBase64?: string; // raw base64 from OpenAI, no prefix
  error?: string;
}

/**
 * Build image generation prompt from article metadata
 * Each image gets a unique style, technique, and approach for maximum variety
 */
function buildImagePrompt(params: {
  articleTitle: string;
  niche: string;
  mainPlatform: string;
  contentPurpose: string;
  brandName: string;
}): string {
  const { articleTitle, niche, mainPlatform, contentPurpose, brandName } = params;

  // Deterministic hash function for consistent "randomness" based on input
  const getHash = (str: string) => str.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Randomly select a visual approach for maximum variety
  // Each approach is based on real reference images to ensure authentic diversity
  // Character approach appears twice to increase selection frequency
  const visualApproaches = [
    {
      type: "character_with_logo",
      description: `Prominent stylized character as MAIN FOCUS (60-70% of composition). Style: flat 2D bold outlines, street art/graffiti high contrast, minimalist line art, retro poster, or New Yorker editorial illustration. ${mainPlatform} logo integrated on clothing/accessories/floating/background. Character represents ${niche} (musician/creator/artist). Logo feels organic, not added on.`,
    },
    {
      type: "character_with_logo_alt",
      description: `Prominent stylized character as MAIN FOCUS (60-70% of composition). Style: flat 2D bold outlines, street art/graffiti high contrast, minimalist line art, retro poster, or New Yorker editorial illustration. ${mainPlatform} logo integrated on clothing/accessories/floating/background. Character represents ${niche} (musician/creator/artist). Logo feels organic, not added on.`,
    },
    {
      type: "transparent_container",
      description: `Transparent container (capsule/jar/box) with ${mainPlatform} logo inside. Clear glossy material. Interior: creative elements related to ${niche} and ${mainPlatform} (objects/UI/abstract forms). Logo naturally integrated. Product photography style with dramatic lighting and reflections.`,
    },
    {
      type: "product_packaging",
      description: `Product packaging design: sealed pouches/boxes/containers with ${mainPlatform} logo. Product photography style, dramatic lighting/reflections/shadows. Real product look (gift cards/collectibles/subscription packages). Multiple packages arranged diagonally or grid. Include barcodes/labels. Dark textured background.`,
    },
    {
      type: "music_equipment",
      description: `Music equipment/synthesizer as main subject: modular synth with glowing modules/patch cables, vintage keyboard/piano, mixing board with faders, or turntable setup. ${mainPlatform} logo on screen/interface/label/glowing element. Dramatic lighting with warm glows. Minimalist dark/light solid background.`,
    },
    {
      type: "typography_object",
      description: `Large 3D typography as main subject: massive letter/word (${mainPlatform} or ${niche}) as glossy/inflated/sculptural object. Dominant element with person for scale. Dramatic perspective (low angle/side view). ${mainPlatform} logo in letter design/reflection/nearby. Dark background with strong contrast.`,
    },
    {
      type: "screen_head",
      description: `Surreal: person's head replaced by screen/monitor showing ${mainPlatform} logo and interface. Person in profile or from behind. Glossy glowing screen with platform UI. Body in different style (sketch/illustration/photorealistic) for contrast. Minimalist flat color/pattern background.`,
    },
    {
      type: "retro_display_units",
      description: `Retro-futuristic display units/modules in grid/pattern. Units: vintage monitor/keyboard key/digital display. Units spell ${niche}/${mainPlatform} words or show logo. Each unit glows (neon green/cyan/magenta/orange). Dark background, dramatic lighting. Vintage computer/arcade game aesthetic.`,
    },
    {
      type: "interior_scene",
      description: `Interior scene: person using ${mainPlatform}. Options: person in chair with headphones/speakers, studio setup with equipment, minimalist room with devices. ${mainPlatform} logo as floating elements/on screens/integrated naturally. Flat illustration style, bold colors, clean lines. Solid color background (light blue/pastel/dark). Details: coffee cups/music notes/UI elements.`,
    },
    {
      type: "cyberpunk_data",
      description: `Cyberpunk/data visualization: figure (behind/silhouette) surrounded by abstract UI elements/data visualizations/network diagrams. Neon colors (green/cyan/magenta) on dark black background. ${mainPlatform} logo in UI elements/dashboard/glowing elements. Digital realm aesthetic.`,
    },
    {
      type: "surreal_landscape",
      description: `Surreal desolate landscape with floating/prominent object featuring ${mainPlatform} logo. Options: dark moonscape with floating vintage TV/device, barren terrain with colorful path to structure, abstract landscape with impossible physics. Logo on floating object/integrated into landscape. Dramatic lighting, dark backgrounds, high contrast.`,
    },
    {
      type: "minimalist_logo",
      description: `Ultra-minimalist: ${mainPlatform} logo focus. Options: huge central with person for scale, integrated into bold shape, negative space, reflected/refracted creatively. Max 2-3 elements. Clean spacious sophisticated. Flat design or subtle gradients. Solid color or simple gradient background.`,
    },
    {
      type: "collage_mixed",
      description: `Creative collage mixing media: photography+illustration, vintage+modern digital, hand-drawn+digital renders, textures+flat shapes. ${mainPlatform} logo in different styles (photo/illustration/graphic). Each section has different visual treatment.`,
    },
  ];

  // Randomly select approach based on article title hash for consistency
  const approachIndex = Math.abs(
    articleTitle.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % visualApproaches.length;
  const selectedApproach = visualApproaches[approachIndex];

  // Randomly select art style - AVOID isometric 3D
  const artStyles = [
    "flat 2D illustration with bold solid colors, no gradients",
    "watercolor painting with soft edges and flowing colors",
    "minimalist line art with negative space",
    "photorealistic photography style with natural lighting",
    "hand-drawn sketch with visible pencil texture",
    "collage with vintage paper textures and modern elements",
    "vector illustration with flat shapes and bold outlines",
    "abstract geometric composition in 2D only",
    "stylized character design in flat illustration style",
    "retro poster design with bold typography",
    "modern flat design with subtle shadows only",
    "glitch art with clean digital elements",
    "soft pastel dreamscape in painting style",
    "product photography style on colored background",
    "macro photography with extreme close-up details",
    "vintage advertisement poster aesthetic",
  ];
  const styleIndex = Math.abs(
    (articleTitle + niche).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % artStyles.length;
  const selectedStyle = artStyles[styleIndex];

  // Randomly select color palette - vibrant, diverse, inspired by top editorial publications
  const colorPalettes = [
    "vibrant neon greens, magentas, and cyans on dark background - MTV energy",
    "warm sunset colors: deep oranges, hot pinks, and rich purples - Billboard vibrancy",
    "bold primary colors: bright reds, electric blues, and sunny yellows - high contrast editorial",
    "monochrome with one bold accent color: black/white with vibrant fuchsia or lime",
    "sophisticated jewel tones: emerald greens, sapphire blues, and ruby reds - New Yorker elegance",
    "high contrast black and white with one vibrant accent: neon yellow or electric blue",
    "earthy tones with pop: warm browns, forest greens, with bright coral or turquoise accents",
    "electric colors: bright yellows, electric blues, and hot pinks - youth culture aesthetic",
    "sophisticated muted palette with one vibrant pop: grays, navies, burgundies with bright orange or lime",
    "rainbow spectrum with selective saturation - Timeout urban energy",
    "deep rich colors: burgundy, navy, forest green with bright white and gold accents",
    "pastel explosion: soft pinks, lavenders, mint greens, buttery yellows - playful editorial",
    "monochrome gradient: black to white with one saturated color accent (red, blue, or green)",
    "tropical vibrancy: turquoise, coral, lime green, and sunny yellow - vacation editorial",
    "sophisticated dark: deep purples, dark blues, charcoal with bright neon accents",
  ];
  const paletteIndex = Math.abs(
    (mainPlatform + contentPurpose).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % colorPalettes.length;
  const selectedPalette = colorPalettes[paletteIndex];

  // Select logo integration method based on approach type
  const logoMethods: Record<string, string> = {
    transparent_container: "Logo inside transparent container, visible through clear material",
    character_with_logo: "Logo on character clothing/accessories/floating nearby",
    character_with_logo_alt: "Logo on character clothing/accessories/floating nearby",
    product_packaging: "Logo on product packaging with barcodes/labels",
    music_equipment: "Logo on equipment screen/interface/label",
    typography_object: "Logo in 3D typography/letter design",
    screen_head: "Logo on screen/monitor replacing head",
    retro_display_units: "Logo on retro display units/modules",
    interior_scene: "Logo as floating elements in interior",
    cyberpunk_data: "Logo in cyberpunk UI/dashboards",
    surreal_landscape: "Logo on floating objects in landscape",
    minimalist_logo: "Logo as minimalist focal point",
    collage_mixed: "Logo in different collage styles",
  };
  const logoMethod = logoMethods[selectedApproach.type] || "Logo integrated naturally";

  // Reference styles from top-tier publications and agencies
  const editorialStyles = [
    "The New Yorker: Sophisticated editorial illustration, bold colors, expressive line work, conceptual depth, witty and visually striking.",
    "MTV: Bold vibrant energetic visuals, high contrast, dynamic compositions, youth culture aesthetic, bright saturated colors, edgy design.",
    "Billboard: Music industry editorial, sleek modern, strong typography (visual only), bold colors, dramatic lighting, celebrity photography aesthetic.",
    "Timeout: Urban contemporary lifestyle visuals, clean compositions, sophisticated color palettes, mix of photography and illustration.",
    "Red Dot Agency: Award-winning design agency, minimalist yet impactful, experimental compositions, unexpected colors, high-concept visuals.",
  ];
  const editorialStyleIndex = Math.abs(getHash(articleTitle + mainPlatform)) % editorialStyles.length;
  const selectedEditorialStyle = editorialStyles[editorialStyleIndex];

  // Build concise prompt (must be under 4000 chars for DALL-E 3)
  const prompt = `
Retro–futuristic editorial hero image for the article "${articleTitle}".

You are an art director for a music-tech magazine working for the brand ${brandName || "Promosound"}.
Carefully read the full title and niche and create a scene that VISUALLY EXPLAINS the topic,
not a random generic instrument.

CONTEXT:
- Topic: ${articleTitle}
- Niche: ${niche}
- Main platform: ${mainPlatform}
- Content purpose: ${contentPurpose}

CORE VISUAL RULES (ALWAYS FOLLOW):
1) The main scene must clearly match the topic and setting.
   - If the title mentions festivals, events or tours: show a night festival scene with a crowd,
     stage lights, speakers, lasers, people dancing, and subtle UI / social elements around them.
   - If the title mentions playlists, algorithms, streams or stats: show futuristic screens,
     dashboards, sound-wave interfaces and a character interacting with data.
   - If the title mentions specific platforms (YouTube, TikTok, Spotify, Facebook, Instagram):
     include their logo shapes and UI elements as abstract, stylized icons on screens,
     clothing or floating panels (no plain screenshots).
   - If the title mentions a country, region or city (for example Ukraine, Germany, USA):
     reflect it in the mood, architecture silhouettes or light colors (for Ukraine: blue and yellow
     accents in lights or sky), not with literal flags or maps.
   - Never fall back to a single synthesizer, mixer or random studio shot if the title
     clearly describes a different context.

2) PromoSound art direction:
   - Retro-futuristic, cyberpunk-inspired editorial illustration.
   - 2D or 2.5D look, not isometric 3D.
   - Strong silhouettes, clean shapes, no photo-realism.
   - One or more stylized characters with tech / music gadgets, screens, helmets or devices,
     or a strong symbolic object in the center.
   - Composition looks like a magazine cover or campaign visual, not a stock photo.

3) Color and mood:
   - Bold, vibrant, high-contrast palettes in the spirit of the provided references:
     electric magenta, hot pink, cyan, deep blue, rich purple, neon accents on dark or solid
     backgrounds.
   - Avoid teal–orange clichés and avoid gold metallic dominance.
   - Use color to separate foreground characters from background tech and crowd.

4) Brand and platform integration:
   - Integrate ${mainPlatform} visual language and logo shape naturally into the scene:
     on screens, holograms, helmets, clothing patches or floating UI cards.
   - If ${brandName} is not empty, echo its mood only through color and atmosphere,
     not through visible text or big logos.
   - No readable text anywhere in the image (no titles, no UI labels, no slogans).

5) Composition:
   - Horizontal 16:9 hero image.
   - Dynamic, asymmetric layout with strong focal point.
   - Use interesting angles (low angle, slight Dutch tilt, close-up with deep background, etc.).
   - Background filled with abstract audio gear, social media icons, cables, dashboards,
     city silhouettes or festival structures, matching the topic.

6) Quality:
   - High-detail, polished editorial artwork, consistent with a unified promo campaign.
   - Every new image must feel unique but clearly part of the same visual universe as
     other Promosound images.
   - No generic AI artifacts, no messy anatomy, no random unrelated objects.

STYLE PRESET:
- Visual approach: ${selectedApproach.description}
- Art style: ${selectedStyle}
- Color palette: ${selectedPalette}
- Editorial reference: ${selectedEditorialStyle}
- Logo treatment: ${logoMethod}

Generate one single cohesive scene that obeys ALL rules above.
`.trim();
  
  // Ensure prompt is under 4000 characters
  if (prompt.length > 4000) {
    // If still too long, truncate the approach description
    const maxApproachLength = 4000 - (prompt.length - selectedApproach.description.length) - 100; // 100 char buffer
    const truncatedApproach = selectedApproach.description.substring(0, maxApproachLength);
    return prompt.replace(selectedApproach.description, truncatedApproach).trim();
  }
  
  return prompt;
}

export async function POST(req: Request) {
  // #region agent log
  const logEntry = {location:'article-image/route.ts:POST',message:'POST /api/article-image called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
  debugLog(logEntry);
  // #endregion

  // Validate API keys
  try {
    validateApiKeys();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("API key validation failed:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get OpenAI client
  const openai = getOpenAIClient();

  try {
    const body: ArticleImageRequest = await req.json();
    const { articleTitle, niche, mainPlatform, contentPurpose, brandName } = body;

    // #region agent log
    const bodyLog = {location:'article-image/route.ts:POST',message:'Request body parsed',data:{articleTitle,niche,mainPlatform,contentPurpose,brandName},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
    debugLog(bodyLog);
    // #endregion

    // Basic validation
    if (!articleTitle || !niche || !mainPlatform || !contentPurpose || !brandName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build image prompt
    let prompt = buildImagePrompt({
      articleTitle,
      niche,
      mainPlatform,
      contentPurpose,
      brandName,
    });
    
    // Ensure prompt is under 4000 characters (DALL-E 3 limit)
    if (prompt.length > 4000) {
      console.warn(`[article-image] Prompt too long (${prompt.length} chars), truncating to 4000`);
      prompt = prompt.substring(0, 4000).trim();
    }
    
    debugLog({ location: 'article-image/route.ts:POST', message: 'Prompt built', data: { promptLength: prompt.length } });

    // #region agent log
    const apiCallLog = {location:'article-image/route.ts:POST',message:'Calling OpenAI Images API',data:{model:'dall-e-3',size:'1792x1024'},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
    debugLog(apiCallLog);
    // #endregion

    // Call OpenAI Images API
    // Note: GPT-5.2 is for text generation (Chat Completions API), not image generation
    // For image generation, we must use DALL-E models (Images API)
    // DALL-E 3 supports sizes: "1024x1024", "1792x1024", "1024x1792"
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024", // horizontal hero, close to 16:9
      response_format: "b64_json",
    });

    const imageBase64 = imageResponse.data?.[0]?.b64_json;

    // Track cost
    const costTracker = getCostTracker();
    costTracker.trackOpenAIImageGeneration('dall-e-3', '1792x1024', 1);

    if (!imageBase64) {
      // #region agent log
      const errorLog = {location:'article-image/route.ts:POST',message:'Image generation failed - no base64 data',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
      debugLog(errorLog);
      // #endregion
      return new Response(
        JSON.stringify({ success: false, error: "Image generation failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // #region agent log
    const successLog = {location:'article-image/route.ts:POST',message:'Image generated successfully',data:{imageBase64Length:imageBase64.length},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
    debugLog(successLog);
    // #endregion

    return new Response(
      JSON.stringify({ success: true, imageBase64 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    // #region agent log
    const errorLog = {location:'article-image/route.ts:POST',message:'Image generation error',data:{error:(error as Error).message,errorName:(error as Error).name,errorCode:error?.code,errorStack:(error as Error).stack},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
    debugLog(errorLog);
    // #endregion
    console.error("article-image error", error);
    
    // Provide more detailed error message for debugging
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : "Internal server error";
    
    // Check for specific OpenAI API errors
    const isOpenAIError = error?.status || error?.response || error?.code;
    const detailedError = isOpenAIError 
      ? `OpenAI API error: ${errorMessage}${error?.code ? ` (code: ${error.code})` : ''}`
      : errorMessage;
    
    return new Response(
      JSON.stringify({ success: false, error: detailedError }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

