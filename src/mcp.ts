#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ClaudeBrowser } from './browser.js';
import * as image from './image.js';
import { type CommandLike, type ResultLike, stderrLogger as log } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

// Browser options configurable via launch tool
let browserOptions = {
  headless: true,
  width: 1280,
  height: 800,
  fullscreen: false,
  preview: false,
  previewDelay: 2000,
};
let browser = new ClaudeBrowser(browserOptions);
let launched = false;
let currentScreenshotBuffer: Buffer | null = null;

async function ensureLaunched(): Promise<void> {
  if (!launched) {
    await browser.launch();
    launched = true;
  }
}

type ToolResult = { content: [{ type: 'text'; text: string }] };

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text' as const, text }] };
}

function withLogging<T extends Record<string, unknown>>(
  cmd: string,
  fn: (args: T) => Promise<ToolResult>
): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    const cmdLike: CommandLike = { cmd, ...args };
    log.command(cmdLike);
    try {
      const result = await fn(args);
      const parsed = JSON.parse(result.content[0]?.text || '{}');
      const resultLike: ResultLike = { ok: true, ...parsed };
      log.result(cmdLike, resultLike);
      return result;
    } catch (err) {
      log.result(cmdLike, { ok: false, error: (err as Error).message });
      throw err;
    }
  };
}

const server = new McpServer({
  name: 'browse',
  version: pkg.version,
});

// Launch configuration
server.tool(
  'launch',
  'Launch the browser with specific options. Call before goto to configure headed/fullscreen/preview modes.',
  {
    headed: z
      .boolean()
      .optional()
      .default(false)
      .describe('Show browser window (default: false, headless)'),
    fullscreen: z
      .boolean()
      .optional()
      .default(false)
      .describe('Launch in native fullscreen mode (macOS only, implies headed)'),
    preview: z
      .boolean()
      .optional()
      .default(false)
      .describe('Highlight elements before actions with visual overlay'),
    previewDelay: z.number().optional().default(2000).describe('Preview highlight duration in ms'),
    width: z.number().optional().default(1280).describe('Viewport width'),
    height: z.number().optional().default(800).describe('Viewport height'),
  },
  withLogging('launch', async ({ headed, fullscreen, preview, previewDelay, width, height }) => {
    // Close existing browser if launched
    if (launched) {
      await browser.close();
      launched = false;
    }

    // Update options - fullscreen/preview imply headed
    browserOptions = {
      headless: fullscreen || preview ? false : !headed,
      width,
      height,
      fullscreen,
      preview,
      previewDelay,
    };

    // Create new browser with updated options
    browser = new ClaudeBrowser(browserOptions);
    await browser.launch();
    launched = true;

    return textResult(
      JSON.stringify({
        ok: true,
        message: 'Browser launched',
        options: {
          headed: !browserOptions.headless,
          fullscreen,
          preview,
          previewDelay,
          viewport: { width, height },
        },
      })
    );
  })
);

// Navigation
server.tool(
  'goto',
  'Navigate to a URL',
  { url: z.string().url() },
  withLogging('goto', async ({ url }) => {
    await ensureLaunched();
    const result = await browser.goto(url);
    return textResult(JSON.stringify(result));
  })
);

server.tool(
  'back',
  'Go back in browser history',
  {},
  withLogging('back', async () => {
    await ensureLaunched();
    const result = await browser.back();
    return textResult(JSON.stringify(result));
  })
);

server.tool(
  'forward',
  'Go forward in browser history',
  {},
  withLogging('forward', async () => {
    await ensureLaunched();
    const result = await browser.forward();
    return textResult(JSON.stringify(result));
  })
);

server.tool(
  'reload',
  'Reload the current page',
  {},
  withLogging('reload', async () => {
    await ensureLaunched();
    const result = await browser.reload();
    return textResult(JSON.stringify(result));
  })
);

