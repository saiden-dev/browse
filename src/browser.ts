import { resolve } from 'node:path';
import { type Browser, type BrowserContext, type Page, webkit } from 'playwright';
import * as image from './image.js';
import type { BrowserCommand, BrowserOptions, CommandResponse, ElementInfo } from './types.js';

export class ClaudeBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: Required<BrowserOptions>;

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
  }

  async eval(script: string): Promise<unknown> {
    const page = this.ensurePage();
    return page.evaluate(script);
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
