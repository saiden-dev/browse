# Anti-Bot Stealth Reference

Research notes on making Playwright WebKit less detectable by anti-bot systems. Compiled April 2026.

## Current State

Browse uses **Playwright WebKit** with a bare context — no stealth patches. This is trivially detected by every major anti-bot system (Cloudflare, DataDome, PerimeterX/HUMAN, Akamai).

### Detection Vectors

| Vector | Severity | Fixable from JS? |
|--------|----------|------------------|
| `navigator.webdriver` set to `true` | Critical | Yes |
| Empty `navigator.plugins` / `mimeTypes` | High | Yes |
| Default viewport (800x600-ish) | High | Yes |
| Missing/generic User-Agent | High | Yes |
| WebGL renderer = SwiftShader / generic | Medium | Yes |
| Permissions API inconsistencies | Medium | Yes |
| iframe cross-frame fingerprinting | Medium | Yes |
| TLS fingerprint (JA3/JA4) | Critical | **No** |
| IP reputation (datacenter IPs) | Critical | **No** |
| ML behavioral analysis | High | **No** |
| Cloudflare Turnstile / JS challenges | High | **No** |

## Stealth Ecosystem & WebKit

The two main stealth libraries **only support Chromium**:

- **`playwright-stealth`** (Python) — patches ~12 Chrome-specific APIs
- **`playwright-extra`** + stealth plugin (Node.js) — ~17 evasion modules targeting Chrome internals

WebKit and Firefox have entirely different internals. No stealth plugin exists for either. All patches for WebKit must be applied manually via `addInitScript()`.

## Recommended Patches

All patches use `context.addInitScript()` which runs before any page script in **any** Playwright engine (WebKit included).

### 1. WebDriver Flag

The single most important patch. Set to `undefined`, not `false` — some detectors specifically check for `false` as a signal of patching.

```typescript
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });
});
```

### 2. Context Hardening

Configure the browser context to look like a real Safari session:

```typescript
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  locale: 'en-US',
  timezoneId: 'Europe/Warsaw',
  colorScheme: 'light',
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
  },
});
```

Key points:
- Viewport should be realistic (1920x1080, 1440x900, 1536x864)
- User-Agent must match the engine — use a Safari UA for WebKit
- Locale, timezone, and Accept-Language should be consistent with each other

### 3. Plugins & MimeTypes

Headless reports empty arrays. Fake them:

```typescript
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });
  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => [1, 2],
  });
});
```

A more sophisticated version would create proper `PluginArray` and `MimeTypeArray` objects with `item()`, `namedItem()`, and `refresh()` methods, but the simple version passes most checks.

### 4. Permissions API

Fix the inconsistency between `Notification.permission` and `navigator.permissions.query`:

```typescript
await context.addInitScript(() => {
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters: any) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
      : originalQuery(parameters);
});
```

### 5. WebGL Renderer

Mask the GPU vendor/renderer strings. Parameters 37445 and 37446 are `UNMASKED_VENDOR_WEBGL` and `UNMASKED_RENDERER_WEBGL`:

```typescript
await context.addInitScript(() => {
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (parameter) {
    if (parameter === 37445) return 'Apple GPU';
    if (parameter === 37446) return 'Apple M1 Pro';
    return getParameter.call(this, parameter);
  };
});
```

Choose values that match the User-Agent. Apple GPU + Apple Silicon for Safari on macOS.

### 6. iframe ContentWindow Isolation

Some fingerprinters check `navigator.webdriver` inside iframes to catch incomplete patches:

```typescript
await context.addInitScript(() => {
  const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function () {
      const win = desc?.get?.call(this);
      if (win) {
        try {
          Object.defineProperty(win.navigator, 'webdriver', {
            get: () => undefined,
          });
        } catch (_) {}
      }
      return win;
    },
  });
});
```

### 7. Session Persistence

Fresh browser contexts with no cookies or history are a strong bot signal. Use browse's existing `session_save` / `session_restore` tools to persist cookies, localStorage, and sessionStorage across runs.

## What Cannot Be Fixed from JavaScript

### TLS Fingerprinting (JA3/JA4)

Anti-bot systems fingerprint the TLS Client Hello handshake — cipher suites, extensions, and their ordering. WebKit's TLS stack is compiled C++; no amount of JavaScript can change it. Playwright WebKit's JA3 hash doesn't match any shipping Safari release.