// Interaction
server.tool(
  'click',
  'Click on an element',
  { selector: z.string() },
  withLogging('click', async ({ selector }) => {
    await ensureLaunched();
    const result = await browser.click(selector);
    return textResult(JSON.stringify(result));
  })
);

server.tool(
  'type',
  'Type text into an input field',
  { selector: z.string(), text: z.string() },
  withLogging('type', async ({ selector, text }) => {
    await ensureLaunched();
    await browser.type(selector, text);
    return textResult(JSON.stringify({ ok: true }));
  })
);

// Query
server.tool(
  'query',
  'Query elements by CSS selector, returns tag, text, and attributes',
  { selector: z.string() },
  withLogging('query', async ({ selector }) => {
    await ensureLaunched();
    const elements = await browser.query(selector);
    return textResult(JSON.stringify({ ok: true, count: elements.length, elements }));
  })
);

server.tool(
  'url',
  'Get current URL and page title',
  {},
  withLogging('url', async () => {
    await ensureLaunched();
    const result = await browser.getUrl();
    return textResult(JSON.stringify(result));
  })
);

server.tool(
  'html',
  'Get page HTML content',
  { full: z.boolean().optional().default(false) },
  withLogging('html', async ({ full }) => {
    await ensureLaunched();
    const html = await browser.getHtml(full);
    return textResult(JSON.stringify({ ok: true, html }));
  })
);

// Screenshot
server.tool(
  'screenshot',
  'Take a screenshot of the current page',
  {
    path: z.string().optional().default('screenshots/screenshot.png'),
    fullPage: z.boolean().optional().default(false),
  },
  withLogging('screenshot', async ({ path, fullPage }) => {
    await ensureLaunched();
    const result = await browser.screenshot(path, fullPage);
    return textResult(JSON.stringify({ ok: true, path: result.path }));
  })
);

// Eval
server.tool(
  'eval',
  'Execute JavaScript in the browser context',
  { script: z.string() },
  withLogging('eval', async ({ script }) => {
    await ensureLaunched();
    const result = await browser.eval(script);
    return textResult(JSON.stringify({ ok: true, result }));
  })
);

// Console
server.tool(
  'console',
  'Get captured console messages (log, warn, error, etc.) from the browser',
  {
    level: z
      .enum(['log', 'info', 'warn', 'error', 'debug', 'all'])
      .optional()
      .default('all')
      .describe('Filter by log level'),
    clear: z.boolean().optional().default(false).describe('Clear messages after retrieving'),
  },
  withLogging('console', async ({ level, clear }) => {
    await ensureLaunched();
    const messages = browser.getConsole(level, clear);
    return textResult(JSON.stringify({ ok: true, count: messages.length, messages }));
  })
);

// Network monitoring
server.tool(
  'network',
  'Get captured network requests and responses',
  {
    filter: z
      .enum(['all', 'failed', 'xhr', 'fetch', 'document', 'script', 'stylesheet', 'image'])
      .optional()
      .default('all')
      .describe('Filter by request type or status'),
    clear: z.boolean().optional().default(false).describe('Clear entries after retrieving'),
  },
  withLogging('network', async ({ filter, clear }) => {
    await ensureLaunched();
    const requests = browser.getNetwork(filter, clear);
    return textResult(JSON.stringify({ ok: true, count: requests.length, requests }));
  })
);

