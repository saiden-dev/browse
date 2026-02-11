#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ClaudeBrowser } from './browser.js';
import * as image from './image.js';
import type { ElementInfo } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: 'string', short: 'o', default: 'screenshot.png' },
    width: { type: 'string', short: 'w', default: '1280' },
    height: { type: 'string', short: 'h', default: '800' },
    fullpage: { type: 'boolean', short: 'f', default: false },
    wait: { type: 'string', default: '2000' },
    headed: { type: 'boolean', default: false },
    fullscreen: { type: 'boolean', default: false },
    preview: { type: 'boolean', short: 'p', default: false },
    'preview-delay': { type: 'string', default: '2000' },
    interactive: { type: 'boolean', short: 'i', default: false },
    query: { type: 'string', short: 'q' },
    json: { type: 'boolean', short: 'j', default: false },
    click: { type: 'string', short: 'c', multiple: true },
    type: { type: 'string', short: 't', multiple: true },
    help: { type: 'boolean', default: false },
    version: { type: 'boolean', short: 'v', default: false },
    // Image processing options
    favicon: { type: 'string' },
    convert: { type: 'string' },
    resize: { type: 'string' },
    compress: { type: 'string' },
  },
});

const HELP = `
Usage: browse [options] <url>

Options:
  -o, --output <file>     Output screenshot path (default: screenshot.png)
  -w, --width <px>        Viewport width (default: 1280)
  -h, --height <px>       Viewport height (default: 800)
  -f, --fullpage          Capture full page scroll
  --wait <ms>             Wait time after load (default: 2000)
  --headed                Show browser window
  --fullscreen            Launch in native fullscreen mode (macOS only, implies --headed)
  -p, --preview           Highlight elements before actions (click, type, etc.)
  --preview-delay <ms>    Preview highlight duration (default: 2000)
  -i, --interactive       Keep browser open for manual interaction
  -q, --query <selector>  Query elements by CSS selector and show attributes
  -j, --json              Output query results as JSON
  -c, --click <selector>  Click on element (can be repeated for multiple clicks)
  -t, --type <sel>=<text> Type text into input (can be repeated)
  -v, --version           Show version
  --help                  Show this help

Image Processing:
  --favicon <dir>         Generate favicon set to directory (from screenshot or input)
  --convert <format>      Convert screenshot to format (png, jpeg, webp, avif)
  --resize <WxH>          Resize screenshot (e.g., 800x600 or 800 for width only)
  --compress <quality>    Compress with quality 1-100

Examples:
  browse https://example.com
  browse -o page.png -w 1920 -h 1080 https://example.com
  browse -i --headed https://example.com
  browse -i --fullscreen https://example.com
  browse -q "a[href]" https://example.com
  browse -q "img" -j https://example.com
  browse -c "button.submit" https://example.com
  browse -t "input[name=q]=hello" -c "button[type=submit]" https://google.com
  browse -c ".cookie-accept" -c "a.nav-link" -q "h1" https://example.com
  browse -p -c "button.submit" https://example.com

Image processing examples:
  browse https://example.com --favicon ./favicons/
  browse https://example.com -o page.webp --convert webp
  browse https://example.com --resize 800x600
  browse https://example.com --compress 60

MCP Server (for Claude Code integration):
  browse-mcp                        # Run as MCP server (stdio transport)
`;

function getViewportConfig() {
  const fullscreen = values.fullscreen as boolean;
  const preview = values.preview as boolean;
  return {
    headless: fullscreen || preview ? false : !values.headed,
    width: Number.parseInt(values.width as string),
    height: Number.parseInt(values.height as string),
    fullscreen,
    preview,
    previewDelay: Number.parseInt(values['preview-delay'] as string),
  };
}

async function processTypeActions(browser: ClaudeBrowser): Promise<void> {
  const typeActions = values.type as string[] | undefined;
  if (!typeActions?.length) return;

  for (const typeAction of typeActions) {
    const eqIndex = typeAction.indexOf('=');
    if (eqIndex === -1) {
      console.error(`Invalid --type format: "${typeAction}" (expected selector=text)`);
      continue;
    }
    const selector = typeAction.slice(0, eqIndex);
    const text = typeAction.slice(eqIndex + 1);
    console.log(`Typing "${text}" into: ${selector}`);
    await browser.type(selector, text);
  }
}

