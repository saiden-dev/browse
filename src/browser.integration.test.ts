import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaudeBrowser } from './browser.js';

describe('ClaudeBrowser Integration', () => {
  let browser: ClaudeBrowser;

  beforeAll(async () => {
    browser = new ClaudeBrowser({ headless: true });
    await browser.launch();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  describe('navigation', () => {
    it('navigates to a URL and returns title', async () => {
      const result = await browser.goto('https://example.com');
      expect(result.url).toContain('example.com');
      expect(result.title).toBe('Example Domain');
    });

    it('gets current URL and title', async () => {
      const result = await browser.getUrl();
      expect(result.url).toContain('example.com');
      expect(result.title).toBe('Example Domain');
    });

    it('gets page HTML', async () => {
      const html = await browser.getHtml();
      expect(html.toLowerCase()).toContain('<!doctype html>');
      expect(html).toContain('Example Domain');
    });

    it('gets full page HTML', async () => {
      const html = await browser.getHtml(true);
      expect(html.toLowerCase()).toContain('<!doctype html>');
      expect(html.length).toBeGreaterThan(100);
    });

    it('reloads the page', async () => {
      const result = await browser.reload();
      expect(result.url).toContain('example.com');
    });
  });

  describe('DOM interaction', () => {
    it('queries elements', async () => {
      const elements = await browser.query('h1');
      expect(elements.length).toBe(1);
      expect(elements[0].tag).toBe('h1');
      expect(elements[0].text).toContain('Example Domain');
    });

    it('queries multiple elements', async () => {
      const elements = await browser.query('p');
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].tag).toBe('p');
    });

    it('clicks an element', async () => {
      await browser.goto('https://example.com');
      const result = await browser.click('a');
      expect(result.url).toBeDefined();
    });
  });

  describe('screenshots', () => {
    it('takes a screenshot', async () => {
      await browser.goto('https://example.com');
      const result = await browser.screenshot('screenshots/test-integration.png');
      expect(result.path).toContain('test-integration.png');
      expect(result.buffer).toBeDefined();
    });

    it('takes a full page screenshot', async () => {
      const result = await browser.screenshot('screenshots/test-full.png', true);
      expect(result.path).toContain('test-full.png');
    });
  });

  describe('wait', () => {
    it('waits for specified time', async () => {
      const start = Date.now();
      await browser.wait(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('eval', () => {
    it('evaluates JavaScript', async () => {
      await browser.goto('https://example.com');
      const result = await browser.eval('document.title');
      expect(result).toBe('Example Domain');
    });

    it('evaluates expressions', async () => {
      const result = await browser.eval('1 + 1');
      expect(result).toBe(2);
    });

    it('evaluates complex expressions', async () => {
      const result = await browser.eval('document.querySelectorAll("p").length');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('pages', () => {
    it('creates a new page', async () => {
      await browser.newPage();
      const result = await browser.getUrl();
      expect(result.url).toBe('about:blank');
    });

    it('navigates in new page', async () => {
      const result = await browser.goto('https://example.com');
      expect(result.title).toBe('Example Domain');
    });
  });

  describe('executeCommand', () => {
    it('handles goto command', async () => {
      const result = await browser.executeCommand({ cmd: 'goto', url: 'https://example.com' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.title).toBe('Example Domain');
      }
    });

    it('handles query command', async () => {
      const result = await browser.executeCommand({ cmd: 'query', selector: 'h1' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.count).toBe(1);
      }
    });

    it('handles url command', async () => {
      const result = await browser.executeCommand({ cmd: 'url' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.url).toContain('example.com');
      }
    });

    it('handles html command', async () => {
      const result = await browser.executeCommand({ cmd: 'html' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.html).toContain('Example');
      }
    });

    it('handles wait command', async () => {
      const result = await browser.executeCommand({ cmd: 'wait', ms: 50 });
      expect(result.ok).toBe(true);
    });

    it('handles eval command', async () => {
      const result = await browser.executeCommand({ cmd: 'eval', script: '2+2' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.result).toBe(4);
      }
    });

    it('handles screenshot command', async () => {
      const result = await browser.executeCommand({
        cmd: 'screenshot',
        path: 'screenshots/cmd-test.png',
      });
      expect(result.ok).toBe(true);
    });

    it('handles reload command', async () => {
      const result = await browser.executeCommand({ cmd: 'reload' });
      expect(result.ok).toBe(true);
    });

    it('handles click command', async () => {
      await browser.executeCommand({ cmd: 'goto', url: 'https://example.com' });
      const result = await browser.executeCommand({ cmd: 'click', selector: 'a' });
      expect(result.ok).toBe(true);
    });

    it('handles newpage command', async () => {
      const result = await browser.executeCommand({ cmd: 'newpage' });
      expect(result.ok).toBe(true);
    });

    it('handles back command', async () => {
      await browser.executeCommand({ cmd: 'goto', url: 'https://example.com' });
      const result = await browser.executeCommand({ cmd: 'back' });
      expect(result.ok).toBe(true);
    });

    it('handles forward command', async () => {
      const result = await browser.executeCommand({ cmd: 'forward' });
      expect(result.ok).toBe(true);
    });
  });
});