server.tool(
  'intercept',
  'Block or mock network requests matching a pattern',
  {
    action: z.enum(['block', 'mock', 'list', 'clear']).describe('Action to perform'),
    pattern: z
      .string()
      .optional()
      .describe('URL pattern to match (glob syntax, e.g., "**/api/*" or "**/*.png")'),
    status: z.number().optional().describe('HTTP status code for mock response'),
    body: z.string().optional().describe('Response body for mock'),
    contentType: z
      .string()
      .optional()
      .default('application/json')
      .describe('Content-Type for mock response'),
  },
  withLogging('intercept', async ({ action, pattern, status, body, contentType }) => {
    await ensureLaunched();
    if (action === 'list') {
      const patterns = browser.getInterceptPatterns();
      return textResult(JSON.stringify({ ok: true, count: patterns.length, patterns }));
    }
    if (action === 'clear') {
      await browser.clearIntercepts();
      return textResult(JSON.stringify({ ok: true, message: 'All intercepts cleared' }));
    }
    if (!pattern) {
      return textResult(JSON.stringify({ ok: false, error: 'Pattern required for block/mock' }));
    }
    const response = action === 'mock' ? { status, body, contentType } : undefined;
    await browser.addIntercept(pattern, action, response);
    return textResult(
      JSON.stringify({ ok: true, action, pattern, patterns: browser.getInterceptPatterns() })
    );
  })
);

// Page errors
server.tool(
  'errors',
  'Get captured page errors (uncaught exceptions and unhandled promise rejections)',
  {
    clear: z.boolean().optional().default(false).describe('Clear errors after retrieving'),
  },
  withLogging('errors', async ({ clear }) => {
    await ensureLaunched();
    const errors = browser.getErrors(clear);
    return textResult(JSON.stringify({ ok: true, count: errors.length, errors }));
  })
);

// Performance metrics
server.tool(
  'metrics',
  'Get page performance metrics and DOM statistics',
  {
    resources: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include individual resource timing entries'),
  },
  withLogging('metrics', async ({ resources }) => {
    await ensureLaunched();
    const metrics = await browser.getMetrics(resources);
    return textResult(JSON.stringify({ ok: true, metrics }));
  })
);

// Accessibility
server.tool(
  'a11y',
  'Get accessibility tree snapshot for the page or a specific element',
  {
    selector: z.string().optional().describe('CSS selector to get subtree for specific element'),
  },
  withLogging('a11y', async ({ selector }) => {
    await ensureLaunched();
    const a11y = await browser.getA11y(selector);
    return textResult(JSON.stringify({ ok: true, a11y }));
  })
);

// Dialog handling
server.tool(
  'dialog',
  'Configure how browser dialogs (alert, confirm, prompt) are handled',
  {
    action: z
      .enum(['status', 'accept', 'dismiss', 'config'])
      .describe(
        'Action: status (get history), accept (auto-accept), dismiss (auto-dismiss), config (set both)'
      ),
    text: z.string().optional().describe('Text to enter for prompt dialogs when accepting'),
    autoAccept: z.boolean().optional().describe('Auto-accept dialogs (for config action)'),
    autoDismiss: z.boolean().optional().describe('Auto-dismiss dialogs (for config action)'),
  },
  withLogging('dialog', async ({ action, text, autoAccept, autoDismiss }) => {
    await ensureLaunched();
    if (action === 'status') {
      return textResult(
        JSON.stringify({
          ok: true,
          dialogs: browser.getDialogs(),
          config: browser.getDialogConfig(),
        })
      );
    }
    if (action === 'accept') {
      browser.setDialogConfig({ autoAccept: true, autoDismiss: false, text });
      return textResult(JSON.stringify({ ok: true, config: browser.getDialogConfig() }));
    }
    if (action === 'dismiss') {
      browser.setDialogConfig({ autoAccept: false, autoDismiss: true });
      return textResult(JSON.stringify({ ok: true, config: browser.getDialogConfig() }));
    }
    browser.setDialogConfig({ autoAccept, autoDismiss, text });
    return textResult(JSON.stringify({ ok: true, config: browser.getDialogConfig() }));
  })
);

// Cookies
server.tool(
  'cookies',
  'Get, set, delete, or clear browser cookies',
  {
    action: z.enum(['get', 'set', 'delete', 'clear']).describe('Action to perform'),
    name: z.string().optional().describe('Cookie name (for get/set/delete)'),
    value: z.string().optional().describe('Cookie value (for set)'),
    url: z.string().optional().describe('URL for cookie (for set, defaults to current page)'),
  },
  withLogging('cookies', async ({ action, name, value, url }) => {
    await ensureLaunched();
    const result = await browser.executeCommand({ cmd: 'cookies', action, name, value, url });
    return textResult(JSON.stringify(result));
  })
);

