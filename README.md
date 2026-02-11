# @saiden/browse

[![npm version](https://img.shields.io/npm/v/@saiden/browse.svg)](https://www.npmjs.com/package/@saiden/browse)
[![CI](https://github.com/saiden-dev/browse/actions/workflows/ci.yml/badge.svg)](https://github.com/saiden-dev/browse/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@saiden/browse.svg)](https://nodejs.org)

#### Headless browser automation for Claude Code using Playwright WebKit.
## Claude Code Plugin (Recommended)

Install as a Claude Code plugin for the best integration:

```bash
# Add the saiden marketplace (one-time)
claude plugin marketplace add https://github.com/saiden-dev/claude-plugins

# Install the plugin
claude plugin install browse@saiden

# Update to latest version
claude plugin marketplace update saiden && claude plugin update browse@saiden
```

**Prerequisites:** Node.js 18+, Playwright WebKit (`npx playwright install webkit`)

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

---

## Installation (npm)

```bash
npm install @saiden/browse
npx playwright install webkit
```

## CLI Usage

```bash
# Take a screenshot
browse https://example.com

# Custom viewport and output
browse -o page.png -w 1920 -h 1080 https://example.com

# Query elements
browse -q "a[href]" https://example.com
browse -q "img" -j https://example.com  # JSON output

# Click and interact
browse -c "button.submit" https://example.com
browse -t "input[name=q]=hello" -c "button[type=submit]" https://google.com

# Chain actions
browse -c ".cookie-accept" -c "a.nav-link" -q "h1" https://example.com

# Interactive mode (visible browser)
browse -i --headed https://example.com
```

## MCP Server (Standalone)

Use with any MCP-compatible client:

```bash
# Run the MCP server
browse-mcp
```

Add to Claude Code's MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "browser": {
      "command": "browse-mcp"
    }
  }
}
```

### MCP Tools Reference

**Navigation & Interaction:**
| Tool | Description |
|------|-------------|
| `goto` | Navigate to a URL |
| `click` | Click on an element |
| `type` | Type text into an input field |
| `hover` | Hover over an element |
| `select` | Select option(s) in a dropdown |
| `keys` | Send keyboard shortcuts (e.g., "Enter", "Control+a") |
| `scroll` | Scroll page or element into view |
| `upload` | Upload files to a file input |
| `back`, `forward`, `reload` | Browser navigation |
| `wait` | Wait for a specified time |
| `close` | Close the browser and end session |

**Debugging & Inspection:**
| Tool | Description |
|------|-------------|
| `console` | Get captured console messages (log, warn, error, etc.) |
| `errors` | Get page errors (uncaught exceptions) |
| `network` | Get captured network requests/responses |
| `intercept` | Block or mock network requests |
| `metrics` | Get performance metrics and DOM statistics |
| `a11y` | Get accessibility tree snapshot |

**Page Content:**
| Tool | Description |
|------|-------------|
| `query` | Query elements by CSS selector |
| `screenshot` | Take a screenshot |
| `url` | Get current URL and title |
| `html` | Get page HTML content |
| `eval` | Execute JavaScript in browser context |

**Storage & Session:**
| Tool | Description |
|------|-------------|
| `cookies` | Get, set, delete, or clear cookies |
| `storage` | Access localStorage or sessionStorage |
| `dialog` | Configure how browser dialogs are handled |
| `session_save` | Save session state to file |
| `session_restore` | Restore session from file |

**Viewport & Emulation:**
| Tool | Description |
|------|-------------|
| `viewport` | Resize browser viewport |
| `emulate` | Emulate a mobile device |

**Image Processing:**
| Tool | Description |
|------|-------------|
| `favicon` | Generate favicon set from image |
| `convert` | Convert image format |
| `resize` | Resize image |
| `crop` | Crop image |
| `compress` | Compress image |
| `thumbnail` | Create thumbnail |

### MCP Resources

| Resource | Description |
|----------|-------------|
| `browser://state` | Browser state (URL, title, launched) |
| `browser://html` | Page HTML (truncated to 10KB) |
| `browser://html/full` | Complete page HTML |
| `browser://console` | Captured console messages |
| `browser://network` | All network requests |
| `browser://network/failed` | Failed requests only |
| `browser://errors` | Page errors |
| `browser://a11y` | Accessibility tree |
| `browser://screenshot` | Page screenshot as base64 PNG |

## Programmatic Usage

```typescript
import { ClaudeBrowser } from '@saiden/browse';

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
```

## API

### ClaudeBrowser

**Lifecycle:**
- `launch()` - Launch the browser
- `close()` - Close the browser
- `newPage()` - Open new page

**Navigation:**
- `goto(url)` - Navigate to URL
- `back()` / `forward()` / `reload()` - Browser navigation
- `wait(ms)` - Wait for timeout

**Interaction:**
- `click(selector)` - Click element
- `type(selector, text)` - Type into input
- `hover(selector)` - Hover over element
- `select(selector, value)` - Select dropdown option(s)
- `keys(keys)` - Press keyboard keys
- `scroll(selector?, x?, y?)` - Scroll page or element
- `upload(selector, files)` - Upload files

**Content:**
- `query(selector)` - Query elements, returns attributes
- `screenshot(path?, fullPage?)` - Take screenshot
- `getUrl()` - Get current URL and title
- `getHtml(full?)` - Get page HTML
- `eval(script)` - Execute JavaScript

**Debugging:**
- `getConsole(level?, clear?)` - Get console messages
- `getErrors(clear?)` - Get page errors
- `getNetwork(filter?, clear?)` - Get network requests
- `getMetrics(includeResources?)` - Get performance metrics
- `getA11y(selector?)` - Get accessibility tree

**Storage:**
- `getCookies(name?)` - Get cookies
- `setCookie(name, value, url?)` - Set cookie
- `deleteCookie(name)` / `clearCookies()` - Remove cookies
- `getStorage(type, key?)` - Get localStorage/sessionStorage
- `setStorage(type, key, value)` - Set storage item
- `deleteStorage(type, key)` / `clearStorage(type)` - Remove storage

**Interception:**
- `addIntercept(pattern, action, response?)` - Block or mock requests
- `clearIntercepts()` - Remove all intercepts

**Viewport:**
- `setViewport(width, height)` - Resize viewport
- `emulate(device)` - Emulate device (e.g., 'iPhone 13')

**Commands:**
- `executeCommand(cmd)` - Execute a command object

## License

MIT
