import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { ClaudeBrowser } from './browser.js';
import type { BrowserCommand, BrowserOptions, CommandResponse } from './types.js';

export interface ServerOptions extends BrowserOptions {
  port?: number;
}

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgMagenta: '\x1b[45m',
};

function timestamp(): string {
  return c.gray + '[' + new Date().toISOString() + ']' + c.reset;
}

function logCommand(cmd: BrowserCommand): void {
  const ts = timestamp();
  switch (cmd.cmd) {
    case 'goto':
      console.log(`${ts} ${c.cyan}${c.bold}→${c.reset} ${c.cyan}GOTO${c.reset} ${c.white}${cmd.url}${c.reset}`);
      break;
    case 'click':
      console.log(`${ts} ${c.yellow}${c.bold}◉${c.reset} ${c.yellow}CLICK${c.reset} ${c.white}${cmd.selector}${c.reset}`);
      break;
    case 'type':
      console.log(`${ts} ${c.magenta}${c.bold}⌨${c.reset} ${c.magenta}TYPE${c.reset} ${c.white}${cmd.selector}${c.reset} ${c.dim}="${cmd.text}"${c.reset}`);
      break;
    case 'query':
      console.log(`${ts} ${c.blue}${c.bold}?${c.reset} ${c.blue}QUERY${c.reset} ${c.white}${cmd.selector}${c.reset}`);
      break;
    case 'screenshot':
      console.log(`${ts} ${c.green}${c.bold}📷${c.reset} ${c.green}SCREENSHOT${c.reset} ${c.dim}${cmd.path || 'screenshot.png'}${c.reset}`);
      break;
    case 'url':
      console.log(`${ts} ${c.cyan}${c.bold}🔗${c.reset} ${c.cyan}URL${c.reset}`);
      break;
    case 'html':
      console.log(`${ts} ${c.blue}${c.bold}<>${c.reset} ${c.blue}HTML${c.reset} ${cmd.full ? c.dim + '(full)' + c.reset : ''}`);
      break;
    case 'back':
      console.log(`${ts} ${c.yellow}${c.bold}←${c.reset} ${c.yellow}BACK${c.reset}`);
      break;
    case 'forward':
      console.log(`${ts} ${c.yellow}${c.bold}→${c.reset} ${c.yellow}FORWARD${c.reset}`);
      break;
    case 'reload':
      console.log(`${ts} ${c.yellow}${c.bold}↻${c.reset} ${c.yellow}RELOAD${c.reset}`);
      break;
    case 'wait':
      console.log(`${ts} ${c.gray}${c.bold}⏳${c.reset} ${c.gray}WAIT${c.reset} ${c.dim}${cmd.ms || 1000}ms${c.reset}`);
      break;
    case 'newpage':
      console.log(`${ts} ${c.green}${c.bold}+${c.reset} ${c.green}NEW PAGE${c.reset}`);
      break;
    case 'close':
      console.log(`${ts} ${c.red}${c.bold}✕${c.reset} ${c.red}CLOSE${c.reset}`);
      break;
    case 'eval':
      const preview = cmd.script.length > 50 ? cmd.script.slice(0, 50) + '...' : cmd.script;
      console.log(`${ts} ${c.magenta}${c.bold}⚡${c.reset} ${c.magenta}EVAL${c.reset} ${c.dim}${preview}${c.reset}`);
      break;
  }
}

function logResult(cmd: BrowserCommand, result: CommandResponse): void {
  const ts = timestamp();
  if (!result.ok) {
    console.log(`${ts}   ${c.red}✗ Error: ${result.error}${c.reset}`);
    return;
  }

  switch (cmd.cmd) {
    case 'goto':
      if ('title' in result && result.title) {
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}${result.title}${c.reset}`);
      }
      break;
    case 'click':
      if ('url' in result) {
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}→ ${result.url}${c.reset}`);
      }
      break;
    case 'query':
      if ('count' in result) {
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}Found ${result.count} element(s)${c.reset}`);
      }
      break;
    case 'screenshot':
      if ('path' in result) {
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}Saved to ${result.path}${c.reset}`);
      }
      break;
    case 'url':
      if ('url' in result) {
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}${result.url}${c.reset}`);
      }
      break;
    case 'html':
      if ('html' in result) {
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}${result.html?.length || 0} chars${c.reset}`);
      }
      break;
    case 'eval':
      if ('result' in result) {
        const json = JSON.stringify(result.result);
        const preview = json && json.length > 80 ? json.slice(0, 80) + '...' : json;
        console.log(`${ts}   ${c.green}✓${c.reset} ${c.dim}${preview}${c.reset}`);
      }
      break;
    default:
      console.log(`${ts}   ${c.green}✓${c.reset}`);
  }
}

export class BrowserServer {
  private browser: ClaudeBrowser;
  private server: Server | null = null;
  private port: number;

  constructor(options: ServerOptions = {}) {
    this.browser = new ClaudeBrowser(options);
    this.port = options.port ?? 3000;
  }

  async start(): Promise<void> {
    await this.browser.launch();

    this.server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'POST only' }));
          return;
        }

        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        try {
          const cmd: BrowserCommand = JSON.parse(body);
          logCommand(cmd);

          // Handle close specially to shut down server
          if (cmd.cmd === 'close') {
            const result = { ok: true as const };
            logResult(cmd, result);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            await this.stop();
            process.exit(0);
          }

          const result = await this.browser.executeCommand(cmd);
          logResult(cmd, result);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          const errorResult = { ok: false as const, error: (err as Error).message };
          console.log(`${timestamp()}   ${c.red}✗ ${errorResult.error}${c.reset}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(errorResult));
        }
      }
    );

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.log();
        console.log(`${c.bold}${c.cyan}  🌐 Claude Browse Server${c.reset}`);
        console.log(`${c.dim}  ─────────────────────────${c.reset}`);
        console.log(`  ${c.green}▶${c.reset} Listening on ${c.bold}http://localhost:${this.port}${c.reset}`);
        console.log();
        console.log(`${c.dim}  Commands:${c.reset}`);
        console.log(`    ${c.cyan}goto${c.reset}  ${c.yellow}click${c.reset}  ${c.magenta}type${c.reset}  ${c.blue}query${c.reset}  ${c.green}screenshot${c.reset}`);
        console.log(`    ${c.cyan}url${c.reset}  ${c.blue}html${c.reset}  ${c.yellow}back${c.reset}  ${c.yellow}forward${c.reset}  ${c.yellow}reload${c.reset}  ${c.gray}wait${c.reset}  ${c.red}close${c.reset}`);
        console.log();
        console.log(`${c.dim}  Example:${c.reset}`);
        console.log(`    ${c.gray}curl -X POST localhost:${this.port} -d '{"cmd":"goto","url":"https://example.com"}'${c.reset}`);
        console.log();
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    console.log(`\n${c.dim}  Shutting down...${c.reset}`);
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    await this.browser.close();
    console.log(`  ${c.green}✓${c.reset} Browser closed\n`);
  }

  getPort(): number {
    return this.port;
  }
}

export async function startServer(options: ServerOptions = {}): Promise<BrowserServer> {
  const server = new BrowserServer(options);
  await server.start();
  return server;
}
