import chalk from 'chalk';
import express, { type Request, type Response } from 'express';
import logSymbols from 'log-symbols';
import { ClaudeBrowser } from './browser.js';
import type { BrowserCommand, BrowserOptions, CommandResponse } from './types.js';

export interface ServerOptions extends BrowserOptions {
  port?: number;
}

// Icons for commands
const icons = {
  goto: '→',
  click: '◉',
  type: '⌨',
  query: '?',
  screenshot: '📷',
  url: '🔗',
  html: '<>',
  back: '←',
  forward: '→',
  reload: '↻',
  wait: '⏳',
  newpage: '+',
  close: '✕',
  eval: '⚡',
};

// Colors for command types
const cmdColor: Record<string, (s: string) => string> = {
  goto: chalk.cyan,
  click: chalk.yellow,
  type: chalk.magenta,
  query: chalk.blue,
  screenshot: chalk.green,
  url: chalk.cyan,
  html: chalk.blue,
  back: chalk.yellow,
  forward: chalk.yellow,
  reload: chalk.yellow,
  wait: chalk.gray,
  newpage: chalk.green,
  close: chalk.red,
  eval: chalk.magenta,
};

function ts(): string {
  return chalk.gray(`[${new Date().toISOString()}]`);
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function getCommandDetail(cmd: BrowserCommand): string | undefined {
  switch (cmd.cmd) {
    case 'goto':
      return chalk.white(cmd.url);
    case 'click':
    case 'query':
      return chalk.white(cmd.selector);
    case 'type':
      return `${chalk.white(cmd.selector)} ${chalk.dim(`="${cmd.text}"`)}`;
    case 'screenshot':
      return chalk.dim(cmd.path || 'screenshot.png');
    case 'html':
      return cmd.full ? chalk.dim('(full)') : undefined;
    case 'wait':
      return chalk.dim(`${cmd.ms || 1000}ms`);
    case 'eval':
      return chalk.dim(truncate(cmd.script, 50));
    default:
      return undefined;
  }
}

function logCommand(cmd: BrowserCommand): void {
  const color = cmdColor[cmd.cmd] || chalk.white;
  const icon = icons[cmd.cmd as keyof typeof icons] || '•';
  const detail = getCommandDetail(cmd);
  const suffix = detail ? ` ${detail}` : '';
  console.log(`${ts()} ${chalk.bold(color(icon))} ${color(cmd.cmd.toUpperCase())}${suffix}`);
}

type ResultFormatter = (result: CommandResponse) => string | undefined;

const resultFormatters: Record<string, ResultFormatter> = {
  goto: (r) => ('title' in r ? r.title : undefined),
  click: (r) => ('url' in r ? `→ ${r.url}` : undefined),
  query: (r) => ('count' in r ? `Found ${r.count} element(s)` : undefined),
  screenshot: (r) => ('path' in r ? `Saved to ${r.path}` : undefined),
  url: (r) => ('url' in r ? r.url : undefined),
  html: (r) => ('html' in r ? `${r.html?.length || 0} chars` : undefined),
  eval: (r) => ('result' in r ? truncate(JSON.stringify(r.result), 80) : undefined),
};

function getResultMessage(cmd: BrowserCommand, result: CommandResponse): string | undefined {
  if (!result.ok) return undefined;
  const formatter = resultFormatters[cmd.cmd];
  return formatter ? formatter(result) : undefined;
}

function logResult(cmd: BrowserCommand, result: CommandResponse): void {
  if (!result.ok) {
    console.log(`${ts()}   ${logSymbols.error} ${chalk.red(result.error)}`);
    return;
  }
  const msg = getResultMessage(cmd, result);
  const suffix = msg ? ` ${chalk.dim(msg)}` : '';
  console.log(`${ts()}   ${logSymbols.success}${suffix}`);
}

function printBanner(port: number): void {
  console.log();
  console.log(chalk.cyan.bold('  🌐 Claude Browse Server'));
  console.log(chalk.dim('  ─────────────────────────'));
  console.log(`  ${logSymbols.success} Listening on ${chalk.bold(`http://localhost:${port}`)}`);
  console.log();
  console.log(chalk.dim('  Commands:'));
  console.log(
    `    ${chalk.cyan('goto')}  ${chalk.yellow('click')}  ${chalk.magenta('type')}  ${chalk.blue('query')}  ${chalk.green('screenshot')}`
  );
  console.log(
    `    ${chalk.cyan('url')}  ${chalk.blue('html')}  ${chalk.yellow('back')}  ${chalk.yellow('forward')}  ${chalk.yellow('reload')}  ${chalk.gray('wait')}  ${chalk.red('close')}`
  );
  console.log();
  console.log(chalk.dim('  Example:'));
  console.log(
    chalk.gray(`    curl -X POST localhost:${port} -d '{"cmd":"goto","url":"https://example.com"}'`)
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
    this.app.use(express.text({ type: '*/*' }));
  }

  private setupRoutes(): void {
    this.app.post('/', (req, res) => this.handleCommand(req, res));
  }

  private async handleCommand(req: Request, res: Response): Promise<void> {
    try {
      const cmd: BrowserCommand = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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
      console.log(`${ts()}   ${logSymbols.error} ${chalk.red(error)}`);
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
    console.log(chalk.dim('\n  Shutting down...'));
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    await this.browser.close();
    console.log(`  ${logSymbols.success} Browser closed\n`);
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
