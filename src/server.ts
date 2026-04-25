import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { ClaudeBrowser } from './browser.js';
import { logger, ts } from './logger.js';
import type { BrowserCommand, BrowserOptions } from './types.js';

export interface ServerOptions extends BrowserOptions {
  port?: number;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function printBanner(port: number): void {
  console.log();
  console.log(chalk.cyan.bold('  browse server'));
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
    chalk.gray(`    curl localhost:${port} -d '{"cmd":"goto","url":"https://example.com"}'`)
  );
  console.log();
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(body);
}

export class BrowserServer {
  private browser: ClaudeBrowser;
  private server: Server | null = null;
  private port: number;

  constructor(options: ServerOptions = {}) {
    this.browser = new ClaudeBrowser(options);
    this.port = options.port ?? 13373;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/') {
      sendJson(res, 404, { ok: false, error: 'POST / only' });
      return;
    }

    try {
      const raw = await readBody(req);
      const cmd: BrowserCommand = JSON.parse(raw);
      logger.command(cmd);

      if (cmd.cmd === 'close') {
        logger.result(cmd, { ok: true });
        sendJson(res, 200, { ok: true });
        await this.stop();
        process.exit(0);
      }

      const result = await this.browser.executeCommand(cmd);
      logger.result(cmd, result);

      // For screenshot without a path, include base64 data
      if (cmd.cmd === 'screenshot' && !cmd.path && result.ok) {
        const page = this.browser.getPage();
        if (page) {
          const buffer = await page.screenshot();
          (result as unknown as Record<string, unknown>).data = buffer.toString('base64');
        }
      }

      sendJson(res, 200, result);
    } catch (err) {
      const error = (err as Error).message;
      console.log(`${ts()}   ${logSymbols.error} ${chalk.red(error)}`);
      sendJson(res, 500, { ok: false, error });
    }
  }

  async start(): Promise<void> {
    await this.browser.launch();

    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message });
        });
      });
      this.server.listen(this.port, () => {
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
}

export async function startServer(options: ServerOptions = {}): Promise<BrowserServer> {
  const server = new BrowserServer(options);
  await server.start();
  return server;
}
