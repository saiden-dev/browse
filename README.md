# @saiden/browse

[![npm version](https://img.shields.io/npm/v/@saiden/browse.svg)](https://www.npmjs.com/package/@saiden/browse)
[![CI](https://github.com/saiden-dev/browse/actions/workflows/ci.yml/badge.svg)](https://github.com/saiden-dev/browse/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@saiden/browse.svg)](https://nodejs.org)

#### Headless browser automation for Claude Code using Playwright WebKit.

<img width="1040" height="588" alt="image" src="https://github.com/user-attachments/assets/e5436f5c-b46d-4d1b-8f5a-54044969d095" />

## Installation

```bash
npm install @saiden/browse
npx playwright install webkit
```

## CLI Usage

```bash
# Take a screenshot
claude-browse https://example.com

# Custom viewport and output
claude-browse -o page.png -w 1920 -h 1080 https://example.com

# Query elements
claude-browse -q "a[href]" https://example.com
claude-browse -q "img" -j https://example.com  # JSON output

# Click and interact
claude-browse -c "button.submit" https://example.com
claude-browse -t "input[name=q]=hello" -c "button[type=submit]" https://google.com

# Chain actions
claude-browse -c ".cookie-accept" -c "a.nav-link" -q "h1" https://example.com

# Interactive mode (visible browser)
claude-browse -i --headed https://example.com
```

## Server Mode

Start a persistent browser server that accepts commands via HTTP:

```bash
claude-browse -s 3000           # headless
claude-browse -s 3000 --headed  # visible browser
```

Send commands:

```bash
# Navigate
curl -X POST localhost:3000 -d '{"cmd":"goto","url":"https://example.com"}'

# Click
curl -X POST localhost:3000 -d '{"cmd":"click","selector":"button.submit"}'

# Type
curl -X POST localhost:3000 -d '{"cmd":"type","selector":"#search","text":"hello"}'

# Query elements
curl -X POST localhost:3000 -d '{"cmd":"query","selector":"a[href]"}'

# Screenshot
curl -X POST localhost:3000 -d '{"cmd":"screenshot","path":"page.png"}'

# Get current URL
curl -X POST localhost:3000 -d '{"cmd":"url"}'

# Get page HTML
curl -X POST localhost:3000 -d '{"cmd":"html"}'

# Navigation
curl -X POST localhost:3000 -d '{"cmd":"back"}'
curl -X POST localhost:3000 -d '{"cmd":"forward"}'
curl -X POST localhost:3000 -d '{"cmd":"reload"}'

# Wait
curl -X POST localhost:3000 -d '{"cmd":"wait","ms":2000}'

# Close server
curl -X POST localhost:3000 -d '{"cmd":"close"}'
```

## Claude Code Plugin (Recommended)

Install as a Claude Code plugin for the best integration:

```bash
# Via marketplace (recommended)
claude plugin marketplace add https://github.com/saiden-dev/claude-plugins
claude plugin install browse

# Or direct from GitHub
claude plugin install github:saiden-dev/browse
```

**Prerequisites:** Node.js 18+ (the MCP server runs via npx)

### Plugin Features

**Slash Commands:**

| Command | Description |
|---------|-------------|
| `/browse:start` | Start an interactive browsing session |
| `/browse:goto <url>` | Navigate to URL and describe findings |
| `/browse:screenshot` | Take a screenshot of the current page |
| `/browse:scrape <url>` | Scrape content from a webpage |
| `/browse:analyze` | Analyze current page content and structure |
| `/browse:extract [selector]` | Extract structured data from page |
| `/browse:fill [data]` | Help fill out forms |
| `/browse:compare [action]` | Compare page states before/after action |
| `/browse:save` | Save current session state to file |
| `/browse:restore` | Restore a previously saved session |
| `/browse:end` | End the browsing session and close browser |

**MCP Resources (@ mentions):**

| Resource | Description |
|----------|-------------|
| `@browse:browser://state` | Browser state (URL, title, launched) |
| `@browse:browser://html` | Page HTML (truncated to 10KB) |
| `@browse:browser://html/full` | Complete page HTML |
| `@browse:browser://screenshot` | Page screenshot as base64 PNG |

## MCP Server (Standalone)

Use with any MCP-compatible client:

```bash
# Run the MCP server
claude-browse-mcp
```

Add to Claude Code's MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "browser": {
      "command": "claude-browse-mcp"
    }
  }
}
```

**Available Tools:** `goto`, `click`, `type`, `query`, `screenshot`, `url`, `html`, `back`, `forward`, `reload`, `wait`, `eval`

**Image Processing Tools:** `favicon`, `convert`, `resize`, `crop`, `compress`, `thumbnail`

## Programmatic Usage

```typescript
import { ClaudeBrowser, startServer } from '@saiden/browse';

// Direct browser control
const browser = new ClaudeBrowser({
  headless: true,
  width: 1280,
  height: 800,
});

await browser.launch();
await browser.goto('https://example.com');

const elements = await browser.query('a[href]');
console.log(elements);

await browser.click('button.submit');
await browser.type('#input', 'hello');
await browser.screenshot('page.png');

await browser.close();

// Or start a server
const server = await startServer({ port: 3000, headless: false });
// Server runs until closed via HTTP or SIGINT
```

## API

### ClaudeBrowser

- `launch()` - Launch the browser
- `close()` - Close the browser
- `goto(url)` - Navigate to URL
- `click(selector)` - Click element
- `type(selector, text)` - Type into input
- `query(selector)` - Query elements, returns attributes
- `screenshot(path?, fullPage?)` - Take screenshot
- `getUrl()` - Get current URL and title
- `getHtml(full?)` - Get page HTML
- `back()` / `forward()` / `reload()` - Navigation
- `wait(ms)` - Wait for timeout
- `newPage()` - Open new page
- `executeCommand(cmd)` - Execute a command object

### BrowserServer

- `start()` - Start HTTP server
- `stop()` - Stop server and close browser
- `getPort()` - Get server port

## License

MIT
