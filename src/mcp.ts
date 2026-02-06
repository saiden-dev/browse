#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ClaudeBrowser } from './browser.js';

const browser = new ClaudeBrowser({ headless: true, width: 1280, height: 800 });
let launched = false;

async function ensureLaunched(): Promise<void> {
  if (!launched) {
    await browser.launch();
    launched = true;
  }
}

const server = new McpServer({
  name: 'claude-browse',
  version: '0.1.0',
});

// Navigation
server.tool('goto', 'Navigate to a URL', { url: z.string().url() }, async ({ url }) => {
  await ensureLaunched();
  const result = await browser.goto(url);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('back', 'Go back in browser history', {}, async () => {
  await ensureLaunched();
  const result = await browser.back();
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('forward', 'Go forward in browser history', {}, async () => {
  await ensureLaunched();
  const result = await browser.forward();
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('reload', 'Reload the current page', {}, async () => {
  await ensureLaunched();
  const result = await browser.reload();
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// Interaction
server.tool('click', 'Click on an element', { selector: z.string() }, async ({ selector }) => {
  await ensureLaunched();
  const result = await browser.click(selector);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool(
  'type',
  'Type text into an input field',
  { selector: z.string(), text: z.string() },
  async ({ selector, text }) => {
    await ensureLaunched();
    await browser.type(selector, text);
    return { content: [{ type: 'text', text: 'ok' }] };
  }
);

// Query
server.tool(
  'query',
  'Query elements by CSS selector, returns tag, text, and attributes',
  { selector: z.string() },
  async ({ selector }) => {
    await ensureLaunched();
    const elements = await browser.query(selector);
    return { content: [{ type: 'text', text: JSON.stringify(elements, null, 2) }] };
  }
);

server.tool('url', 'Get current URL and page title', {}, async () => {
  await ensureLaunched();
  const result = await browser.getUrl();
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool(
  'html',
  'Get page HTML content',
  { full: z.boolean().optional().default(false) },
  async ({ full }) => {
    await ensureLaunched();
    const html = await browser.getHtml(full);
    return { content: [{ type: 'text', text: html }] };
  }
);

// Screenshot
server.tool(
  'screenshot',
  'Take a screenshot of the current page',
  {
    path: z.string().optional().default('screenshots/screenshot.png'),
    fullPage: z.boolean().optional().default(false),
  },
  async ({ path, fullPage }) => {
    await ensureLaunched();
    const result = await browser.screenshot(path, fullPage);
    return { content: [{ type: 'text', text: `Screenshot saved to ${result.path}` }] };
  }
);

// Eval
server.tool(
  'eval',
  'Execute JavaScript in the browser context',
  { script: z.string() },
  async ({ script }) => {
    await ensureLaunched();
    const result = await browser.eval(script);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

// Utility
server.tool(
  'wait',
  'Wait for a specified time in milliseconds',
  { ms: z.number().optional().default(1000) },
  async ({ ms }) => {
    await ensureLaunched();
    await browser.wait(ms);
    return { content: [{ type: 'text', text: 'ok' }] };
  }
);

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
