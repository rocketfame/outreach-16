# Outreach Articles App / Universal Content Creator

A minimal Next.js (App Router + TypeScript) tool that helps outreach teams move from a short brief to topic ideas, outlines, and article drafts with a single page UI. All AI calls run through the OpenAI Chat Completions API using the `gpt-5.2` model.

## Features

- **Topic Discovery Mode**: Generate 5-8 deep, non-generic article topics with comprehensive briefs
- **Article Generation**: Create SEO-optimized outreach articles with HTML formatting
- **State Persistence**: All data (topics, articles, form inputs) persists in localStorage
- **Figma MCP Integration**: Pull design frames directly from Figma for component updates

## Run locally

1. Create a `.env.local` file in the root directory with your API credentials:

   ```bash
   # OpenAI API Key (обов'язково)
   # Отримайте ключ на https://platform.openai.com/api-keys
   OPENAI_API_KEY=sk-...

   # Tavily Search API Key (обов'язково для генерації тем)
   # Отримайте ключ на https://tavily.com/
   # Або використайте безкоштовний dev ключ: tvly-dev-...
   TAVILY_API_KEY=tvly-...
   ```

   **Важливо:** 
   - Обидва ключі обов'язкові для роботи додатку
   - Додайте ключі **тільки один раз** в `.env.local` - вони автоматично використовуються в усіх частинах додатку
   - Вся конфігурація централізована в `lib/config.ts` (див. [CONFIGURATION.md](./CONFIGURATION.md))

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
