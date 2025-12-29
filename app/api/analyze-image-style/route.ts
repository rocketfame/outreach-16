// app/api/analyze-image-style/route.ts
// Analyze reference image style using GPT-4 Vision API

import { getOpenAIClient, validateApiKeys } from "@/lib/config";

export interface AnalyzeImageStyleRequest {
  imageBase64: string; // base64 encoded image (with or without data URL prefix)
}

export interface AnalyzeImageStyleResponse {
  success: boolean;
  styleDescription?: string;
  error?: string;
}

/**
 * Extract base64 data from data URL if present
 */
function extractBase64(imageData: string): string {
  // Remove data URL prefix if present (e.g., "data:image/png;base64,")
  if (imageData.includes(",")) {
    return imageData.split(",")[1];
  }
  return imageData;
}

export async function POST(req: Request) {
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
    const body: AnalyzeImageStyleRequest = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64 || !imageBase64.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing imageBase64 field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract base64 data
    const base64Data = extractBase64(imageBase64);

    // Analyze image style using GPT-5.2
    const response = await openai.chat.completions.create({
      model: "gpt-5.2", // GPT-5.2 for style analysis
      messages: [
        {
          role: "system",
          content: `You are an expert art director and visual style analyst with deep expertise in digital art, editorial illustration, and graphic design. Your job is to analyze reference images with extreme precision and extract comprehensive style descriptions that can be used to generate images in EXACTLY the same visual style.

CRITICAL: You must analyze EVERY visual detail with precision. Your description will be used to train an image generation AI to replicate this exact style. Missing details will result in incorrect style reproduction.

Analyze the provided image and create a COMPREHENSIVE, DETAILED style description that includes:

1. ART STYLE & TECHNIQUE (CRITICAL - analyze precisely):
   - Exact illustration style (flat 2D, 2.5D, 3D isometric, vector, painterly, photorealistic, digital collage, mixed media, etc.)
   - Specific art techniques (line art thickness, gradient types, texture patterns, shadow styles, rendering approach, etc.)
   - Overall aesthetic (minimalist, detailed, abstract, realistic, stylized, geometric, organic, etc.)
   - Visual quality level (high-end editorial, magazine cover, commercial, artistic, etc.)

2. CHARACTER DESIGN (if present - analyze in detail):
   - Character proportions (realistic, stylized, exaggerated, geometric)
   - Facial features style (detailed, simplified, abstract, realistic)
   - Facial expressions and mood
   - Hair style and rendering technique
   - Clothing style, details, and rendering approach
   - Accessories and their visual treatment
   - Body pose and composition
   - Skin texture and color treatment

3. COLOR PALETTE (ANALYZE EXACT COLORS):
   - Dominant colors with specific names (e.g., "electric magenta", "deep purple", "neon cyan")
   - Exact color harmony (complementary, monochrome, triadic, analogous, split-complementary, etc.)
   - Color saturation levels (vibrant, muted, pastel, neon, etc.)
   - Color brightness (dark, medium, bright, high-contrast, etc.)
   - Background color(s) and treatment
   - Color gradients (direction, smoothness, color transitions)
   - Accent colors and their placement
   - Color temperature (warm, cool, neutral, mixed)

4. COMPOSITION (ANALYZE STRUCTURE):
   - Layout type (centered, asymmetric, rule of thirds, etc.)
   - Framing and crop style
   - Focal point location and treatment
   - Use of negative space (extensive, minimal, balanced)
   - Perspective (frontal, side, 3/4, bird's eye, etc.)
   - Depth treatment (flat, shallow depth, deep, layered)
   - Balance and visual weight distribution

5. VISUAL ELEMENTS (ANALYZE ALL DETAILS):
   - Abstract shapes, patterns, geometric elements
   - Line styles (thick, thin, varied, uniform, organic, geometric)
   - Decorative elements and their style
   - Texture types and rendering (smooth, grainy, halftone, wireframe, etc.)
   - Typography style (if any) - font characteristics
   - Logo integration style (if any)
   - Graphic effects (glow, shadows, reflections, transparency, etc.)

6. MOOD & ATMOSPHERE (DESCRIBE FEELING):
   - Overall emotional tone (energetic, calm, mysterious, futuristic, retro, etc.)
   - Energy level (static, dynamic, flowing, energetic, meditative)
   - Style era or cultural references
   - Visual mood (dark, bright, dramatic, soft, bold, subtle, etc.)

7. SPECIFIC TECHNICAL DETAILS:
   - Lighting style (dramatic, soft, directional, ambient, colored lighting, etc.)
   - Rendering quality (polished, rough, stylized, photorealistic)
   - Edge treatment (hard edges, soft edges, mixed, anti-aliased, etc.)
   - Visual effects (glow, bloom, chromatic aberration, grain, etc.)
   - Any unique or distinctive visual characteristics

OUTPUT FORMAT:
Provide a detailed, structured description that can be directly used in image generation prompts. Be SPECIFIC about colors (use color names like "electric magenta", "deep purple", "neon cyan" not just "purple" or "blue"). Include exact techniques, proportions, and visual characteristics.

Do NOT describe what the image shows (content/subject matter like "a person" or "a face"). Focus EXCLUSIVELY on visual style, technique, aesthetic characteristics, colors, composition, and rendering approach.

Your description must be detailed enough that an AI image generator can replicate this EXACT visual style.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
                detail: "high", // Request high detail analysis
              },
            },
            {
              type: "text",
              text: "Analyze this image's visual style with extreme precision. Extract every detail about art technique, colors, composition, character design, visual elements, and mood. Provide a comprehensive style description that will allow an AI to generate images in EXACTLY this same visual style. Be specific about colors, techniques, and all visual characteristics.",
            },
          ],
        },
      ],
      max_tokens: 2000, // Increased for more detailed analysis
      temperature: 0.3, // Lower temperature for more precise, consistent analysis
    });

    const styleDescription = response.choices[0]?.message?.content?.trim();

    if (!styleDescription) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate style description" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, styleDescription }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Image style analysis error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : "Internal server error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
