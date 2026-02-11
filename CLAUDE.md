# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm install                    # Install dependencies
npx playwright install webkit  # Install WebKit browser
npm run build                  # Compile TypeScript to dist/
npm run dev                    # Watch mode compilation
npm start                      # Run the CLI (after build)
```

## Lint, Format & Typecheck

```bash
npm run check                  # Run all checks (lint + format)
npm run fix                    # Fix all auto-fixable issues
npm run lint                   # Lint only
npm run lint:fix               # Lint with autofix
npm run format                 # Check formatting
npm run format:fix             # Fix formatting
npm run typecheck              # TypeScript type checking
```

## Code Style

- **Short methods**: Keep methods under 20 lines. Extract logic into focused helper methods.
- **Single responsibility**: Each class handles one concern. Split large classes by domain.
- **Class structure**:
  - `ClaudeBrowser` - browser lifecycle and page interactions
  - `BrowserServer` - HTTP server and request handling
  - `Logger` (planned) - colored console output
- **Naming**: Commands use `verbNoun` pattern (e.g., `getCookies`, `setStorage`).
- **Types**: All commands in discriminated union. Add new commands to `BrowserCommand` type.

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

### Command Categories

| Category | Commands |
|----------|----------|
| Navigation | `goto`, `back`, `forward`, `reload`, `wait` |
| Interaction | `click`, `type`, `hover`, `select`, `keys`, `scroll`, `upload` |
| Content | `query`, `screenshot`, `url`, `html`, `eval` |
| Debugging | `console`, `errors`, `network`, `intercept`, `metrics`, `a11y` |
| Storage | `cookies`, `storage`, `dialog`, `session_save`, `session_restore` |
| Viewport | `viewport`, `emulate` |
| Image | `favicon`, `convert`, `resize`, `crop`, `compress`, `thumbnail` |

### Event Listeners

The browser automatically captures events when launched:

- **Console**: `page.on('console')` - Captures all console messages
- **Errors**: `page.on('pageerror')` - Captures uncaught exceptions
- **Network**: `page.on('request/response/requestfailed')` - Captures all network activity
- **Dialogs**: `page.on('dialog')` - Handles alert/confirm/prompt dialogs

## CLI Options

Key flags: `-s <port>` (server mode), `-q <selector>` (query), `-c <selector>` (click), `-t <sel>=<text>` (type), `-i` (interactive), `--headed` (visible browser).

## Screenshots

Save screenshots to `screenshots/` directory:
```bash
curl localhost:13373 -d '{"cmd":"screenshot","path":"screenshots/page.png"}'
```

## MCP Server

The MCP server (`src/mcp.ts`) exposes all browser commands as tools. It uses stdio transport and auto-launches the browser on first command.

### Production Setup

Add to your project's `.mcp.json`:
```json
{
  "mcpServers": {
    "browse": {
      "command": "npx",
      "args": ["browse-mcp"]
    }
  }
}
```

Tools are then accessible as `mcp__browse__*` (e.g., `mcp__browse__goto`, `mcp__browse__screenshot`).

### Development (this project only)

This project uses a local `.mcp.json` pointing to `dist/mcp.js` for development. Use `npm run dev` for hot-reload during development.

### Launch Options

Use the `launch` tool to configure browser mode before navigating:

| Option | Default | Description |
|--------|---------|-------------|
| `headed` | `false` | Show browser window |
| `fullscreen` | `false` | Native fullscreen mode (macOS, implies headed) |
| `preview` | `false` | Highlight elements before actions with visual overlay |
| `previewDelay` | `2000` | Duration of preview highlight in ms |
| `width` | `1280` | Viewport width |
| `height` | `800` | Viewport height |

Example: Launch in fullscreen with preview mode:
```
mcp__browse__launch({ fullscreen: true, preview: true })
mcp__browse__goto({ url: "https://example.com" })
```

### Debugging Tools

```bash
# Get console logs
curl localhost:13373 -d '{"cmd":"console","level":"error"}'

# Get page errors
curl localhost:13373 -d '{"cmd":"errors"}'

# Get network requests (all or failed only)
curl localhost:13373 -d '{"cmd":"network","filter":"failed"}'

# Block requests matching pattern
curl localhost:13373 -d '{"cmd":"intercept","action":"block","pattern":"**/*ads*"}'

# Mock API response
curl localhost:13373 -d '{"cmd":"intercept","action":"mock","pattern":"**/api/*","status":200,"body":"{\"mock\":true}"}'

# Get performance metrics
curl localhost:13373 -d '{"cmd":"metrics","resources":true}'

# Get accessibility tree
curl localhost:13373 -d '{"cmd":"a11y"}'

# Emulate mobile device
curl localhost:13373 -d '{"cmd":"emulate","device":"iPhone 13"}'
```

### MCP Resources

Resources can be accessed via `@` mentions in Claude Code:

| Resource | Description |
|----------|-------------|
| `browser://state` | Current browser state |
| `browser://console` | Console messages |
| `browser://network` | All network requests |
| `browser://network/failed` | Failed requests only |
| `browser://errors` | Page errors |
| `browser://a11y` | Accessibility tree |
| `browser://html` | Page HTML (truncated) |
| `browser://screenshot` | Page screenshot |
