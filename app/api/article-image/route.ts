// app/api/article-image/route.ts
// Hero image generation endpoint for articles

import { getOpenAIClient, validateApiKeys } from "@/lib/config";
import { getCostTracker } from "@/lib/costTracker";
import { selectImageBoxPrompt, buildImagePromptFromBox } from "@/lib/imageBoxPrompts";

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
  customStyle?: string; // Optional: personalized style description learned from reference images
  usedBoxIndices?: number[]; // Optional: array of box indices already used for this article (for random selection without repeats)
}

export interface ArticleImageResponse {
  success: boolean;
  imageBase64?: string; // raw base64 from OpenAI, no prefix
  selectedBoxIndex?: number; // Index of the selected box (for tracking used boxes)
  error?: string;
}

/**
 * Build image generation prompt from article metadata
 * Each image gets a unique style, technique, and approach for maximum variety
 * @returns Object with prompt and selected box index (if using Image Box system)
 */
function buildImagePrompt(params: {
  articleTitle: string;
  niche: string;
  mainPlatform: string;
  contentPurpose: string;
  brandName: string;
  customStyle?: string; // Optional personalized style from reference images
  usedBoxIndices?: number[]; // Optional: array of box indices already used for this article
}): { prompt: string; selectedBoxIndex?: number } {
  const { articleTitle, niche, mainPlatform, contentPurpose, brandName, customStyle, usedBoxIndices = [] } = params;

  // Deterministic hash function for consistent "randomness" based on input
  const getHash = (str: string) => str.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Character-focused approaches prioritized - modern digital art, Red Dot style
  // Emphasis on stylized characters, abstract compositions, NOT technical details
  const visualApproaches = [
    {
      type: "character_abstract",
      description: `MAIN FOCUS: Bold stylized character (60-70% of composition) representing ${niche} culture. Modern digital art illustration style - Red Dot award-winning graphic design aesthetic. Character in expressive pose, dynamic composition. ${mainPlatform} logo integrated organically: on clothing pattern, as floating abstract shape, in background as subtle element, or as part of character's accessories. Abstract geometric shapes and flowing forms around character, NOT technical equipment. Clean, sophisticated, contemporary editorial illustration.`,
    },
    {
      type: "character_minimalist",
      description: `MAIN FOCUS: Minimalist stylized character (60-70% of composition) in flat 2D style with bold outlines. Red Dot graphic design aesthetic - sophisticated, award-winning quality. Character represents ${niche} (musician/creator/artist). ${mainPlatform} logo as abstract element: integrated into character silhouette, as negative space, or as floating geometric shape. Abstract background with flowing forms, geometric patterns, or color blocks. NO technical details, NO buttons, NO screens, NO equipment. Pure graphic design excellence.`,
    },
    {
      type: "character_editorial",
      description: `MAIN FOCUS: Editorial illustration character (60-70% of composition) in New Yorker/Red Dot style - sophisticated, conceptual, visually striking. Character in dynamic pose related to ${niche}. ${mainPlatform} logo as creative element: woven into character's clothing design, as abstract symbol in background, or integrated into composition as graphic element. Abstract shapes, flowing lines, and bold color blocks around character. Professional magazine cover quality. NO isometric 3D, NO technical UI elements, NO childish style.`,
    },
    {
      type: "character_street_art",
      description: `MAIN FOCUS: Street art/graffiti-inspired character (60-70% of composition) with high contrast, bold colors. Modern digital art interpretation of street art aesthetic. Character represents ${niche} culture. ${mainPlatform} logo as street art element: on character's clothing, as tag/graffiti element, or as abstract symbol. Abstract spray paint effects, flowing lines, geometric patterns. Dynamic, energetic composition. Professional digital art, NOT childish.`,
    },
    {
      type: "abstract_composition",
      description: `Abstract composition with stylized character (40-50% of composition) and flowing abstract forms. Red Dot design agency aesthetic - experimental, high-concept, minimalist yet impactful. ${mainPlatform} logo as abstract geometric shape integrated into composition. Character partially visible or in silhouette. Abstract shapes, flowing lines, bold color fields. Sophisticated contemporary digital art. NO technical elements, NO isometric 3D, NO equipment.`,
    },
    {
      type: "character_geometric",
      description: `MAIN FOCUS: Character (60-70% of composition) constructed from geometric shapes and abstract forms. Modern graphic design style - Red Dot aesthetic. Character represents ${niche}. ${mainPlatform} logo as geometric element: part of character's form, as abstract shape, or integrated into background pattern. Bold geometric patterns, clean lines, sophisticated color blocks. Contemporary digital art illustration. NO technical details, NO buttons, NO screens.`,
    },
    {
      type: "character_flowing",
      description: `MAIN FOCUS: Character (60-70% of composition) with flowing, organic abstract forms around them. Modern digital art style - award-winning graphic illustration. Character in expressive pose related to ${niche}. ${mainPlatform} logo as flowing abstract element: integrated into character's movement, as part of background flow, or as organic shape. Abstract flowing lines, color gradients, organic forms. Sophisticated editorial illustration. NO technical elements, NO isometric 3D.`,
    },
    {
      type: "character_negative_space",
      description: `MAIN FOCUS: Character (60-70% of composition) using negative space and bold shapes. Ultra-minimalist Red Dot design aesthetic. Character represents ${niche}. ${mainPlatform} logo created through negative space or as bold geometric element. Abstract composition with strong contrast, clean lines, sophisticated simplicity. Contemporary graphic design excellence. NO technical details, NO equipment, NO childish elements.`,
    },
  ];

  // Randomly select approach based on article title hash for consistency
  const approachIndex = Math.abs(
    articleTitle.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % visualApproaches.length;
  const selectedApproach = visualApproaches[approachIndex];

  // Modern digital art styles - Red Dot graphic design aesthetic
  // Professional, sophisticated, contemporary illustration
  const artStyles = [
    "modern flat 2D digital illustration with bold solid colors and clean shapes - Red Dot award-winning graphic design style",
    "contemporary editorial illustration with bold outlines and expressive forms - sophisticated magazine cover quality",
    "minimalist graphic design with negative space and geometric precision - Red Dot design agency aesthetic",
    "stylized character illustration in flat 2D style with bold colors - modern digital art excellence",
    "abstract geometric composition with flowing forms - contemporary graphic design",
    "sophisticated vector illustration with clean lines and bold shapes - award-winning design quality",
    "modern flat design with subtle depth and sophisticated color blocks - Red Dot aesthetic",
    "contemporary editorial illustration style - New Yorker meets Red Dot design agency",
    "bold graphic illustration with high contrast and expressive character design - modern digital art",
    "minimalist yet impactful illustration with geometric forms - Red Dot design excellence",
    "sophisticated flat illustration with organic and geometric elements - contemporary graphic design",
    "award-winning editorial illustration style - conceptual, visually striking, professional quality",
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

  // Select logo integration method based on approach type - all character/abstract focused
  const logoMethods: Record<string, string> = {
    character_abstract: "Logo integrated organically: on character's clothing pattern, as floating abstract shape, in background as subtle element, or as part of character's accessories",
    character_minimalist: "Logo as abstract element: integrated into character silhouette, as negative space, or as floating geometric shape",
    character_editorial: "Logo as creative element: woven into character's clothing design, as abstract symbol in background, or integrated into composition as graphic element",
    character_street_art: "Logo as street art element: on character's clothing, as tag/graffiti element, or as abstract symbol",
    abstract_composition: "Logo as abstract geometric shape integrated into composition",
    character_geometric: "Logo as geometric element: part of character's form, as abstract shape, or integrated into background pattern",
    character_flowing: "Logo as flowing abstract element: integrated into character's movement, as part of background flow, or as organic shape",
    character_negative_space: "Logo created through negative space or as bold geometric element",
  };
  const logoMethod = logoMethods[selectedApproach.type] || "Logo integrated naturally as abstract element";

  // Reference styles from top-tier publications and agencies - Red Dot prioritized
  const editorialStyles = [
    "Red Dot Design Agency: Award-winning design agency aesthetic, minimalist yet impactful, experimental compositions, unexpected colors, high-concept visuals, sophisticated contemporary graphic design.",
    "The New Yorker meets Red Dot: Sophisticated editorial illustration with Red Dot design agency quality, bold colors, expressive line work, conceptual depth, visually striking, award-winning graphic design.",
    "Red Dot Graphic Design: Modern digital art illustration, minimalist yet impactful, experimental compositions, high-concept visuals, professional award-winning quality.",
    "Contemporary Editorial Illustration: Red Dot design agency style, sophisticated, minimalist yet impactful, experimental, high-concept, award-winning graphic design excellence.",
    "Modern Digital Art: Red Dot award-winning design agency aesthetic, sophisticated contemporary illustration, minimalist yet impactful, experimental compositions, professional graphic design quality.",
  ];
  const editorialStyleIndex = Math.abs(getHash(articleTitle + mainPlatform)) % editorialStyles.length;
  const selectedEditorialStyle = editorialStyles[editorialStyleIndex];

  // TWO DIFFERENT PROMPT STRATEGIES:
  // 1. If customStyle exists (reference image provided) - focus ENTIRELY on reproducing that style
  // 2. If no customStyle - use default algorithm with all requirements

  let prompt: string;
  let selectedBoxIndex: number | undefined = undefined;

  if (customStyle && customStyle.trim()) {
    // REFERENCE IMAGE MODE: Generate image in the EXACT style of the reference
    // The customStyle description is the PRIMARY goal - everything else is secondary
    prompt = `Create an image for "${articleTitle}" (Niche: ${niche}, Platform: ${mainPlatform}) that REPRODUCES THE EXACT VISUAL STYLE described below.

================================
REFERENCE STYLE - PRIMARY OBJECTIVE
================================

Your MAIN GOAL is to generate an image that matches this visual style EXACTLY:
${customStyle.trim()}

CRITICAL: Reproduce this style precisely. If the reference style is minimalist with a monotone background, generate it that way. If it's vibrant and colorful, generate it that way. Match the art technique, colors, composition, character design, and overall aesthetic EXACTLY as described.

CONTENT CONTEXT:
- Topic: ${articleTitle}
- Niche: ${niche}
- Platform: ${mainPlatform}

TECHNICAL REQUIREMENTS:
- Integrate ${mainPlatform} logo organically (subtle, as part of the composition - NOT prominent or added on top)
- Format: 16:9 horizontal hero image
- Professional quality - NOT childish, NOT generic AI style

STYLE PRESERVATION:
- DO NOT add elements that conflict with the reference style (e.g., if reference is minimalist, don't add complex compositions)
- DO NOT change colors if the reference style specifies them
- DO NOT alter the art technique described in the reference style
- Match the composition style, background treatment, and visual mood EXACTLY as described

Generate an image that looks like it was created by the same artist using the same visual language as the reference style above.`.trim();
  } else {
    // DEFAULT MODE: Use Image Box Prompt component system
    try {
      const usedIndicesSet = new Set(usedBoxIndices);
      const { box: selectedBox, index: selectedIndex } = selectImageBoxPrompt(usedIndicesSet);
      selectedBoxIndex = selectedIndex;
      prompt = buildImagePromptFromBox(selectedBox, {
        articleTitle,
        niche,
        mainPlatform,
        brandName,
      });
      
      debugLog({
        location: 'buildImagePrompt',
        message: 'Selected Image Box Prompt component',
        data: {
          boxId: selectedBox.id,
          boxName: selectedBox.name,
          boxIndex: selectedIndex,
          articleTitle,
          usedBoxIndices: Array.from(usedIndicesSet),
        },
      });
    } catch (error) {
      // Fallback to legacy prompt if Image Box Prompts are not configured
      console.warn("[buildImagePrompt] Image Box Prompts not available, using legacy prompt:", error);
      prompt = `Create a sophisticated modern digital art illustration for "${articleTitle}". Niche: ${niche}, Platform: ${mainPlatform}.

CRITICAL STYLE REQUIREMENTS - RED DOT DESIGN AGENCY AESTHETIC:
- Modern contemporary digital art illustration - award-winning graphic design quality
- Red Dot design agency style: minimalist yet impactful, experimental compositions, high-concept visuals
- Professional editorial illustration level - NOT childish, NOT generic AI style, NOT isometric 3D
- Sophisticated, sophisticated, sophisticated - this is premium graphic design

MANDATORY FORBIDDEN ELEMENTS (STRICTLY PROHIBITED):
- NO isometric 3D blocks, cubes, or 3D geometric shapes
- NO technical equipment: NO equalizers, NO buttons, NO screens, NO keyboards, NO control panels
- NO UI elements: NO dashboards, NO interfaces, NO displays, NO modules
- NO childish or game-like aesthetic
- NO text on image
- NO teal/orange/gold color clichés

REQUIRED FOCUS - CHARACTER + ABSTRACTION:
${selectedApproach.description}

ART STYLE: ${selectedStyle}

COLOR PALETTE: ${selectedPalette}. VIBRANT, DIVERSE, BOLD contrasting combinations. Sophisticated color choices.

LOGO INTEGRATION: ${mainPlatform} logo must be integrated organically as abstract element: on character's clothing pattern, as floating geometric shape, in background as subtle element, or as part of character's accessories. Logo should feel like natural part of composition, NOT added on top.

COMPOSITION REQUIREMENTS:
- Character-focused: if character is present, it should be 60-70% of composition
- Abstract elements: flowing forms, geometric shapes, color blocks, organic lines
- Dynamic, asymmetric layout with strong focal point
- Creative negative space
- Unusual angles: close-up, bird's eye, low angle, or Dutch tilt
- Natural perspective (NOT isometric)

QUALITY STANDARDS:
- Editorial magazine cover level quality
- Red Dot award-winning design agency aesthetic
- Contemporary graphic design excellence
- Professional digital art illustration
- Avoid generic AI styles completely
- This must look like work from a top-tier design agency

BRAND MOOD: Subtle ${brandName} atmosphere through color and composition. No heavy branding or text.

FORMAT: 16:9 horizontal hero image.

Remember: This is MODERN DIGITAL ART with CHARACTERS and ABSTRACTIONS. NOT technical equipment, NOT isometric 3D, NOT childish style. Professional Red Dot design agency quality.`.trim();
    }
  }
  
  // Ensure prompt is under 4000 characters (DALL-E 3 limit)
  if (prompt.length > 4000) {
    if (customStyle && customStyle.trim()) {
      // Reference mode: truncate customStyle if needed (keep core content)
      const excessLength = prompt.length - 3900; // Leave 100 char buffer
      if (excessLength > 0 && customStyle.trim().length > excessLength + 200) {
        // Truncate customStyle content from the end, keeping important style info
        const maxCustomStyleLength = customStyle.trim().length - excessLength - 50;
        const truncatedCustomStyle = customStyle.trim().substring(0, maxCustomStyleLength) + "...";
        prompt = prompt.replace(customStyle.trim(), truncatedCustomStyle);
      }
    } else {
      // Default mode: truncate approach description if needed
      const excessLength = prompt.length - 3900;
      const approachLength = selectedApproach.description.length;
      if (approachLength > excessLength + 50) {
        const maxApproachLength = approachLength - excessLength;
        const truncatedApproach = selectedApproach.description.substring(0, maxApproachLength) + "...";
        prompt = prompt.replace(selectedApproach.description, truncatedApproach);
      }
    }
    
    // Final safety truncation if still too long
    if (prompt.length > 4000) {
      prompt = prompt.substring(0, 4000).trim();
    }
  }
  
  return { prompt, selectedBoxIndex };
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
    const { articleTitle, niche, mainPlatform, contentPurpose, brandName, customStyle, usedBoxIndices = [] } = body;

    // #region agent log
    const bodyLog = {location:'article-image/route.ts:POST',message:'Request body parsed',data:{articleTitle,niche,mainPlatform,contentPurpose,brandName,customStyle:customStyle?.substring(0,100),usedBoxIndices},timestamp:Date.now(),sessionId:'debug-session',runId:'article-image',hypothesisId:'image-generation'};
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
    const { prompt: promptText, selectedBoxIndex } = buildImagePrompt({
      articleTitle,
      niche,
      mainPlatform,
      contentPurpose,
      brandName,
      customStyle,
      usedBoxIndices,
    });
    
    // Ensure prompt is under 4000 characters (DALL-E 3 limit)
    let prompt = promptText;
    if (prompt.length > 4000) {
      console.warn(`[article-image] Prompt too long (${prompt.length} chars), truncating to 4000`);
      prompt = prompt.substring(0, 4000).trim();
    }
    
    debugLog({ location: 'article-image/route.ts:POST', message: 'Prompt built', data: { promptLength: prompt.length, selectedBoxIndex } });

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
      JSON.stringify({ success: true, imageBase64, selectedBoxIndex }),
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