// Storage
server.tool(
  'storage',
  'Get, set, delete, or clear localStorage or sessionStorage',
  {
    type: z.enum(['local', 'session']).describe('Storage type'),
    action: z.enum(['get', 'set', 'delete', 'clear']).describe('Action to perform'),
    key: z.string().optional().describe('Storage key'),
    value: z.string().optional().describe('Value to set'),
  },
  withLogging('storage', async ({ type, action, key, value }) => {
    await ensureLaunched();
    const result = await browser.executeCommand({ cmd: 'storage', type, action, key, value });
    return textResult(JSON.stringify(result));
  })
);

// Hover
server.tool(
  'hover',
  'Hover over an element to trigger hover states',
  { selector: z.string().describe('CSS selector of element to hover') },
  withLogging('hover', async ({ selector }) => {
    await ensureLaunched();
    await browser.hover(selector);
    return textResult(JSON.stringify({ ok: true }));
  })
);

// Select
server.tool(
  'select',
  'Select option(s) in a dropdown/select element',
  {
    selector: z.string().describe('CSS selector of select element'),
    value: z.union([z.string(), z.array(z.string())]).describe('Value(s) to select'),
  },
  withLogging('select', async ({ selector, value }) => {
    await ensureLaunched();
    const selected = await browser.select(selector, value);
    return textResult(JSON.stringify({ ok: true, selected }));
  })
);

// Keys
server.tool(
  'keys',
  'Send keyboard keys or shortcuts (e.g., "Enter", "Control+a", "Escape")',
  { keys: z.string().describe('Key or key combination to press') },
  withLogging('keys', async ({ keys }) => {
    await ensureLaunched();
    await browser.keys(keys);
    return textResult(JSON.stringify({ ok: true }));
  })
);

// Upload
server.tool(
  'upload',
  'Upload files to a file input element',
  {
    selector: z.string().describe('CSS selector of file input'),
    files: z.array(z.string()).describe('Array of file paths to upload'),
  },
  withLogging('upload', async ({ selector, files }) => {
    await ensureLaunched();
    await browser.upload(selector, files);
    return textResult(JSON.stringify({ ok: true }));
  })
);

// Scroll
server.tool(
  'scroll',
  'Scroll the page or an element into view',
  {
    selector: z.string().optional().describe('CSS selector to scroll into view'),
    x: z.number().optional().describe('X position to scroll to (if no selector)'),
    y: z.number().optional().describe('Y position to scroll to (if no selector)'),
  },
  withLogging('scroll', async ({ selector, x, y }) => {
    await ensureLaunched();
    await browser.scroll(selector, x, y);
    return textResult(JSON.stringify({ ok: true }));
  })
);

// Viewport
server.tool(
  'viewport',
  'Resize the browser viewport',
  {
    width: z.number().describe('Viewport width in pixels'),
    height: z.number().describe('Viewport height in pixels'),
  },
  withLogging('viewport', async ({ width, height }) => {
    await ensureLaunched();
    const viewport = await browser.setViewport(width, height);
    return textResult(JSON.stringify({ ok: true, viewport }));
  })
);

// Emulate
server.tool(
  'emulate',
  'Emulate a mobile device (viewport, user agent, touch)',
  {
    device: z.string().describe('Device name (e.g., "iPhone 13", "Pixel 5", "iPad Pro")'),
  },
  withLogging('emulate', async ({ device }) => {
    await ensureLaunched();
    const viewport = await browser.emulate(device);
    return textResult(JSON.stringify({ ok: true, device, viewport }));
  })
);

