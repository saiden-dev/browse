import express, { type Request, type Response } from 'express';
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
};

function timestamp(): string {
  return `${c.gray}[${new Date().toISOString()}]${c.reset}`;
}

function logOk(ts: string, msg?: string): void {
  const suffix = msg ? ` ${c.dim}${msg}${c.reset}` : '';
  console.log(`${ts}   ${c.green}✓${c.reset}${suffix}`);
}

function logError(ts: string, error: string): void {
  console.log(`${ts}   ${c.red}✗ Error: ${error}${c.reset}`);
}

function logCmd(ts: string, icon: string, color: string, name: string, detail?: string): void {
  const suffix = detail ? ` ${detail}` : '';
  console.log(`${ts} ${color}${c.bold}${icon}${c.reset} ${color}${name}${c.reset}${suffix}`);
}

function logCommand(cmd: BrowserCommand): void {
  const ts = timestamp();
  switch (cmd.cmd) {
    case 'goto':
      logCmd(ts, '→', c.cyan, 'GOTO', `${c.white}${cmd.url}${c.reset}`);
      break;
    case 'click':
      logCmd(ts, '◉', c.yellow, 'CLICK', `${c.white}${cmd.selector}${c.reset}`);
      break;
    case 'type':
      logCmd(
        ts,
        '⌨',
        c.magenta,
        'TYPE',
        `${c.white}${cmd.selector}${c.reset} ${c.dim}="${cmd.text}"${c.reset}`
      );
      break;
    case 'query':
      logCmd(ts, '?', c.blue, 'QUERY', `${c.white}${cmd.selector}${c.reset}`);
      break;
    case 'screenshot':
      logCmd(ts, '📷', c.green, 'SCREENSHOT', `${c.dim}${cmd.path || 'screenshot.png'}${c.reset}`);
      break;
    case 'url':
      logCmd(ts, '🔗', c.cyan, 'URL');
      break;
    case 'html':
      logCmd(ts, '<>', c.blue, 'HTML', cmd.full ? `${c.dim}(full)${c.reset}` : undefined);
      break;
    case 'back':
      logCmd(ts, '←', c.yellow, 'BACK');
      break;
    case 'forward':
      logCmd(ts, '→', c.yellow, 'FORWARD');
      break;
    case 'reload':
      logCmd(ts, '↻', c.yellow, 'RELOAD');
      break;
    case 'wait':
      logCmd(ts, '⏳', c.gray, 'WAIT', `${c.dim}${cmd.ms || 1000}ms${c.reset}`);
      break;
    case 'newpage':
      logCmd(ts, '+', c.green, 'NEW PAGE');
      break;
    case 'close':
      logCmd(ts, '✕', c.red, 'CLOSE');
      break;
    case 'eval': {
      const preview = cmd.script.length > 50 ? `${cmd.script.slice(0, 50)}...` : cmd.script;
      logCmd(ts, '⚡', c.magenta, 'EVAL', `${c.dim}${preview}${c.reset}`);
      break;
    }
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function logResultGoto(ts: string, result: CommandResponse): void {
  if (result.ok && 'title' in result && result.title) {
    logOk(ts, result.title);
  }
}

function logResultClick(ts: string, result: CommandResponse): void {
  if (result.ok && 'url' in result) {
    logOk(ts, `→ ${result.url}`);
  }
}

function logResultQuery(ts: string, result: CommandResponse): void {
  if (result.ok && 'count' in result) {
    logOk(ts, `Found ${result.count} element(s)`);
  }
}

function logResultScreenshot(ts: string, result: CommandResponse): void {
  if (result.ok && 'path' in result) {
    logOk(ts, `Saved to ${result.path}`);
  }
}

function logResultUrl(ts: string, result: CommandResponse): void {
  if (result.ok && 'url' in result) {
    logOk(ts, result.url);
  }
}

function logResultHtml(ts: string, result: CommandResponse): void {
  if (result.ok && 'html' in result) {
    logOk(ts, `${result.html?.length || 0} chars`);
  }
}

function logResultEval(ts: string, result: CommandResponse): void {
  if (result.ok && 'result' in result) {
    const json = JSON.stringify(result.result);
    logOk(ts, truncate(json, 80));
  }
}

const resultLoggers: Record<string, (ts: string, result: CommandResponse) => void> = {
  goto: logResultGoto,
  click: logResultClick,
  query: logResultQuery,
  screenshot: logResultScreenshot,
  url: logResultUrl,
  html: logResultHtml,
  eval: logResultEval,
};

function logResult(cmd: BrowserCommand, result: CommandResponse): void {
  const ts = timestamp();
  if (!result.ok) {
    logError(ts, result.error);
    return;
  }

  const logger = resultLoggers[cmd.cmd];
  if (logger) {
    logger(ts, result);
  } else {
    logOk(ts);
  }
}

function printBanner(port: number): void {
  console.log();
  console.log(`${c.bold}${c.cyan}  🌐 Claude Browse Server${c.reset}`);
  console.log(`${c.dim}  ─────────────────────────${c.reset}`);
  console.log(`  ${c.green}▶${c.reset} Listening on ${c.bold}http://localhost:${port}${c.reset}`);
  console.log();
  console.log(`${c.dim}  Commands:${c.reset}`);
  console.log(
    `    ${c.cyan}goto${c.reset}  ${c.yellow}click${c.reset}  ${c.magenta}type${c.reset}  ${c.blue}query${c.reset}  ${c.green}screenshot${c.reset}`
  );
  console.log(
    `    ${c.cyan}url${c.reset}  ${c.blue}html${c.reset}  ${c.yellow}back${c.reset}  ${c.yellow}forward${c.reset}  ${c.yellow}reload${c.reset}  ${c.gray}wait${c.reset}  ${c.red}close${c.reset}`
  );
  console.log();
  console.log(`${c.dim}  Example:${c.reset}`);
  console.log(
    `    ${c.gray}curl -X POST localhost:${port} -d '{"cmd":"goto","url":"https://example.com"}'${c.reset}`
  );
  console.log();
}

export class BrowserServer {
  private browser: ClaudeBrowser;
  private app = express();
  private server: ReturnType<typeof this.app.listen> | null = null;
  private port: number;

  constructor(options: ServerOptions = {}) {
    this.browser = new ClaudeBrowser(options);
    this.port = options.port ?? 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.post('/', (req, res) => this.handleCommand(req, res));
  }

  private async handleCommand(req: Request, res: Response): Promise<void> {
    try {
      const cmd = req.body as BrowserCommand;
      logCommand(cmd);

      if (cmd.cmd === 'close') {
        logResult(cmd, { ok: true });
        res.json({ ok: true });
        await this.stop();
        process.exit(0);
      }

      const result = await this.browser.executeCommand(cmd);
      logResult(cmd, result);
      res.json(result);
    } catch (err) {
      const error = (err as Error).message;
      logError(timestamp(), error);
      res.status(500).json({ ok: false, error });
    }
  }

  async start(): Promise<void> {
    await this.browser.launch();

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        printBanner(this.port);
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

  getApp() {
    return this.app;
  }
}

export async function startServer(options: ServerOptions = {}): Promise<BrowserServer> {
  const server = new BrowserServer(options);
  await server.start();
  return server;
}