async function processClickActions(browser: ClaudeBrowser): Promise<void> {
  const clickActions = values.click as string[] | undefined;
  if (!clickActions?.length) return;

  for (const selector of clickActions) {
    console.log(`Clicking: ${selector}`);
    await browser.click(selector);
    await browser.wait(500);
  }
  const { url: currentUrl } = await browser.getUrl();
  console.log(`Current URL: ${currentUrl}`);
}

function printElement(el: ElementInfo, index: number): void {
  console.log(`[${index + 1}] <${el.tag}>`);
  for (const [name, value] of Object.entries(el.attributes)) {
    console.log(`    ${name}="${value}"`);
  }
  if (el.text) {
    const truncated = el.text.length > 100 ? `${el.text.slice(0, 100)}...` : el.text;
    console.log(`    text: "${truncated}"`);
  }
  console.log();
}

async function runQueryMode(browser: ClaudeBrowser): Promise<void> {
  const elements = await browser.query(values.query as string);

  if (values.json) {
    console.log(JSON.stringify(elements, null, 2));
  } else {
    console.log(`Found ${elements.length} element(s) matching "${values.query}":\n`);
    elements.forEach(printElement);
  }

  await browser.close();
  process.exit(0);
}

async function runInteractiveMode(browser: ClaudeBrowser): Promise<void> {
  console.log('Interactive mode - browser will stay open.');
  console.log('Press Ctrl+C to exit.');

  process.on('SIGINT', async () => {
    console.log('\nClosing browser...');
    await browser.close();
    process.exit(0);
  });

  await new Promise(() => {});
}

async function processImageOptions(screenshotPath: string): Promise<void> {
  // Process image options on the screenshot
  if (values.favicon) {
    console.log(`Generating favicon set to: ${values.favicon}`);
    const result = await image.createFavicon(screenshotPath, values.favicon as string);
    console.log(`Created ${result.files.length} favicon files`);
  }

  if (values.convert) {
    const format = values.convert as 'png' | 'jpeg' | 'webp' | 'avif';
    const outputPath = screenshotPath.replace(/\.[^.]+$/, `.${format}`);
    console.log(`Converting to ${format}: ${outputPath}`);
    await image.convert(screenshotPath, outputPath, format);
  }

  if (values.resize) {
    const resizeValue = values.resize as string;
    const [widthStr, heightStr] = resizeValue.split('x');
    const width = Number.parseInt(widthStr);
    const height = heightStr ? Number.parseInt(heightStr) : undefined;
    console.log(`Resizing to ${width}${height ? `x${height}` : ''}`);
    await image.resize(screenshotPath, screenshotPath, width, height);
  }

  if (values.compress) {
    const quality = Number.parseInt(values.compress as string);
    console.log(`Compressing with quality ${quality}`);
    await image.compress(screenshotPath, screenshotPath, quality);
  }
}

async function runScreenshotMode(browser: ClaudeBrowser): Promise<void> {
  const outputPath = resolve(values.output as string);
  console.log(`Saving screenshot to: ${outputPath}`);
  await browser.screenshot(outputPath, values.fullpage);

  // Process any image options
  await processImageOptions(outputPath);

  await browser.close();
  console.log('Done!');
}

async function runBrowserMode(): Promise<void> {
  const url = positionals[0];
  const browser = new ClaudeBrowser(getViewportConfig());

  await browser.launch();
  console.log(`Navigating to: ${url}`);
  await browser.goto(url);
  await browser.wait(Number.parseInt(values.wait as string));

  await processTypeActions(browser);
  await processClickActions(browser);

  if (values.query) {
    await runQueryMode(browser);
    return;
  }

  if (values.interactive) {
    await runInteractiveMode(browser);
  } else {
    await runScreenshotMode(browser);
  }
}

async function main(): Promise<void> {
  if (values.version) {
    console.log(`browse ${pkg.version}`);
    process.exit(0);
  }

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  await runBrowserMode();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
