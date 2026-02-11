import { resolve } from 'node:path';
import { type Browser, type BrowserContext, type Page, type Route, webkit } from 'playwright';
import * as image from './image.js';
import type {
  BrowserCommand,
  BrowserOptions,
  CommandResponse,
  ConsoleMessage,
  ElementInfo,
  NetworkEntry,
} from './types.js';

export class ClaudeBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: Required<BrowserOptions>;
  private consoleMessages: ConsoleMessage[] = [];
  private networkEntries: NetworkEntry[] = [];
  private interceptPatterns: Map<
    string,
    {
      action: 'block' | 'mock';
      response?: { status?: number; body?: string; contentType?: string };
    }
  > = new Map();

  constructor(options: BrowserOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      width: options.width ?? 1280,
      height: options.height ?? 800,
    };
  }

  async launch(): Promise<void> {
    this.browser = await webkit.launch({ headless: this.options.headless });
    this.context = await this.browser.newContext({
      viewport: {
        width: this.options.width,
        height: this.options.height,
      },
    });
    this.page = await this.context.newPage();
    this.setupConsoleListener(this.page);
    this.setupNetworkListener(this.page);
  }

  private setupConsoleListener(page: Page): void {
    page.on('console', (msg) => {
      const location = msg.location();
      this.consoleMessages.push({
        level: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
        location: location.url ? `${location.url}:${location.lineNumber}` : undefined,
      });
    });
  }

  private setupNetworkListener(page: Page): void {
    const pendingRequests = new Map<string, NetworkEntry>();

    page.on('request', (request) => {
      const entry: NetworkEntry = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        requestHeaders: request.headers(),
        timing: { startTime: Date.now() },
      };
      pendingRequests.set(request.url() + request.method(), entry);
    });

    page.on('response', async (response) => {
      const request = response.request();
      const key = request.url() + request.method();
      const entry = pendingRequests.get(key);
      if (entry) {
        entry.status = response.status();
        entry.statusText = response.statusText();
        entry.responseHeaders = response.headers();
        if (entry.timing) {
          entry.timing.endTime = Date.now();
          entry.timing.duration = entry.timing.endTime - entry.timing.startTime;
        }
        try {
          const body = await response.body();
          entry.size = body.length;
        } catch {
          // Body may not be available for some responses
        }
        this.networkEntries.push(entry);
        pendingRequests.delete(key);
      }
    });

    page.on('requestfailed', (request) => {
      const key = request.url() + request.method();
      const entry = pendingRequests.get(key);
      if (entry) {
        entry.error = request.failure()?.errorText || 'Request failed';
        if (entry.timing) {
          entry.timing.endTime = Date.now();
          entry.timing.duration = entry.timing.endTime - entry.timing.startTime;
        }
        this.networkEntries.push(entry);
        pendingRequests.delete(key);
      }
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  private ensurePage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  /** Get the current page instance (for advanced usage) */
  getPage(): Page | null {
    return this.page;
  }

  /** Get the browser context (for advanced usage like cookies) */
  getContext(): BrowserContext | null {
    return this.context;
  }

  async goto(url: string): Promise<{ url: string; title: string }> {
    const page = this.ensurePage();
    await page.goto(url, { waitUntil: 'networkidle' });
    return { url: page.url(), title: await page.title() };
  }

  async click(selector: string): Promise<{ url: string }> {
    const page = this.ensurePage();
    await page.click(selector);
    await page.waitForLoadState('networkidle').catch(() => {});
    return { url: page.url() };
  }

  async type(selector: string, text: string): Promise<void> {
    const page = this.ensurePage();
    await page.fill(selector, text);
  }

  async query(selector: string): Promise<ElementInfo[]> {
    const page = this.ensurePage();
    return page.$$eval(selector, (nodes) =>
      nodes.map((el) => {
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          attrs[attr.name] = attr.value;
        }
        return {
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 200) || '',
          attributes: attrs,
        };
      })
    );
  }

  async screenshot(path?: string, fullPage = false): Promise<{ path: string; buffer?: Buffer }> {
    const page = this.ensurePage();
    const resolvedPath = resolve(path || 'screenshot.png');
    const buffer = await page.screenshot({ path: resolvedPath, fullPage });
    return { path: resolvedPath, buffer };
  }

  async getUrl(): Promise<{ url: string; title: string }> {
    const page = this.ensurePage();
    return { url: page.url(), title: await page.title() };
  }

  async getHtml(full = false): Promise<string> {
    const page = this.ensurePage();
    const html = await page.content();
    return full ? html : html.slice(0, 10000);
  }

  async back(): Promise<{ url: string }> {
    const page = this.ensurePage();
    await page.goBack();
    return { url: page.url() };
  }

  async forward(): Promise<{ url: string }> {
    const page = this.ensurePage();
    await page.goForward();
    return { url: page.url() };
  }

  async reload(): Promise<{ url: string }> {
    const page = this.ensurePage();
    await page.reload();
    return { url: page.url() };
  }

  async wait(ms = 1000): Promise<void> {
    const page = this.ensurePage();
    await page.waitForTimeout(ms);
  }

  async newPage(): Promise<void> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    this.page = await this.context.newPage();
    this.setupConsoleListener(this.page);
    this.setupNetworkListener(this.page);
  }

  async eval(script: string): Promise<unknown> {
    const page = this.ensurePage();
    return page.evaluate(script);
  }

  getConsole(level?: string, clear = false): ConsoleMessage[] {
    let messages = this.consoleMessages;
    if (level && level !== 'all') {
      messages = messages.filter((m) => m.level === level);
    }
    if (clear) {
      this.consoleMessages = [];
    }
    return messages;
  }

  clearConsole(): void {
    this.consoleMessages = [];
  }

  getNetwork(filter?: string, clear = false): NetworkEntry[] {
    let entries = this.networkEntries;
    if (filter && filter !== 'all') {
      if (filter === 'failed') {
        entries = entries.filter((e) => e.error || (e.status && e.status >= 400));
      } else {
        entries = entries.filter((e) => e.resourceType === filter);
      }
    }
    if (clear) {
      this.networkEntries = [];
    }
    return entries;
  }

  clearNetwork(): void {
    this.networkEntries = [];
  }

  async addIntercept(
    pattern: string,
    action: 'block' | 'mock',
    response?: { status?: number; body?: string; contentType?: string }
  ): Promise<void> {
    const page = this.ensurePage();
    this.interceptPatterns.set(pattern, { action, response });
    await page.route(pattern, (route) => this.handleIntercept(pattern, route));
  }

  private async handleIntercept(pattern: string, route: Route): Promise<void> {
    const config = this.interceptPatterns.get(pattern);
    if (!config) {
      await route.continue();
      return;
    }
    if (config.action === 'block') {
      await route.abort();
      return;
    }
    if (config.action === 'mock' && config.response) {
      await route.fulfill({
        status: config.response.status || 200,
        contentType: config.response.contentType || 'application/json',
        body: config.response.body || '',
      });
      return;
    }
    await route.continue();
  }

  async clearIntercepts(): Promise<void> {
    const page = this.ensurePage();
    for (const pattern of this.interceptPatterns.keys()) {
      await page.unroute(pattern);
    }
    this.interceptPatterns.clear();
  }

  getInterceptPatterns(): string[] {
    return Array.from(this.interceptPatterns.keys());
  }

  async executeCommand(cmd: BrowserCommand): Promise<CommandResponse> {
    try {
      switch (cmd.cmd) {
        case 'goto': {
          const result = await this.goto(cmd.url);
          return { ok: true, ...result };
        }
        case 'click': {
          const result = await this.click(cmd.selector);
          return { ok: true, ...result };
        }
        case 'type': {
          await this.type(cmd.selector, cmd.text);
          return { ok: true };
        }
        case 'query': {
          const elements = await this.query(cmd.selector);
          return { ok: true, count: elements.length, elements };
        }
        case 'screenshot': {
          const result = await this.screenshot(cmd.path, cmd.fullPage);
          return { ok: true, path: result.path };
        }
        case 'url': {
          const result = await this.getUrl();
          return { ok: true, ...result };
        }
        case 'html': {
          const html = await this.getHtml(cmd.full);
          return { ok: true, html };
        }
        case 'back': {
          const result = await this.back();
          return { ok: true, ...result };
        }
        case 'forward': {
          const result = await this.forward();
          return { ok: true, ...result };
        }
        case 'reload': {
          const result = await this.reload();
          return { ok: true, ...result };
        }
        case 'wait': {
          await this.wait(cmd.ms);
          return { ok: true };
        }
        case 'newpage': {
          await this.newPage();
          return { ok: true };
        }
        case 'close': {
          await this.close();
          return { ok: true };
        }
        case 'eval': {
          const result = await this.eval(cmd.script);
          return { ok: true, result };
        }
        case 'console': {
          const messages = this.getConsole(cmd.level, cmd.clear);
          return { ok: true, count: messages.length, messages };
        }
        case 'network': {
          const requests = this.getNetwork(cmd.filter, cmd.clear);
          return { ok: true, count: requests.length, requests };
        }
        case 'intercept': {
          if (cmd.action === 'list') {
            const patterns = this.getInterceptPatterns();
            return { ok: true, count: patterns.length, patterns };
          }
          if (cmd.action === 'clear') {
            await this.clearIntercepts();
            return { ok: true };
          }
          if (!cmd.pattern) {
            return { ok: false, error: 'Pattern required for block/mock actions' };
          }
          await this.addIntercept(cmd.pattern, cmd.action, cmd.response);
          return { ok: true, patterns: this.getInterceptPatterns() };
        }
        case 'favicon': {
          const result = await image.createFavicon(cmd.input, cmd.outputDir);
          return { ok: true, files: result.files, outputDir: result.outputDir };
        }
        case 'convert': {
          const result = await image.convert(cmd.input, cmd.output, cmd.format);
          return {
            ok: true,
            path: result.path,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.size,
          };
        }
        case 'resize': {
          const result = await image.resize(cmd.input, cmd.output, cmd.width, cmd.height, cmd.fit);
          return {
            ok: true,
            path: result.path,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.size,
          };
        }
        case 'crop': {
          const result = await image.crop(
            cmd.input,
            cmd.output,
            cmd.left,
            cmd.top,
            cmd.width,
            cmd.height
          );
          return {
            ok: true,
            path: result.path,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.size,
          };
        }
        case 'compress': {
          const result = await image.compress(cmd.input, cmd.output, cmd.quality);
          return {
            ok: true,
            path: result.path,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.size,
          };
        }
        case 'thumbnail': {
          const result = await image.thumbnail(cmd.input, cmd.output, cmd.size);
          return {
            ok: true,
            path: result.path,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.size,
          };
        }
        default: {
          const _exhaustive: never = cmd;
          return { ok: false, error: `Unknown command: ${(_exhaustive as { cmd: string }).cmd}` };
        }
      }
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
