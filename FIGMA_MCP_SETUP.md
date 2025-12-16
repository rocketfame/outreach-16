# Figma MCP Setup Guide

## Overview

This guide explains how to set up Figma MCP (Model Context Protocol) integration for the Universal Content Creator project, allowing the AI agent to pull selected Figma frames as design context.

## Prerequisites

1. **Figma Account** with access to the design file
2. **Figma Personal Access Token** (for API access)
3. **Cursor IDE** with MCP support enabled

## Step 1: Get Figma Personal Access Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Navigate to "Personal Access Tokens"
3. Click "Create a new personal access token"
4. Give it a name (e.g., "Cursor MCP Integration")
5. Copy the token (you'll only see it once)

## Step 2: Configure Figma MCP in Cursor

### Option A: Using Cursor Settings (Recommended)

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Navigate to "Features" → "MCP Servers"
3. Add a new MCP server with the following configuration:

```json
{
  "name": "figma",
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-figma"
  ],
  "env": {
    "FIGMA_PERSONAL_ACCESS_TOKEN": "your-figma-token-here"
  }
}
```

### Option B: Manual Configuration

Create or update `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-figma"
      ],
      "env": {
        "FIGMA_PERSONAL_ACCESS_TOKEN": "your-figma-token-here"
      }
    }
  }
}
```

## Step 3: Install Figma MCP Server (if needed)

The MCP server will be installed automatically via `npx`, but you can also install it globally:

```bash
npm install -g @modelcontextprotocol/server-figma
```

## Step 4: Verify Connection

1. Restart Cursor
2. Open the Command Palette (Cmd/Ctrl + Shift + P)
3. Search for "MCP: List Available Tools"
4. You should see Figma-related tools like:
   - `figma_get_file`
   - `figma_get_node`
   - `figma_list_files`

## Step 5: Using Figma MCP in Conversations

### Basic Usage

When you want to update a component based on a Figma design:

1. **Select the frame in Figma** and copy its URL or node ID
2. **In Cursor chat**, mention the Figma frame:
   ```
   "Update the mode switch component to match this Figma frame: [frame URL]"
   ```
3. **The agent will**:
   - Use Figma MCP to fetch frame details
   - Extract design tokens (colors, spacing, typography)
   - Update the component code accordingly

### Example Prompts

```
"Pull the 'Topic Discovery Mode' frame from Figma file [file-key] and update the mode switch component to match"
```

```
"Use Figma frame [node-id] as reference to update the article preview modal styling"
```

```
"Extract design tokens from Figma frame [URL] and apply them to the loading overlay component"
```

## Step 6: Environment Variables

If you prefer using environment variables instead of hardcoding the token:

1. Create `.env.local` (already exists for OpenAI):
   ```bash
   FIGMA_PERSONAL_ACCESS_TOKEN=your-token-here
   ```

2. Update MCP config to read from env:
   ```json
   {
     "env": {
       "FIGMA_PERSONAL_ACCESS_TOKEN": "${FIGMA_PERSONAL_ACCESS_TOKEN}"
     }
   }
   ```

## Troubleshooting

### MCP Server Not Found

- Ensure `@modelcontextprotocol/server-figma` is accessible via `npx`
- Try installing globally: `npm install -g @modelcontextprotocol/server-figma`

### Authentication Errors

- Verify your Figma token is valid and not expired
- Check token permissions in Figma account settings

### Frame Not Found

- Ensure you have access to the Figma file
- Verify the frame/node ID is correct
- Check that the file is not private or restricted

## Security Notes

- **Never commit** your Figma token to version control
- Add `.cursor/mcp.json` to `.gitignore` if it contains tokens
- Use environment variables for tokens in production

## Additional Resources

- [Figma API Documentation](https://www.figma.com/developers/api)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Figma MCP Server GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/figma)