// Utility
server.tool(
  'wait',
  'Wait for a specified time in milliseconds',
  { ms: z.number().optional().default(1000) },
  withLogging('wait', async ({ ms }) => {
    await ensureLaunched();
    await browser.wait(ms);
    return textResult(JSON.stringify({ ok: true }));
  })
);

// Session management
server.tool(
  'close',
  'Close the browser and end the current session',
  {},
  withLogging('close', async () => {
    if (launched) {
      await browser.close();
      launched = false;
    }
    return textResult(JSON.stringify({ ok: true, message: 'Browser closed' }));
  })
);

server.tool(
  'session_save',
  'Save the current session state (URL, cookies, localStorage, sessionStorage) to a JSON file',
  {
    path: z.string().optional().default('session.json').describe('Path to save session file'),
  },
  withLogging('session_save', async ({ path }) => {
    await ensureLaunched();
    const { writeFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');

    const page = browser.getPage();
    const context = browser.getContext();
    if (!page || !context) {
      return textResult(JSON.stringify({ ok: false, error: 'No active page' }));
    }

    const url = page.url();
    const title = await page.title();
    const cookies = await context.cookies();

    // Get localStorage and sessionStorage (runs in browser context)
    const storage = (await page.evaluate(`({
      localStorage: Object.fromEntries(
        Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
          .filter(k => k !== null)
          .map(k => [k, localStorage.getItem(k) || ''])
      ),
      sessionStorage: Object.fromEntries(
        Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i))
          .filter(k => k !== null)
          .map(k => [k, sessionStorage.getItem(k) || ''])
      ),
    })`)) as { localStorage: Record<string, string>; sessionStorage: Record<string, string> };

    const sessionData = {
      url,
      title,
      cookies,
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
      savedAt: new Date().toISOString(),
    };

    const resolvedPath = resolve(path);
    await writeFile(resolvedPath, JSON.stringify(sessionData, null, 2));
    return textResult(
      JSON.stringify({ ok: true, path: resolvedPath, url, cookieCount: cookies.length })
    );
  })
);

server.tool(
  'session_restore',
  'Restore a previously saved session state from a JSON file',
  {
    path: z.string().optional().default('session.json').describe('Path to session file'),
  },
  withLogging('session_restore', async ({ path }) => {
    await ensureLaunched();
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');

    const resolvedPath = resolve(path);
    const data = JSON.parse(await readFile(resolvedPath, 'utf-8'));

    const page = browser.getPage();
    const context = browser.getContext();
    if (!page || !context) {
      return textResult(JSON.stringify({ ok: false, error: 'No active page' }));
    }

    // Restore cookies first
    if (data.cookies?.length > 0) {
      await context.addCookies(data.cookies);
    }

    // Navigate to saved URL
    if (data.url) {
      await page.goto(data.url, { waitUntil: 'networkidle' });
    }

    // Restore storage (runs in browser context)
    const local = data.localStorage || {};
    const session = data.sessionStorage || {};
    await page.evaluate(
      `((data) => {
        for (const [k, v] of Object.entries(data.local)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(data.session)) sessionStorage.setItem(k, v);
      })(${JSON.stringify({ local, session })})`
    );

    return textResult(
      JSON.stringify({
        ok: true,
        url: data.url,
        title: data.title,
        cookiesRestored: data.cookies?.length || 0,
        savedAt: data.savedAt,
      })
    );
  })
);

// Image processing
server.tool(
  'favicon',
  'Generate a complete favicon set from an image (16x16, 32x32, 48x48, apple-touch-icon 180x180, android-chrome 192x192 and 512x512)',
  {
    input: z.string().describe('Path to source image'),
    outputDir: z.string().describe('Directory to output favicon files'),
  },
  withLogging('favicon', async ({ input, outputDir }) => {
    const result = await image.createFavicon(input, outputDir);
    return textResult(
      JSON.stringify({ ok: true, files: result.files, outputDir: result.outputDir })
    );
  })
);

server.tool(
  'convert',
  'Convert an image to a different format (png, jpeg, webp, avif)',
  {
    input: z.string().describe('Path to source image'),
    output: z.string().describe('Path for output image'),
    format: z.enum(['png', 'jpeg', 'webp', 'avif']).describe('Target format'),
  },
  withLogging('convert', async ({ input, output, format }) => {
    const result = await image.convert(input, output, format);
    return textResult(JSON.stringify({ ok: true, ...result }));
  })
);

server.tool(
  'resize',
  'Resize an image to specified dimensions',
  {
    input: z.string().describe('Path to source image'),
    output: z.string().describe('Path for output image'),
    width: z.number().describe('Target width in pixels'),
    height: z
      .number()
      .optional()
      .describe('Target height in pixels (optional, maintains aspect ratio if omitted)'),
    fit: z
      .enum(['cover', 'contain', 'fill', 'inside', 'outside'])
      .optional()
      .default('cover')
      .describe('How to fit the image'),
  },
  withLogging('resize', async ({ input, output, width, height, fit }) => {
    const result = await image.resize(input, output, width, height, fit);
    return textResult(JSON.stringify({ ok: true, ...result }));
  })
);

server.tool(
  'crop',
  'Crop a region from an image',
  {
    input: z.string().describe('Path to source image'),
    output: z.string().describe('Path for output image'),
    left: z.number().describe('Left edge position in pixels'),
    top: z.number().describe('Top edge position in pixels'),
    width: z.number().describe('Width of crop region in pixels'),
    height: z.number().describe('Height of crop region in pixels'),
  },
  withLogging('crop', async ({ input, output, left, top, width, height }) => {
    const result = await image.crop(input, output, left, top, width, height);
    return textResult(JSON.stringify({ ok: true, ...result }));
  })
);

server.tool(
  'compress',
  'Compress an image to reduce file size',
  {
    input: z.string().describe('Path to source image'),
    output: z.string().describe('Path for output image'),
    quality: z.number().min(1).max(100).optional().default(80).describe('Quality level 1-100'),
  },
  withLogging('compress', async ({ input, output, quality }) => {
    const result = await image.compress(input, output, quality);
    return textResult(JSON.stringify({ ok: true, ...result }));
  })
);

server.tool(
  'thumbnail',
  'Create a thumbnail from an image',
  {
    input: z.string().describe('Path to source image'),
    output: z.string().describe('Path for output image'),
    size: z
      .enum(['small', 'medium', 'large'])
      .optional()
      .default('medium')
      .describe('Thumbnail size preset (small=150px, medium=300px, large=600px)'),
  },
  withLogging('thumbnail', async ({ input, output, size }) => {
    const result = await image.thumbnail(input, output, size);
    return textResult(JSON.stringify({ ok: true, ...result }));
  })
);

// ============================================================================
// MCP Resources - Browser state accessible via @ mentions
// ============================================================================

// Resource: browser://state - Current browser state (URL, title, launched status)
server.resource(
  'Browser State',
  'browser://state',
  {
    description: 'Current browser state including URL, title, and status',
    mimeType: 'application/json',
  },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://state',
            mimeType: 'application/json',
            text: JSON.stringify({ launched: false, url: null, title: null }),
          },
        ],
      };
    }
    const state = await browser.getUrl();
    return {
      contents: [
        {
          uri: 'browser://state',
          mimeType: 'application/json',
          text: JSON.stringify({ launched: true, ...state }),
        },
      ],
    };
  }
);

