import { exec } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { webkit } from 'playwright';
const execAsync = promisify(exec);
import * as image from './image.js';
import * as safari from './safari.js';
export class ClaudeBrowser {
    browser = null;
    context = null;
    page = null;
    options;
    consoleMessages = [];
    networkEntries = [];
    pageErrors = [];
    dialogHistory = [];
    dialogConfig = { autoAccept: false, autoDismiss: false, promptText: '' };
    interceptPatterns = new Map();
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? true,
            width: options.width ?? 1280,
            height: options.height ?? 800,
            fullscreen: options.fullscreen ?? false,
            preview: options.preview ?? false,
            previewDelay: options.previewDelay ?? 2000,
        };
    }
    async launch() {
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
        this.setupErrorListener(this.page);
        this.setupDialogListener(this.page);
        if (this.options.fullscreen && !this.options.headless) {
            await this.enterFullscreen();
        }
    }
    async enterFullscreen() {
        if (process.platform !== 'darwin') {
            console.warn('Native fullscreen only supported on macOS');
            return;
        }
        // AppleScript to fullscreen the Playwright window by process name
        const script = `
      tell application "System Events"
        tell process "Playwright"
          set value of attribute "AXFullScreen" of window 1 to true
        end tell
      end tell
    `;
        // Retry logic: wait for window to appear, then fullscreen
        const maxAttempts = 5;
        const delayMs = 500;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                await execAsync(`osascript -e '${script}'`);
                return; // Success
            }
            catch (err) {
                if (attempt === maxAttempts) {
                    console.warn('Failed to enter fullscreen:', err.message);
                }
                // Window may not be ready yet, retry
            }
        }
    }
    async previewAction(selector, action) {
        if (!this.options.preview)
            return;
        const page = this.ensurePage();
        const escapedSelector = JSON.stringify(selector);
        const escapedAction = JSON.stringify(action);
        // Highlight the element with a pulsing red border
        const highlightScript = `
      (() => {
        const selector = ${escapedSelector};
        const action = ${escapedAction};
        const el = document.querySelector(selector);
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const overlay = document.createElement('div');
        overlay.id = '__claude_preview_overlay__';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:999998;pointer-events:none';

        const label = document.createElement('div');
        label.id = '__claude_preview_label__';
        label.textContent = action + ': ' + selector;
        label.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#e11d48;color:white;padding:12px 24px;border-radius:8px;font-family:system-ui,sans-serif;font-size:16px;font-weight:600;z-index:1000001;box-shadow:0 4px 12px rgba(0,0,0,0.3)';

        const rect = el.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.id = '__claude_preview_highlight__';
        highlight.style.cssText = 'position:fixed;top:' + (rect.top - 4) + 'px;left:' + (rect.left - 4) + 'px;width:' + (rect.width + 8) + 'px;height:' + (rect.height + 8) + 'px;border:3px solid #e11d48;border-radius:4px;z-index:1000000;pointer-events:none;box-shadow:0 0 0 4px rgba(225,29,72,0.3);animation:__claude_pulse__ 1s ease-in-out infinite';

        const style = document.createElement('style');
        style.id = '__claude_preview_style__';
        style.textContent = '@keyframes __claude_pulse__{0%,100%{box-shadow:0 0 0 4px rgba(225,29,72,0.3)}50%{box-shadow:0 0 0 8px rgba(225,29,72,0.5)}}';

        document.head.appendChild(style);
        document.body.appendChild(overlay);
        document.body.appendChild(highlight);
        document.body.appendChild(label);
      })()
    `;
        await page.evaluate(highlightScript);
        await page.waitForTimeout(this.options.previewDelay);
        // Clean up highlight
        const cleanupScript = `
      (() => {
        ['__claude_preview_overlay__', '__claude_preview_highlight__', '__claude_preview_label__', '__claude_preview_style__']
          .forEach(id => document.getElementById(id)?.remove());
      })()
    `;
        await page.evaluate(cleanupScript);
    }
    setupErrorListener(page) {
        page.on('pageerror', (error) => {
            this.pageErrors.push({
                message: error.message,
                stack: error.stack,
                timestamp: Date.now(),
            });
        });
    }
    setupDialogListener(page) {
        page.on('dialog', async (dialog) => {
            const entry = {
                type: dialog.type(),
                message: dialog.message(),
                defaultValue: dialog.defaultValue() || undefined,
                timestamp: Date.now(),
            };
            if (this.dialogConfig.autoAccept) {
                await dialog.accept(this.dialogConfig.promptText || undefined);
                entry.response = this.dialogConfig.promptText || true;
            }
            else if (this.dialogConfig.autoDismiss) {
                await dialog.dismiss();
                entry.response = false;
            }
            else {
                // Default: accept to prevent blocking
                await dialog.accept();
                entry.response = true;
            }
            this.dialogHistory.push(entry);
        });
    }
    setupConsoleListener(page) {
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
    setupNetworkListener(page) {
        const pendingRequests = new Map();
        page.on('request', (request) => {
            const entry = {
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
                }
                catch {
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
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }
    ensurePage() {
        if (!this.page) {
            throw new Error('Browser not launched. Call launch() first.');
        }
        return this.page;
    }
    /** Get the current page instance (for advanced usage) */
    getPage() {
        return this.page;
    }
    /** Get the browser context (for advanced usage like cookies) */
    getContext() {
        return this.context;
    }
    async goto(url) {
        const page = this.ensurePage();
        await page.goto(url, { waitUntil: 'networkidle' });
        return { url: page.url(), title: await page.title() };
    }
    async click(selector) {
        const page = this.ensurePage();
        await this.previewAction(selector, 'CLICK');
        await page.click(selector);
        await page.waitForLoadState('networkidle').catch(() => { });
        return { url: page.url() };
    }
    async type(selector, text) {
        const page = this.ensurePage();
        await this.previewAction(selector, `TYPE "${text}"`);
        await page.fill(selector, text);
    }
    async query(selector) {
        const page = this.ensurePage();
        return page.$$eval(selector, (nodes) => nodes.map((el) => {
            const attrs = {};
            for (const attr of el.attributes) {
                attrs[attr.name] = attr.value;
            }
            return {
                tag: el.tagName.toLowerCase(),
                text: el.textContent?.trim().slice(0, 200) || '',
                attributes: attrs,
            };
        }));
    }
    async screenshot(path, fullPage = false) {
        const page = this.ensurePage();
        const resolvedPath = resolve(path || 'screenshot.png');
        const buffer = await page.screenshot({ path: resolvedPath, fullPage });
        return { path: resolvedPath, buffer };
    }
    async getUrl() {
        const page = this.ensurePage();
        return { url: page.url(), title: await page.title() };
    }
    async getHtml(full = false) {
        const page = this.ensurePage();
        const html = await page.content();
        return full ? html : html.slice(0, 10000);
    }
    async back() {
        const page = this.ensurePage();
        await page.goBack();
        return { url: page.url() };
    }
    async forward() {
        const page = this.ensurePage();
        await page.goForward();
        return { url: page.url() };
    }
    async reload() {
        const page = this.ensurePage();
        await page.reload();
        return { url: page.url() };
    }
    async wait(ms = 1000) {
        const page = this.ensurePage();
        await page.waitForTimeout(ms);
    }
    async newPage() {
        if (!this.context) {
            throw new Error('Browser not launched. Call launch() first.');
        }
        this.page = await this.context.newPage();
        this.setupConsoleListener(this.page);
        this.setupNetworkListener(this.page);
        this.setupErrorListener(this.page);
        this.setupDialogListener(this.page);
    }
    async eval(script) {
        const page = this.ensurePage();
        return page.evaluate(script);
    }
    getConsole(level, clear = false) {
        let messages = this.consoleMessages;
        if (level && level !== 'all') {
            messages = messages.filter((m) => m.level === level);
        }
        if (clear) {
            this.consoleMessages = [];
        }
        return messages;
    }
    clearConsole() {
        this.consoleMessages = [];
    }
    getNetwork(filter, clear = false) {
        let entries = this.networkEntries;
        if (filter && filter !== 'all') {
            if (filter === 'failed') {
                entries = entries.filter((e) => e.error || (e.status && e.status >= 400));
            }
            else {
                entries = entries.filter((e) => e.resourceType === filter);
            }
        }
        if (clear) {
            this.networkEntries = [];
        }
        return entries;
    }
    clearNetwork() {
        this.networkEntries = [];
    }
    getErrors(clear = false) {
        const errors = this.pageErrors;
        if (clear) {
            this.pageErrors = [];
        }
        return errors;
    }
    clearErrors() {
        this.pageErrors = [];
    }
    async getMetrics(includeResources = false) {
        const page = this.ensurePage();
        const metricsScript = `(() => {
      const timing = performance.timing;
      const navigationStart = timing.navigationStart;
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(e => e.name === 'first-paint');
      const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
      return {
        timing: {
          domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
          load: timing.loadEventEnd - navigationStart,
          firstPaint: firstPaint ? firstPaint.startTime : undefined,
          firstContentfulPaint: fcp ? fcp.startTime : undefined,
        },
        dom: {
          nodes: document.getElementsByTagName('*').length,
          scripts: document.getElementsByTagName('script').length,
          stylesheets: document.getElementsByTagName('link').length,
          images: document.getElementsByTagName('img').length,
        },
      };
    })()`;
        const metrics = (await page.evaluate(metricsScript));
        if (includeResources) {
            const resourcesScript = `(() => {
        return performance.getEntriesByType('resource').map(entry => ({
          name: entry.name,
          type: entry.initiatorType,
          duration: Math.round(entry.duration),
          size: entry.transferSize || 0,
        }));
      })()`;
            const resources = (await page.evaluate(resourcesScript));
            return { ...metrics, resources };
        }
        return metrics;
    }
    async getA11y(selector) {
        const page = this.ensurePage();
        // Build a11y tree using ARIA attributes and semantic roles
        const selectorArg = selector ? JSON.stringify(selector) : 'null';
        const script = `((selector) => {
      function getA11yNode(el) {
        const role = el.getAttribute('role') || getImplicitRole(el);
        const name = getAccessibleName(el);
        const node = { role, name: name || undefined };
        const value = el.value || el.getAttribute('aria-valuenow');
        if (value) node.value = String(value);
        const desc = el.getAttribute('aria-describedby');
        if (desc) {
          const descEl = document.getElementById(desc);
          if (descEl) node.description = descEl.textContent?.trim();
        }
        const children = [];
        for (const child of el.children) {
          if (isAccessible(child)) children.push(getA11yNode(child));
        }
        if (children.length) node.children = children;
        return node;
      }
      function getImplicitRole(el) {
        const tag = el.tagName.toLowerCase();
        const roleMap = { button:'button', a:'link', input:'textbox', img:'img',
          h1:'heading', h2:'heading', h3:'heading', h4:'heading', nav:'navigation',
          main:'main', footer:'contentinfo', header:'banner', aside:'complementary',
          form:'form', table:'table', ul:'list', ol:'list', li:'listitem' };
        return roleMap[tag] || 'generic';
      }
      function getAccessibleName(el) {
        return el.getAttribute('aria-label') || el.getAttribute('alt')
          || el.getAttribute('title') || (el.tagName === 'INPUT' ? el.placeholder : null)
          || el.textContent?.trim().slice(0, 100);
      }
      function isAccessible(el) {
        if (el.nodeType !== 1) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }
      const root = selector ? document.querySelector(selector) : document.body;
      return root ? getA11yNode(root) : null;
    })(${selectorArg})`;
        return page.evaluate(script);
    }
    getDialogs() {
        return this.dialogHistory;
    }
    clearDialogs() {
        this.dialogHistory = [];
    }
    setDialogConfig(config) {
        if (config.autoAccept !== undefined)
            this.dialogConfig.autoAccept = config.autoAccept;
        if (config.autoDismiss !== undefined)
            this.dialogConfig.autoDismiss = config.autoDismiss;
        if (config.text !== undefined)
            this.dialogConfig.promptText = config.text;
    }
    getDialogConfig() {
        return { autoAccept: this.dialogConfig.autoAccept, autoDismiss: this.dialogConfig.autoDismiss };
    }
    async addIntercept(pattern, action, response) {
        const page = this.ensurePage();
        this.interceptPatterns.set(pattern, { action, response });
        await page.route(pattern, (route) => this.handleIntercept(pattern, route));
    }
    async handleIntercept(pattern, route) {
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
    async clearIntercepts() {
        const page = this.ensurePage();
        for (const pattern of this.interceptPatterns.keys()) {
            await page.unroute(pattern);
        }
        this.interceptPatterns.clear();
    }
    getInterceptPatterns() {
        return Array.from(this.interceptPatterns.keys());
    }
    // Phase 6: Cookies & Storage
    async getCookies(name) {
        const context = this.getContext();
        if (!context)
            throw new Error('Browser not launched');
        const cookies = await context.cookies();
        const filtered = name ? cookies.filter((c) => c.name === name) : cookies;
        return filtered.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }));
    }
    async setCookie(name, value, url) {
        const context = this.getContext();
        if (!context)
            throw new Error('Browser not launched');
        const page = this.ensurePage();
        await context.addCookies([{ name, value, url: url || page.url() }]);
    }
    async deleteCookie(name) {
        const context = this.getContext();
        if (!context)
            throw new Error('Browser not launched');
        const cookies = await context.cookies();
        const toKeep = cookies.filter((c) => c.name !== name);
        await context.clearCookies();
        if (toKeep.length > 0)
            await context.addCookies(toKeep);
    }
    async clearCookies() {
        const context = this.getContext();
        if (!context)
            throw new Error('Browser not launched');
        await context.clearCookies();
    }
    async getStorage(type, key) {
        const page = this.ensurePage();
        const storage = type === 'local' ? 'localStorage' : 'sessionStorage';
        const script = key
            ? `({ [${JSON.stringify(key)}]: ${storage}.getItem(${JSON.stringify(key)}) || '' })`
            : `Object.fromEntries(Array.from({ length: ${storage}.length }, (_, i) => {
          const k = ${storage}.key(i); return [k, ${storage}.getItem(k)];
        }))`;
        return page.evaluate(script);
    }
    async setStorage(type, key, value) {
        const page = this.ensurePage();
        const storage = type === 'local' ? 'localStorage' : 'sessionStorage';
        await page.evaluate(`${storage}.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
    }
    async deleteStorage(type, key) {
        const page = this.ensurePage();
        const storage = type === 'local' ? 'localStorage' : 'sessionStorage';
        await page.evaluate(`${storage}.removeItem(${JSON.stringify(key)})`);
    }
    async clearStorage(type) {
        const page = this.ensurePage();
        const storage = type === 'local' ? 'localStorage' : 'sessionStorage';
        await page.evaluate(`${storage}.clear()`);
    }
    // Phase 7: Advanced Interactions
    async hover(selector) {
        const page = this.ensurePage();
        await this.previewAction(selector, 'HOVER');
        await page.hover(selector);
    }
    async select(selector, value) {
        const page = this.ensurePage();
        const valueStr = Array.isArray(value) ? value.join(', ') : value;
        await this.previewAction(selector, `SELECT "${valueStr}"`);
        return page.selectOption(selector, value);
    }
    async keys(keys) {
        const page = this.ensurePage();
        await page.keyboard.press(keys);
    }
    async upload(selector, files) {
        const page = this.ensurePage();
        await page.setInputFiles(selector, files);
    }
    async scroll(selector, x, y) {
        const page = this.ensurePage();
        if (selector) {
            await page.locator(selector).scrollIntoViewIfNeeded();
        }
        else {
            await page.evaluate(`window.scrollTo(${x || 0}, ${y || 0})`);
        }
    }
    // Phase 8: Viewport & Emulation
    async setViewport(width, height) {
        const page = this.ensurePage();
        await page.setViewportSize({ width, height });
        return { width, height };
    }
    async emulate(device) {
        const page = this.ensurePage();
        const { devices } = await import('playwright');
        const deviceConfig = devices[device];
        if (!deviceConfig)
            throw new Error(`Unknown device: ${device}. Try 'iPhone 13', 'Pixel 5', etc.`);
        await page.setViewportSize(deviceConfig.viewport);
        return deviceConfig.viewport;
    }
    handleDialogCommand(cmd) {
        switch (cmd.action) {
            case 'status':
                return { ok: true, dialogs: this.getDialogs(), dialogConfig: this.getDialogConfig() };
            case 'accept':
                this.setDialogConfig({ autoAccept: true, autoDismiss: false, text: cmd.text });
                return { ok: true, dialogConfig: this.getDialogConfig() };
            case 'dismiss':
                this.setDialogConfig({ autoAccept: false, autoDismiss: true });
                return { ok: true, dialogConfig: this.getDialogConfig() };
            case 'config':
                this.setDialogConfig({
                    autoAccept: cmd.autoAccept,
                    autoDismiss: cmd.autoDismiss,
                    text: cmd.text,
                });
                return { ok: true, dialogConfig: this.getDialogConfig() };
            default:
                return { ok: false, error: 'Unknown dialog action' };
        }
    }
    async handleCookiesCommand(cmd) {
        switch (cmd.action) {
            case 'get': {
                const cookies = await this.getCookies(cmd.name);
                return { ok: true, cookies, count: cookies.length };
            }
            case 'set': {
                if (!cmd.name || !cmd.value)
                    return { ok: false, error: 'Name and value required' };
                await this.setCookie(cmd.name, cmd.value, cmd.url);
                return { ok: true };
            }
            case 'delete': {
                if (!cmd.name)
                    return { ok: false, error: 'Name required' };
                await this.deleteCookie(cmd.name);
                return { ok: true };
            }
            case 'clear': {
                await this.clearCookies();
                return { ok: true };
            }
            default:
                return { ok: false, error: 'Unknown cookies action' };
        }
    }
    async handleStorageCommand(cmd) {
        switch (cmd.action) {
            case 'get': {
                const storage = await this.getStorage(cmd.type, cmd.key);
                return { ok: true, storage, count: Object.keys(storage).length };
            }
            case 'set': {
                if (!cmd.key || cmd.value === undefined)
                    return { ok: false, error: 'Key and value required' };
                await this.setStorage(cmd.type, cmd.key, cmd.value);
                return { ok: true };
            }
            case 'delete': {
                if (!cmd.key)
                    return { ok: false, error: 'Key required' };
                await this.deleteStorage(cmd.type, cmd.key);
                return { ok: true };
            }
            case 'clear': {
                await this.clearStorage(cmd.type);
                return { ok: true };
            }
            default:
                return { ok: false, error: 'Unknown storage action' };
        }
    }
    async handleImportCommand(cmd) {
        const context = this.getContext();
        if (!context)
            throw new Error('Browser not launched');
        if (cmd.source === 'safari') {
            const cookies = await safari.importSafariCookies({
                domain: cmd.domain,
                profile: cmd.profile,
            });
            if (cookies.length === 0) {
                return {
                    ok: true,
                    imported: 0,
                    source: 'safari',
                    domains: [],
                };
            }
            // Convert to Playwright format and add to context
            const playwrightCookies = cookies.map(safari.toPlaywrightCookie);
            await context.addCookies(playwrightCookies);
            // Get unique domains for reporting
            const domains = [...new Set(cookies.map((c) => c.domain))];
            return {
                ok: true,
                imported: cookies.length,
                source: 'safari',
                domains,
            };
        }
        return { ok: false, error: `Unknown import source: ${cmd.source}` };
    }
    async executeCommand(cmd) {
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
                case 'errors': {
                    const errors = this.getErrors(cmd.clear);
                    return { ok: true, count: errors.length, errors };
                }
                case 'metrics': {
                    const metrics = await this.getMetrics(cmd.resources);
                    return { ok: true, metrics };
                }
                case 'a11y': {
                    const a11y = await this.getA11y(cmd.selector);
                    return { ok: true, a11y: a11y || undefined };
                }
                case 'dialog':
                    return this.handleDialogCommand(cmd);
                case 'cookies':
                    return this.handleCookiesCommand(cmd);
                case 'storage':
                    return this.handleStorageCommand(cmd);
                case 'hover': {
                    await this.hover(cmd.selector);
                    return { ok: true };
                }
                case 'select': {
                    const selected = await this.select(cmd.selector, cmd.value);
                    return { ok: true, selected };
                }
                case 'keys': {
                    await this.keys(cmd.keys);
                    return { ok: true };
                }
                case 'upload': {
                    await this.upload(cmd.selector, cmd.files);
                    return { ok: true };
                }
                case 'scroll': {
                    await this.scroll(cmd.selector, cmd.x, cmd.y);
                    return { ok: true };
                }
                case 'viewport': {
                    const viewport = await this.setViewport(cmd.width, cmd.height);
                    return { ok: true, viewport };
                }
                case 'emulate': {
                    const viewport = await this.emulate(cmd.device);
                    return { ok: true, viewport };
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
                    const result = await image.crop(cmd.input, cmd.output, cmd.left, cmd.top, cmd.width, cmd.height);
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
                case 'import':
                    return this.handleImportCommand(cmd);
                default: {
                    const _exhaustive = cmd;
                    return { ok: false, error: `Unknown command: ${_exhaustive.cmd}` };
                }
            }
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    }
}
//# sourceMappingURL=browser.js.map