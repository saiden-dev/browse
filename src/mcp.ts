#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ClaudeBrowser } from './browser.js';
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

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