// Resource: browser://html - Current page HTML content
server.resource(
  'Page HTML',
  'browser://html',
  { description: 'HTML content of the current page (truncated to 10KB)', mimeType: 'text/html' },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://html',
            mimeType: 'text/plain',
            text: 'Browser not launched. Use goto tool first.',
          },
        ],
      };
    }
    const html = await browser.getHtml(false);
    return {
      contents: [
        {
          uri: 'browser://html',
          mimeType: 'text/html',
          text: html,
        },
      ],
    };
  }
);

// Resource: browser://html/full - Full page HTML content
server.resource(
  'Full Page HTML',
  'browser://html/full',
  { description: 'Complete HTML content of the current page', mimeType: 'text/html' },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://html/full',
            mimeType: 'text/plain',
            text: 'Browser not launched. Use goto tool first.',
          },
        ],
      };
    }
    const html = await browser.getHtml(true);
    return {
      contents: [
        {
          uri: 'browser://html/full',
          mimeType: 'text/html',
          text: html,
        },
      ],
    };
  }
);

// Resource: browser://console - Captured console messages
server.resource(
  'Console Messages',
  'browser://console',
  { description: 'Console messages captured from the browser', mimeType: 'application/json' },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://console',
            mimeType: 'application/json',
            text: JSON.stringify({ launched: false, messages: [] }),
          },
        ],
      };
    }
    const messages = browser.getConsole('all', false);
    return {
      contents: [
        {
          uri: 'browser://console',
          mimeType: 'application/json',
          text: JSON.stringify({ launched: true, count: messages.length, messages }),
        },
      ],
    };
  }
);