**Workarounds:**
- Residential proxies with TLS relay (proxy terminates TLS with its own stack)
- `curl-impersonate` for non-browser HTTP requests
- Switch to Chromium where TLS fingerprint matches real Chrome more closely

### IP Reputation

Datacenter IPs (Hetzner, AWS, GCP, etc.) are pre-flagged in commercial anti-bot databases.

**Workarounds:**
- Residential proxy rotation (BrightData, Oxylabs, etc.)
- Mobile proxies
- Running from a real residential IP (home connection)

### Behavioral Analysis

DataDome, Cloudflare, and PerimeterX use ML models trained on billions of real sessions. They analyze:
- Mouse movement patterns (speed, acceleration, curves)
- Scroll behavior (chunked vs smooth, pause patterns)
- Typing cadence
- Navigation timing
- Click patterns (direct element clicks vs natural approach)

**Workarounds:**
- Add realistic delays between actions (`page.waitForTimeout(random)`)
- Simulate mouse movements before clicks
- Scroll in chunks with pauses
- Type character by character with variable delays

### CAPTCHA / JavaScript Challenges

Cloudflare Turnstile, hCaptcha, and reCAPTCHA require real interaction or solving services.

**Workarounds:**
- CAPTCHA solving APIs: CapSolver, 2Captcha (~$2-5 per 1,000 solves)
- Wait for challenge resolution: 3-8 seconds after navigation
- Detect challenge pages by checking for known markers (`"Just a moment"`, `cf-challenge`, `_cf_chl_opt`)

## Implementation Strategy

### Recommended: Stealth Flag

Add an opt-in `stealth` option to `launch()`:

```typescript
async launch(options?: { stealth?: boolean }): Promise<void> {
  this.browser = await webkit.launch({ headless: this.options.headless });
  this.context = await this.browser.newContext({
    viewport: { width: this.options.width, height: this.options.height },
    ...(options?.stealth && {
      userAgent: SAFARI_USER_AGENT,
      locale: 'en-US',
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme: 'light',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    }),
  });

  if (options?.stealth) {
    await this.applyStealthPatches();
  }

  this.page = await this.context.newPage();
}
```

This keeps the default clean for testing while allowing stealth for real-world browsing.

### Nuclear Option: Chromium Engine

If stealth becomes a core requirement, add a `browser` engine option:

```typescript
launch({ engine: 'chromium', stealth: true })
```

Chromium has the richest stealth ecosystem:
- `playwright-extra` + stealth plugin (17 evasion modules)
- `playwright-with-fingerprints` (full fingerprint replacement)
- Better TLS fingerprint match to real Chrome
- Most anti-bot systems are tuned for Chrome, so evasions are better tested

Trade-off: Chromium is ~200MB heavier than WebKit.

## Anti-Bot Provider Cheat Sheet

| Provider | Primary Detection | Difficulty |
|----------|-------------------|------------|
| Cloudflare (standard) | TLS + JS challenge | Medium |
| Cloudflare (Turnstile) | Interactive challenge | Hard |
| DataDome | Behavioral analysis | Hard |
| PerimeterX / HUMAN | Deep fingerprinting (`_px` scripts) | Hard |
| Akamai Bot Manager | TLS + sensor data | Hard |
| Kasada | Obfuscated JS challenge | Very Hard |
| Basic WAFs | User-Agent + rate limiting | Easy |

## References

- [Playwright Anti-Bot Detection: What Works (2026) | AlterLab](https://alterlab.io/blog/playwright-anti-bot-detection-what-actually-works-in-2026)
- [Playwright Stealth: Bypass Bot Detection | Scrapfly](https://scrapfly.io/blog/posts/playwright-stealth-bypass-bot-detection)
- [Playwright Stealth Mode: The 7 Patches That Matter | DEV Community](https://dev.to/vhub_systems_ed5641f65d59/playwright-stealth-mode-in-2026-the-7-patches-that-actually-matter-46bp)
- [How to Avoid Bot Detection with Playwright | BrowserStack](https://www.browserstack.com/guide/playwright-bot-detection)
- [How To Make Playwright Undetectable | ScrapeOps](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/)
- [Detecting Vanilla Playwright | ScrapingAnt](https://scrapingant.com/blog/detect-playwright-bot)
- [Playwright Fingerprinting: Explained & Bypass | ZenRows](https://www.zenrows.com/blog/playwright-fingerprint)
