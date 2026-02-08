import { describe, expect, it } from 'vitest';
import { ClaudeBrowser } from './browser.js';
describe('ClaudeBrowser', () => {
    describe('constructor', () => {
        it('creates browser with default options', () => {
            const browser = new ClaudeBrowser();
            expect(browser).toBeInstanceOf(ClaudeBrowser);
        });
        it('accepts custom options', () => {
            const browser = new ClaudeBrowser({
                headless: false,
                width: 1920,
                height: 1080,
            });
            expect(browser).toBeInstanceOf(ClaudeBrowser);
        });
    });
    describe('ensurePage (via executeCommand)', () => {
        it('throws error when browser not launched', async () => {
            const browser = new ClaudeBrowser();
            const result = await browser.executeCommand({ cmd: 'url' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Browser not launched');
            }
        });
    });
    describe('executeCommand', () => {
        it('returns error for commands without launch', async () => {
            const browser = new ClaudeBrowser();
            const gotoResult = await browser.executeCommand({ cmd: 'goto', url: 'https://example.com' });
            expect(gotoResult.ok).toBe(false);
            const clickResult = await browser.executeCommand({ cmd: 'click', selector: '#btn' });
            expect(clickResult.ok).toBe(false);
            const typeResult = await browser.executeCommand({
                cmd: 'type',
                selector: '#input',
                text: 'test',
            });
            expect(typeResult.ok).toBe(false);
            const queryResult = await browser.executeCommand({ cmd: 'query', selector: '.item' });
            expect(queryResult.ok).toBe(false);
            const screenshotResult = await browser.executeCommand({ cmd: 'screenshot' });
            expect(screenshotResult.ok).toBe(false);
            const htmlResult = await browser.executeCommand({ cmd: 'html' });
            expect(htmlResult.ok).toBe(false);
            const backResult = await browser.executeCommand({ cmd: 'back' });
            expect(backResult.ok).toBe(false);
            const forwardResult = await browser.executeCommand({ cmd: 'forward' });
            expect(forwardResult.ok).toBe(false);
            const reloadResult = await browser.executeCommand({ cmd: 'reload' });
            expect(reloadResult.ok).toBe(false);
            const waitResult = await browser.executeCommand({ cmd: 'wait', ms: 100 });
            expect(waitResult.ok).toBe(false);
            const evalResult = await browser.executeCommand({ cmd: 'eval', script: '1+1' });
            expect(evalResult.ok).toBe(false);
        });
        it('handles close command without error when not launched', async () => {
            const browser = new ClaudeBrowser();
            const result = await browser.executeCommand({ cmd: 'close' });
            expect(result.ok).toBe(true);
        });
        it('handles newpage command error when not launched', async () => {
            const browser = new ClaudeBrowser();
            const result = await browser.executeCommand({ cmd: 'newpage' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Browser not launched');
            }
        });
    });
});
//# sourceMappingURL=browser.test.js.map