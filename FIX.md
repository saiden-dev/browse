# FIX: Navigation timeout on sites with persistent network activity

## Issue

The `goto` tool times out on sites like LinkedIn that have constant background network activity (tracking, websockets, polling). The tool waits for `networkidle` which never occurs.

**Example:** Navigating to `https://www.linkedin.com/in/aladac/` times out after 30s even though the page is fully rendered and usable.

## Current Behavior

```
page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://www.linkedin.com/in/aladac/", waiting until "networkidle"
```

## Suggested Fix

Add a `waitUntil` parameter to the `goto` tool with options:
- `load` - wait for load event (faster, sufficient for most cases)
- `domcontentloaded` - wait for DOM ready (fastest)
- `networkidle` - current behavior (wait for no network activity for 500ms)

Default should probably be `load` instead of `networkidle`.

### Implementation

In the goto handler, add parameter support:

```typescript
// Instead of:
await page.goto(url, { waitUntil: 'networkidle' });

// Allow:
await page.goto(url, { waitUntil: params.waitUntil ?? 'load' });
```

## Workaround

Currently, if the page loads visually but times out, use `mcp__browse__url` to verify the page is actually loaded - it will return the current URL and title even after goto times out.