// Resource: browser://network - All captured network requests
server.resource(
  'Network Requests',
  'browser://network',
  { description: 'All network requests captured from the browser', mimeType: 'application/json' },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://network',
            mimeType: 'application/json',
            text: JSON.stringify({ launched: false, requests: [] }),
          },
        ],
      };
    }
    const requests = browser.getNetwork('all', false);
    return {
      contents: [
        {
          uri: 'browser://network',
          mimeType: 'application/json',
          text: JSON.stringify({ launched: true, count: requests.length, requests }),
        },
      ],
    };
  }
);

// Resource: browser://network/failed - Failed network requests only
server.resource(
  'Failed Requests',
  'browser://network/failed',
  {
    description: 'Failed network requests (errors and 4xx/5xx status codes)',
    mimeType: 'application/json',
  },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://network/failed',
            mimeType: 'application/json',
            text: JSON.stringify({ launched: false, requests: [] }),
          },
        ],
      };
    }
    const requests = browser.getNetwork('failed', false);
    return {
      contents: [
        {
          uri: 'browser://network/failed',
          mimeType: 'application/json',
          text: JSON.stringify({ launched: true, count: requests.length, requests }),
        },
      ],
    };
  }
);

// Resource: browser://errors - Captured page errors
server.resource(
  'Page Errors',
  'browser://errors',
  {
    description: 'Uncaught exceptions and unhandled promise rejections',
    mimeType: 'application/json',
  },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://errors',
            mimeType: 'application/json',
            text: JSON.stringify({ launched: false, errors: [] }),
          },
        ],
      };
    }
    const errors = browser.getErrors(false);
    return {
      contents: [
        {
          uri: 'browser://errors',
          mimeType: 'application/json',
          text: JSON.stringify({ launched: true, count: errors.length, errors }),
        },
      ],
    };
  }
);

// Resource: browser://a11y - Accessibility tree snapshot
server.resource(
  'Accessibility Tree',
  'browser://a11y',
  { description: 'Accessibility tree snapshot of the current page', mimeType: 'application/json' },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://a11y',
            mimeType: 'application/json',
            text: JSON.stringify({ launched: false, a11y: null }),
          },
        ],
      };
    }
    const a11y = await browser.getA11y();
    return {
      contents: [
        {
          uri: 'browser://a11y',
          mimeType: 'application/json',
          text: JSON.stringify({ launched: true, a11y }),
        },
      ],
    };
  }
);

