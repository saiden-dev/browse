# Plan: Playwright Debugging Features

## Phase 1: Core Debugging (Console & Errors)

### Description
Implement fundamental debugging capabilities: console message capture and uncaught exception handling. These form the foundation for debugging client-side issues.

### Steps

#### Step 1.1: Add Console Command
- **Objective**: Capture and retrieve console messages from browser
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Status**: COMPLETE
- **Implementation**:
  - Add `ConsoleCommand` type with `level` filter and `clear` option
  - Store messages via `page.on('console')` listener
  - Return messages with level, text, timestamp, location

#### Step 1.2: Add Page Errors Command
- **Objective**: Capture uncaught exceptions and unhandled promise rejections
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: Step 1.1
- **Implementation**:
  - Add `ErrorsCommand` type with `clear` option
  - Listen to `page.on('pageerror')` for uncaught exceptions
  - Store error message, stack trace, timestamp
  - Add `browser://errors` MCP resource

## Phase 2: Network Monitoring

### Description
Implement network request/response capture for debugging API calls, identifying failed requests, and inspecting payloads.

### Steps

#### Step 2.1: Add Network Logging
- **Objective**: Capture all network requests and responses
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `NetworkCommand` type with `filter` and `clear` options
  - Listen to `page.on('request')` and `page.on('response')`
  - Store: url, method, status, resourceType, timing, headers
  - Add optional body capture for XHR/fetch (with size limit)
  - Add `browser://network` MCP resource

#### Step 2.2: Add Failed Requests Filter
- **Objective**: Quick access to failed/error requests
- **Files**: `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: Step 2.1
- **Implementation**:
  - Add `failed` filter option to NetworkCommand
  - Include requests with status >= 400 or network errors
  - Add `browser://network/failed` MCP resource

#### Step 2.3: Add Request Interception
- **Objective**: Block or mock specific requests
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: Step 2.1
- **Implementation**:
  - Add `InterceptCommand` with `action: 'block' | 'mock' | 'clear'`
  - Support URL patterns (glob or regex)
  - For mock: allow custom response body/status
  - Use `page.route()` for interception

## Phase 3: Performance & Metrics

### Description
Add performance timing and metrics collection for identifying bottlenecks and measuring page load characteristics.

### Steps

#### Step 3.1: Add Performance Metrics
- **Objective**: Return page performance timing data
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `MetricsCommand` type
  - Collect via `performance.timing` and `performance.getEntriesByType()`
  - Return: domContentLoaded, load, firstPaint, firstContentfulPaint
  - Include DOM stats: nodeCount, scriptCount, styleCount

#### Step 3.2: Add Resource Timing
- **Objective**: Get timing breakdown for individual resources
- **Files**: `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: Step 3.1
- **Implementation**:
  - Add `resources` option to MetricsCommand
  - Use `performance.getEntriesByType('resource')`
  - Return: name, duration, transferSize, initiatorType

## Phase 4: Accessibility

### Description
Implement accessibility tree inspection for debugging screen reader and a11y issues.

### Steps

#### Step 4.1: Add Accessibility Snapshot
- **Objective**: Dump accessibility tree for page or element
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `A11yCommand` with optional `selector` for subtree
  - Use `page.accessibility.snapshot()`
  - Return tree with role, name, value, description
  - Add `browser://a11y` MCP resource

## Phase 5: Dialog Handling

### Description
Implement automatic handling of browser dialogs (alert, confirm, prompt) to prevent blocking during automation.

### Steps

#### Step 5.1: Add Dialog Command
- **Objective**: Configure how dialogs are handled
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `DialogCommand` with `action: 'accept' | 'dismiss' | 'status'`
  - Option to set default behavior for future dialogs
  - Option to provide text response for prompts
  - Store dialog history (type, message, response)
  - Listen to `page.on('dialog')`

## Phase 6: Storage & Cookies

### Description
Add commands for inspecting and manipulating browser storage, complementing the existing session save/restore.

### Steps

#### Step 6.1: Add Cookies Command
- **Objective**: Get, set, and clear cookies
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `CookiesCommand` with `action: 'get' | 'set' | 'delete' | 'clear'`
  - Use `context.cookies()` and `context.addCookies()`
  - Support filtering by name/domain
  - Add `browser://cookies` MCP resource

#### Step 6.2: Add Storage Command
- **Objective**: Inspect/modify localStorage and sessionStorage
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `StorageCommand` with `type: 'local' | 'session'`
  - Actions: get, set, delete, clear
  - Implement via `page.evaluate()`
  - Add `browser://storage/local` and `browser://storage/session` resources

## Phase 7: Advanced Interactions

### Description
Add additional interaction commands for comprehensive testing scenarios.

### Steps

#### Step 7.1: Add Hover Command
- **Objective**: Trigger hover state on elements
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `HoverCommand` with `selector`
  - Use `page.hover(selector)`

#### Step 7.2: Add Select Command
- **Objective**: Select options in dropdown elements
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `SelectCommand` with `selector` and `value` (or values array)
  - Use `page.selectOption()`

#### Step 7.3: Add Keys Command
- **Objective**: Send keyboard shortcuts and special keys
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `KeysCommand` with `keys` string (e.g., "Control+a", "Escape")
  - Use `page.keyboard.press()`

#### Step 7.4: Add Upload Command
- **Objective**: Set files on file input elements
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `UploadCommand` with `selector` and `files` array
  - Use `page.setInputFiles()`

#### Step 7.5: Add Scroll Command
- **Objective**: Scroll page or element into view
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `ScrollCommand` with optional `selector`, `x`, `y`
  - If selector: use `element.scrollIntoView()`
  - Otherwise: use `window.scrollTo()`

## Phase 8: Viewport & Emulation

### Description
Add device emulation and viewport manipulation for responsive testing.

### Steps

#### Step 8.1: Add Viewport Command
- **Objective**: Resize browser viewport dynamically
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `ViewportCommand` with `width` and `height`
  - Use `page.setViewportSize()`

#### Step 8.2: Add Emulate Command
- **Objective**: Emulate specific devices
- **Files**: `src/types.ts`, `src/browser.ts`, `src/mcp.ts`
- **Dependencies**: Step 8.1
- **Implementation**:
  - Add `EmulateCommand` with `device` name
  - Use Playwright's device descriptors
  - Apply viewport, userAgent, deviceScaleFactor, touch support

## Phase 9: Documentation

### Description
Update all documentation with new commands and examples.

### Steps

#### Step 9.1: Update README
- **Objective**: Document all commands with examples
- **Files**: `README.md`
- **Dependencies**: Phases 1-8
- **Implementation**:
  - Add command reference grouped by category
  - Include curl/MCP examples
  - Document response formats

#### Step 9.2: Update CLAUDE.md
- **Objective**: Update developer documentation
- **Files**: `CLAUDE.md`
- **Dependencies**: Step 9.1
- **Implementation**:
  - Update architecture notes
  - Document new command types
