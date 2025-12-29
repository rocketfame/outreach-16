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

    // Analyze image style using GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // GPT-4 Vision model
      messages: [
        {
          role: "system",
          content: `You are an expert art director and visual style analyst. Your job is to analyze reference images and extract detailed style descriptions that can be used to generate similar images.

Analyze the provided image and create a comprehensive style description that includes:

1. ART STYLE & TECHNIQUE:
   - Illustration style (flat 2D, 3D, vector, painterly, digital art, etc.)
   - Art technique (line art, gradients, textures, shadows, etc.)
   - Overall aesthetic (minimalist, detailed, abstract, realistic, etc.)

2. CHARACTER DESIGN (if present):
   - Character proportions and style
   - Facial features and expressions
   - Clothing style and details
   - Pose and composition

3. COLOR PALETTE:
   - Dominant colors
   - Color harmony (complementary, monochrome, triadic, etc.)
   - Brightness and saturation levels
   - Background colors

4. COMPOSITION:
   - Layout and framing
   - Focal point
   - Use of negative space
   - Perspective and angles

5. VISUAL ELEMENTS:
   - Abstract shapes, patterns, or graphic elements
   - Typography style (if any)
   - Logo integration (if any)
   - Decorative elements

6. MOOD & ATMOSPHERE:
   - Overall feeling and tone
   - Energy level (calm, dynamic, energetic, etc.)
   - Style era or cultural references

Format your response as a clear, detailed text description that can be directly used in image generation prompts. Focus on visual characteristics that would help recreate a similar style. Be specific about colors, techniques, and composition.

Do NOT describe what the image shows (content/subject matter), focus ONLY on visual style, technique, and aesthetic characteristics.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
              },
            },
            {
              type: "text",
              text: "Analyze the visual style of this image and provide a detailed style description that can be used to generate similar images.",
            },
          ],
        },
      ],
      max_tokens: 1000,
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
