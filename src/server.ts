import chalk from 'chalk';
import express, { type Request, type Response } from 'express';
import logSymbols from 'log-symbols';
import { ClaudeBrowser } from './browser.js';
import { logger, ts } from './logger.js';
import type { BrowserCommand, BrowserOptions } from './types.js';

export interface ServerOptions extends BrowserOptions {
  port?: number;
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
    this.port = options.port ?? 13373;
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
      logger.command(cmd);

      if (cmd.cmd === 'close') {
        logger.result(cmd, { ok: true });
        res.json({ ok: true });
        await this.stop();
        process.exit(0);
      }

      const result = await this.browser.executeCommand(cmd);
      logger.result(cmd, result);
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
