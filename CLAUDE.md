# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm install                  # Install dependencies
npx playwright install webkit  # Install WebKit browser
npm run build                # Compile TypeScript to dist/
npm run dev                  # Watch mode compilation
npm start                    # Run the CLI (after build)
```

## Architecture

This is a TypeScript library providing headless browser automation via Playwright WebKit. It has three modes of operation:

1. **CLI** (`src/cli.ts`) - Direct command-line usage for screenshots, clicking, typing, and querying
2. **Server** (`src/server.ts`) - HTTP server accepting JSON commands via POST requests
3. **Library** (`src/index.ts`) - Programmatic API via `ClaudeBrowser` class

### Core Components

- **ClaudeBrowser** (`src/browser.ts`) - Main class wrapping Playwright WebKit. Handles browser lifecycle, navigation, and all DOM interactions. Uses `executeCommand()` to process typed command objects.
- **BrowserServer** (`src/server.ts`) - HTTP server that wraps ClaudeBrowser. Accepts JSON POST requests and returns JSON responses. CORS-enabled.
- **Types** (`src/types.ts`) - Discriminated union of command types (`BrowserCommand`) and response types (`CommandResponse`).

### Command Flow

Commands are typed objects with a `cmd` discriminator:
```typescript
{ cmd: 'goto', url: string }
{ cmd: 'click', selector: string }
{ cmd: 'type', selector: string, text: string }
{ cmd: 'query', selector: string }
// etc.
```

All commands return `{ ok: true, ...data }` or `{ ok: false, error: string }`.

## CLI Options

Key flags: `-s <port>` (server mode), `-q <selector>` (query), `-c <selector>` (click), `-t <sel>=<text>` (type), `-i` (interactive), `--headed` (visible browser).
