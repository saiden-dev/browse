#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { ClaudeBrowser } from './browser.js';
import { startServer } from './server.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: 'string', short: 'o', default: 'screenshot.png' },
    width: { type: 'string', short: 'w', default: '1280' },
    height: { type: 'string', short: 'h', default: '800' },
    fullpage: { type: 'boolean', short: 'f', default: false },
    wait: { type: 'string', default: '2000' },
    headed: { type: 'boolean', default: false },
    interactive: { type: 'boolean', short: 'i', default: false },
    query: { type: 'string', short: 'q' },
    json: { type: 'boolean', short: 'j', default: false },
    click: { type: 'string', short: 'c', multiple: true },
    type: { type: 'string', short: 't', multiple: true },
    serve: { type: 'string', short: 's' },
    help: { type: 'boolean', default: false },
    version: { type: 'boolean', short: 'v', default: false },
  },
});

const HELP = `
Usage: claude-browse [options] <url>

Options:
  -o, --output <file>     Output screenshot path (default: screenshot.png)
  -w, --width <px>        Viewport width (default: 1280)
  -h, --height <px>       Viewport height (default: 800)
  -f, --fullpage          Capture full page scroll
  --wait <ms>             Wait time after load (default: 2000)
  --headed                Show browser window
  -i, --interactive       Keep browser open for manual interaction
  -q, --query <selector>  Query elements by CSS selector and show attributes
  -j, --json              Output query results as JSON
  -c, --click <selector>  Click on element (can be repeated for multiple clicks)
  -t, --type <sel>=<text> Type text into input (can be repeated)
  -s, --serve <port>      Start browser server on port (default: 3000)
  -v, --version           Show version
  --help                  Show this help

Examples:
  claude-browse https://example.com
  claude-browse -o page.png -w 1920 -h 1080 https://example.com
  claude-browse -i --headed https://example.com
  claude-browse -q "a[href]" https://example.com
  claude-browse -q "img" -j https://example.com
  claude-browse -c "button.submit" https://example.com
  claude-browse -t "input[name=q]=hello" -c "button[type=submit]" https://google.com
  claude-browse -c ".cookie-accept" -c "a.nav-link" -q "h1" https://example.com

Server mode:
  claude-browse -s 3000                    # Start server on port 3000
  claude-browse -s 3000 --headed           # Start with visible browser

  # Send commands via curl:
  curl -X POST http://localhost:3000 -d '{"cmd":"goto","url":"https://example.com"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"click","selector":"button"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"type","selector":"input","text":"hello"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"query","selector":"a[href]"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"screenshot","path":"shot.png"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"url"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"html"}'
  curl -X POST http://localhost:3000 -d '{"cmd":"close"}'
`;

async function main(): Promise<void> {
  if (values.version) {
    console.log('claude-browse 0.1.0');
    process.exit(0);
  }

  // Server mode
  if (values.serve) {
    const port = parseInt(values.serve) || 3000;
    const server = await startServer({
      port,
      headless: !values.headed,
      width: parseInt(values.width as string),
      height: parseInt(values.height as string),
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});
    return;
  }

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const url = positionals[0];
  const outputPath = resolve(values.output as string);

  const browser = new ClaudeBrowser({
    headless: !values.headed,
    width: parseInt(values.width as string),
    height: parseInt(values.height as string),
  });

  await browser.launch();

  console.log(`Navigating to: ${url}`);
  await browser.goto(url);
  await browser.wait(parseInt(values.wait as string));

  // Process type actions (before clicks, typically for form filling)
  const typeActions = values.type as string[] | undefined;
  if (typeActions?.length) {
    for (const typeAction of typeActions) {
      const eqIndex = typeAction.indexOf('=');
      if (eqIndex === -1) {
        console.error(
          `Invalid --type format: "${typeAction}" (expected selector=text)`
        );
        continue;
      }
      const selector = typeAction.slice(0, eqIndex);
      const text = typeAction.slice(eqIndex + 1);
      console.log(`Typing "${text}" into: ${selector}`);
      await browser.type(selector, text);
    }
  }

  // Process click actions
  const clickActions = values.click as string[] | undefined;
  if (clickActions?.length) {
    for (const selector of clickActions) {
      console.log(`Clicking: ${selector}`);
      await browser.click(selector);
      await browser.wait(500);
    }
    const { url: currentUrl } = await browser.getUrl();
    console.log(`Current URL: ${currentUrl}`);
  }

  // Query elements if -q/--query is specified
  if (values.query) {
    const elements = await browser.query(values.query);

    if (values.json) {
      console.log(JSON.stringify(elements, null, 2));
    } else {
      console.log(
        `Found ${elements.length} element(s) matching "${values.query}":\n`
      );
      elements.forEach((el, i) => {
        console.log(`[${i + 1}] <${el.tag}>`);
        for (const [name, value] of Object.entries(el.attributes)) {
          console.log(`    ${name}="${value}"`);
        }
        if (el.text) {
          console.log(
            `    text: "${el.text.slice(0, 100)}${el.text.length > 100 ? '...' : ''}"`
          );
        }
        console.log();
      });
    }

    await browser.close();
    process.exit(0);
  }

  if (!values.interactive) {
    console.log(`Saving screenshot to: ${outputPath}`);
    await browser.screenshot(outputPath, values.fullpage);
    await browser.close();
    console.log('Done!');
  } else {
    console.log('Interactive mode - browser will stay open.');
    console.log('Press Ctrl+C to exit.');

    process.on('SIGINT', async () => {
      console.log('\nClosing browser...');
      await browser.close();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
