# Plan: Preview Tool — Single-Call Screenshot-to-Visor Pipeline

## Context

Currently, previewing an HTML mockup or live URL on the MARAUDER VISOR requires 4 sequential tool calls: `launch` → `goto` → `screenshot` → `bash curl POST /image`. This is slow, verbose, and prone to Claude pausing between steps to narrate.

**Goal:** Add a `preview` tool to the browse MCP that does the entire pipeline in one call. Optionally pushes to the visor automatically.

## Design

### New Tool: `preview`

browse is a standalone npm package — it must NOT know about the visor. The `preview` tool is a convenience wrapper for "goto + screenshot with viewport control" in a single call.

```typescript
server.tool('preview', 'Navigate to URL and screenshot in one call with custom viewport', {
  url: z.string(),                                    // URL or file:///path
  width: z.number().optional().default(1280),         // Viewport width
  height: z.number().optional().default(800),         // Viewport height
  fullPage: z.boolean().optional().default(false),    // Full page capture
  output: z.string().optional().default('/tmp/preview.png'),  // Screenshot path
});
```

**Returns:**
```json
{
  "ok": true,
  "path": "/tmp/preview.png",
  "url": "https://kwit.fit",
  "title": "kwit*fit"
}
```

### Behavior

1. If browser not launched → launch headless with given viewport dimensions
2. If browser already running with different viewport → resize to requested dimensions
3. Navigate to URL (supports `https://`, `http://`, `file:///`)
4. Wait for `networkidle` (with 5s timeout for SPAs)
5. Take screenshot → save to `output` path
6. Return result with path, url, and page title

### Visor Integration (marauder-plugin side, NOT in browse)

The visor push lives in the marauder-plugin preview skill as a simple bash curl after the browse tool returns. This keeps browse generic and visor-agnostic.

## Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `PreviewCommand` interface + add to `BrowserCommand` union |
| `src/browser.ts` | Add `preview()` method + `pushToVisor()` helper + case in `executeCommand()` |
| `src/mcp.ts` | Register `preview` tool with zod schema |
| `src/index.ts` | No change needed (types auto-exported) |

## Files Unchanged

- `src/cli.ts` — CLI doesn't need preview (it's an MCP-first tool)
- `src/image.ts` — No image processing needed
- `src/safari.ts`, `src/firefox.ts` — Unrelated

## Risks

| Risk | Mitigation |
|------|------------|
| Browser already launched with wrong viewport | Resize viewport before navigating |
| `file:///` URLs blocked by Playwright | WebKit allows file:// by default |
| Visor not running | Silent fail, return `visor: false` in response |
| Node `fetch` not available | Node 18+ has native fetch; browse requires Node 18+ |

## Verification

1. `npm run build` — compiles
2. `npm run check` — passes lint/format
3. Manual test: call `preview` tool from Claude Code with a URL
4. Manual test: call `preview` with `file:///tmp/mockup.html`
5. Verify visor displays the screenshot
6. `npm run test` if tests exist
7. Bump version, publish to npm