// Resource: browser://screenshot - Current page screenshot (base64)
server.resource(
  'Page Screenshot',
  'browser://screenshot',
  { description: 'Screenshot of the current page as base64 PNG', mimeType: 'image/png' },
  async () => {
    if (!launched) {
      return {
        contents: [
          {
            uri: 'browser://screenshot',
            mimeType: 'text/plain',
            text: 'Browser not launched. Use goto tool first.',
          },
        ],
      };
    }
    const result = await browser.screenshot(undefined, false);
    currentScreenshotBuffer = result.buffer || null;
    return {
      contents: [
        {
          uri: 'browser://screenshot',
          mimeType: 'image/png',
          blob: result.buffer?.toString('base64') || '',
        },
      ],
    };
  }
);

// ============================================================================
// MCP Prompts - Common workflows accessible via / commands
// ============================================================================

// Prompt: Analyze current page
server.prompt('analyze_page', 'Analyze the current page content and structure', async () => {
  if (!launched) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'The browser is not launched yet. Please use the goto tool to navigate to a URL first, then I can analyze the page.',
          },
        },
      ],
    };
  }
  const state = await browser.getUrl();
  const html = await browser.getHtml(false);
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Analyze the following webpage:

URL: ${state.url}
Title: ${state.title}

HTML Content (truncated):
\`\`\`html
${html}
\`\`\`

Please provide:
1. A summary of the page purpose and content
2. Key interactive elements (forms, buttons, links)
3. Any notable structure or patterns
4. Suggestions for what actions might be useful`,
        },
      },
    ],
  };
});

// Prompt: Extract data from page
server.prompt(
  'extract_data',
  'Extract structured data from the current page',
  { selector: z.string().optional().describe('CSS selector to focus extraction (optional)') },
  async ({ selector }) => {
    if (!launched) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'The browser is not launched yet. Please use the goto tool to navigate to a URL first.',
            },
          },
        ],
      };
    }
    const state = await browser.getUrl();
    let elements: { tag: string; text: string; attributes: Record<string, string> }[] = [];
    if (selector) {
      elements = await browser.query(selector);
    }
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Extract structured data from this webpage:

URL: ${state.url}
Title: ${state.title}
${selector ? `\nSelector: ${selector}\nMatched Elements: ${elements.length}\n\nElements:\n${JSON.stringify(elements, null, 2)}` : ''}

Please:
1. Use the query tool to find relevant data elements
2. Extract and structure the data in a useful format (JSON, table, etc.)
3. Identify patterns that could help with similar pages`,
          },
        },
      ],
    };
  }
);

// Prompt: Navigate and interact
server.prompt(
  'navigate_to',
  'Navigate to a URL and describe what you find',
  { url: z.string().url().describe('URL to navigate to') },
  async ({ url }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please navigate to ${url} and:

1. Use the goto tool to navigate there
2. Take a screenshot to see the page
3. Describe what you see
4. Identify the main interactive elements
5. Suggest what actions might be useful

Start by navigating to the URL.`,
          },
        },
      ],
    };
  }
);

// Prompt: Fill form
server.prompt(
  'fill_form',
  'Help fill out a form on the current page',
  { formData: z.string().optional().describe('JSON object with field names and values to fill') },
  async ({ formData }) => {
    if (!launched) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'The browser is not launched yet. Please use the goto tool to navigate to a page with a form first.',
            },
          },
        ],
      };
    }
    const state = await browser.getUrl();
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Help fill out a form on this page:

URL: ${state.url}
Title: ${state.title}
${formData ? `\nData to fill: ${formData}` : ''}

Please:
1. Use the query tool to find form inputs (input, textarea, select)
2. Identify required fields and their types
3. Use the type tool to fill in each field
4. Report what was filled and any issues encountered`,
          },
        },
      ],
    };
  }
);

// Prompt: Screenshot comparison
server.prompt('compare_screenshots', 'Take screenshots and compare changes', async () => {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I'll help you compare page states:

1. Take an initial screenshot
2. Perform some action (click, navigate, etc.)
3. Take another screenshot
4. Describe the differences

What action would you like me to perform between screenshots?`,
        },
      },
    ],
  };
});

// ============================================================================
// Start server
// ============================================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
