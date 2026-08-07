# Outreach Articles App / Universal Content Creator

A Next.js (App Router + TypeScript) tool that moves outreach teams from a short brief to topic ideas, outlines, and article drafts. OpenAI API is the default text and image provider; an external OpenAI-compatible text endpoint is optional.

## Features

- **Topic Discovery Mode**: Generate 5-8 deep, non-generic article topics with comprehensive briefs
- **Article Generation**: Create SEO-optimized outreach articles with HTML formatting
- **State Persistence**: All data (topics, articles, form inputs) persists in localStorage
- **Figma MCP Integration**: Pull design frames directly from Figma for component updates

## Run locally

1. Create a `.env.local` file with OpenAI credentials:

   ```bash
   OPENAI_API_KEY=sk-...
   OPENAI_TEXT_MODEL=gpt-5.5 # optional; this is the default
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 to use the Outreach Articles App UI.

## Figma MCP Setup

This project supports Figma MCP integration for design-driven component updates. See [FIGMA_MCP_SETUP.md](./FIGMA_MCP_SETUP.md) for detailed setup instructions.

Quick setup:
1. Get your Figma Personal Access Token from [Figma Settings](https://www.figma.com/settings)
2. Copy `.cursor/mcp.json.example` to `.cursor/mcp.json`
3. Replace `your-figma-personal-access-token-here` with your actual token
4. Restart Cursor

## How it works

- `app/page.tsx` renders the workflow (Brief → Topics → Articles) with React hooks and fetch calls to the backend.
- `app/api/generate-topics/route.ts` generates topic clusters with deep briefs using the topic research prompt.
- `app/api/articles/route.ts` generates SEO-optimized articles using the article prompt.
- The app uses only built-in CSS (`app/globals.css`) for styling, so it can run anywhere `npm run dev` is available.
- State persistence via `app/hooks/usePersistentAppState.ts` saves all data to localStorage.

## Project Structure

- `app/page.tsx` - Main UI component with all state management
- `app/globals.css` - Global styles and component styling
- `app/hooks/usePersistentAppState.ts` - localStorage persistence hook
- `app/components/LoadingOverlay.tsx` - Loading animation component
- `lib/topicPrompt.ts` - Topic generation prompt builder
- `lib/articlePrompt.ts` - Article generation prompt builder
- `app/api/generate-topics/route.ts` - Topic generation API
- `app/api/articles/route.ts` - Article generation API
