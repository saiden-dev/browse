#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ClaudeBrowser } from './browser.js';
import * as image from './image.js';
import { type CommandLike, type ResultLike, stderrLogger as log } from './logger.js';

const browser = new ClaudeBrowser({ headless: true, width: 1280, height: 800 });
let launched = false;

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
  name: 'claude-browse',
  version: '0.1.0',
});

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

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
