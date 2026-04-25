import { createServer } from 'node:http';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { ClaudeBrowser } from './browser.js';
import { logger, ts } from './logger.js';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
function printBanner(port) {
    console.log();
    console.log(chalk.cyan.bold('  browse server'));
    console.log(chalk.dim('  ─────────────────────────'));
    console.log(`  ${logSymbols.success} Listening on ${chalk.bold(`http://localhost:${port}`)}`);
    console.log();
    console.log(chalk.dim('  Commands:'));
    console.log(`    ${chalk.cyan('goto')}  ${chalk.yellow('click')}  ${chalk.magenta('type')}  ${chalk.blue('query')}  ${chalk.green('screenshot')}`);
    console.log(`    ${chalk.cyan('url')}  ${chalk.blue('html')}  ${chalk.yellow('back')}  ${chalk.yellow('forward')}  ${chalk.yellow('reload')}  ${chalk.gray('wait')}  ${chalk.red('close')}`);
    console.log();
    console.log(chalk.dim('  Example:'));
    console.log(chalk.gray(`    curl localhost:${port} -d '{"cmd":"goto","url":"https://example.com"}'`));
    console.log();
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        req.on('error', reject);
    });
}
function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(body);
}
export class BrowserServer {
    browser;
    server = null;
    port;
    constructor(options = {}) {
        this.browser = new ClaudeBrowser(options);
        this.port = options.port ?? 13373;
    }
    async handleRequest(req, res) {
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
            const cmd = JSON.parse(raw);
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
                    result.data = buffer.toString('base64');
                }
            }
            sendJson(res, 200, result);
        }
        catch (err) {
            const error = err.message;
            console.log(`${ts()}   ${logSymbols.error} ${chalk.red(error)}`);
            sendJson(res, 500, { ok: false, error });
        }
    }
    async start() {
        await this.browser.launch();
        return new Promise((resolve) => {
            this.server = createServer((req, res) => {
                this.handleRequest(req, res).catch((err) => {
                    sendJson(res, 500, { ok: false, error: err.message });
                });
            });
            this.server.listen(this.port, () => {
                printBanner(this.port);
                resolve();
            });
        });
    }
    async stop() {
        console.log(chalk.dim('\n  Shutting down...'));
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        await this.browser.close();
        console.log(`  ${logSymbols.success} Browser closed\n`);
    }
    getPort() {
        return this.port;
    }
}
export async function startServer(options = {}) {
    const server = new BrowserServer(options);
    await server.start();
    return server;
}
//# sourceMappingURL=server.js.map