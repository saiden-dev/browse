# TODO: Preview Tool

## Phase 1: Add `preview` tool
- [ ] Add `PreviewCommand` interface to `src/types.ts`
- [ ] Add to `BrowserCommand` discriminated union
- [ ] Add `pushToVisor()` helper method to `ClaudeBrowser` in `src/browser.ts`
- [ ] Add `preview()` method to `ClaudeBrowser`
- [ ] Add `case 'preview'` in `executeCommand()` switch
- [ ] Register `preview` MCP tool in `src/mcp.ts` with zod schema
- [ ] `npm run build` — compiles clean
- [ ] `npm run check` — lint/format pass

## Phase 2: Test & Publish
- [ ] Test with URL: `preview({ url: "https://kwit.fit", title: "TEST" })`
- [ ] Test with file: `preview({ url: "file:///tmp/test.html" })`
- [ ] Test visor push works
- [ ] Test visor-down graceful fallback (`visor: false` in response)
- [ ] Test viewport resize when browser already running
- [ ] Bump version, publish to npm
- [ ] Update marauder-plugin `.mcp.json` if needed

## Phase 3: Skill cleanup
- [ ] Delete `marauder-plugin/skills/preview/preview.py`
- [ ] Rewrite `marauder-plugin/skills/preview/SKILL.md` as simple one-liner reference

### ETA

| Phase | Naive | Coop | Sessions | Notes |
|-------|-------|------|----------|-------|
| 1. Add tool | 2h | ~30m | 1 | Mechanical — follow existing pattern exactly |
| 2. Test & publish | 1h | ~15m | 1 | Same session |
| 3. Skill cleanup | 30m | ~10m | 1 | Delete + rewrite |
| **Total** | **3.5h** | **~55m** | **1** | Single session, single commit |
