# Hero Image Generation Feature

## ✅ Implementation Complete

A new optional hero image generation feature has been added to the article generation workflow.

## What Was Added

### 1. Backend API Route

**File:** `app/api/article-image/route.ts`

- **Endpoint:** `POST /api/article-image`
- **Request Body:**
  ```json
  {
    "articleTitle": "string",
    "niche": "string",
    "mainPlatform": "string",
    "contentPurpose": "string",
    "brandName": "string"
  }
  ```
- **Response:**
  ```json
  {
    "success": boolean,
    "imageBase64": "string", // raw base64, no prefix
    "error": "string" // if success is false
  }
  ```

**Features:**
- Uses existing OpenAI client from `lib/config.ts`
- Calls OpenAI Images API (GPT-5.2 model)
- Returns base64 image data (no file system writes)
- Comprehensive error handling and logging
- Validates all required fields

### 2. Frontend UI

**File:** `app/page.tsx`

**Added State:**
- `articleImages` - Map storing base64 images by topicId
- `isGeneratingImage` - Set tracking which articles are generating images

**Added Functions:**
- `generateArticleImage(topicId)` - Handles image generation
- `createSlug(title)` - Creates safe filename from title

**UI Components:**
- "Generate hero image for this article" button (shown when no image exists)
- Loading state ("Generating image…") while generating
- Image display with 16:9 aspect ratio
- Download button (downloads as PNG)
- Remove image button

**Location:**
- Appears in the article result card, after the article content
- Only visible for articles with status "ready"
- Styled with existing design system

### 3. Styling

**File:** `app/globals.css`

Added CSS classes:
- `.article-image-section` - Container for image generation UI
- `.btn-generate-image` - Full-width generate button
- `.image-generating` - Loading state styling
- `.article-image-container` - Image wrapper
- `.article-hero-image` - Image styling (16:9, responsive)
- `.article-image-actions` - Button container for download/remove

## How It Works

1. **User generates an article** (existing flow, unchanged)
2. **Article is displayed** with status "ready"
3. **User clicks "Generate hero image"** button
4. **Frontend collects data:**
   - `articleTitle` - from article's titleTag or topic workingTitle
   - `niche` - from Project Basics
   - `mainPlatform` - from Project Basics platform field
   - `contentPurpose` - from Project Basics contentPurpose field
   - `brandName` - hardcoded "PromosoundGroup"
5. **POST request sent** to `/api/article-image`
6. **Backend:**
   - Validates API keys
   - Builds image prompt using `buildImagePrompt()`
   - Calls OpenAI Images API (GPT-5.2 model, 1792x1024, b64_json)
   - Returns base64 image data
7. **Frontend:**
   - Receives base64 data
   - Stores in `articleImages` Map
   - Displays image using `data:image/png;base64,...` URL
   - Shows download and remove buttons

## Image Prompt

The `buildImagePrompt()` function creates a detailed prompt that:
- Describes the article topic and context
- Specifies visual style (modern, concept art, motion graphics)
- Includes brand context subtly
- Avoids AI clichés and generic stock photo style
- Ensures 16:9 horizontal hero format

## Constraints Met

✅ **No changes to existing article generation logic**  
✅ **No changes to prompts or modes**  
✅ **No file system writes** (all in-memory base64)  
✅ **Uses existing OpenAI client configuration**  
✅ **Minimal UI changes** (only added image section)  
✅ **Separate, optional feature** (doesn't affect core workflow)  

## Files Modified

1. `app/api/article-image/route.ts` - **NEW FILE** - API endpoint
2. `app/page.tsx` - Added image generation state and UI
3. `app/globals.css` - Added image section styling

## Testing

To test:
1. Generate an article (any mode)
2. Wait for article to be ready
3. Click "Generate hero image for this article"
4. Wait for generation (may take 10-30 seconds)
5. Image should appear with download/remove options
6. Test download functionality
7. Test remove functionality

## Notes

- Image generation uses GPT-5.2 model (OpenAI Images API)
- Images are 1792x1024 pixels (16:9 aspect ratio)
- Base64 images are stored in React state (not persisted)
- Images are lost on page refresh (by design - no server storage)
- Uses same OpenAI API key as article generation

