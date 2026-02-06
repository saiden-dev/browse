# Plan: Web Debugging Commands

## Phase 1: Storage & Session Commands

### Description
Add commands for inspecting and manipulating browser storage and cookies. These are essential for debugging authentication, session state, and client-side data persistence.

### Steps

#### Step 1.1: Add Cookies Command
- **Objective**: Implement get/set/clear cookies functionality
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `CookiesCommand` type with `action: 'get' | 'set' | 'clear'`
  - Add optional `name`, `value`, `url` fields for set operation
  - Implement `cookies()` method using `context.cookies()` and `context.addCookies()`
  - Add logging with cookie icon

#### Step 1.2: Add Storage Command
- **Objective**: Implement localStorage and sessionStorage read/write/clear
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: Step 1.1
- **Implementation**:
  - Add `StorageCommand` type with `storage: 'local' | 'session'` and `action: 'get' | 'set' | 'clear'`
  - Implement via `page.evaluate()` accessing `window.localStorage` / `window.sessionStorage`
  - Return all items on get, or specific key if provided

## Phase 2: Console & Debugging Commands

### Description
Add commands for capturing console output and debugging page state. Critical for understanding client-side errors and application behavior.

### Steps

#### Step 2.1: Add Console Command
- **Objective**: Capture and return console messages (log, error, warn, info)
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `ConsoleCommand` type with optional `clear: boolean`
  - Store console messages in array via `page.on('console')`
  - Initialize listener in `launch()` method
  - Return accumulated messages with type, text, and timestamp

#### Step 2.2: Add Metrics Command
- **Objective**: Return performance metrics and DOM statistics
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `MetricsCommand` type
  - Use `page.evaluate()` to gather `performance.timing`, DOM node counts
  - Return structured metrics object

## Phase 3: Interaction Commands

### Description
Add commands for advanced page interactions beyond click and type. Enables testing hover states, keyboard shortcuts, and form controls.

### Steps

#### Step 3.1: Add Scroll Command
- **Objective**: Scroll to position, element, or by delta
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `ScrollCommand` with `selector?: string`, `x?: number`, `y?: number`, `behavior?: 'smooth' | 'instant'`
  - If selector provided, use `element.scrollIntoView()`
  - Otherwise use `window.scrollTo()`

#### Step 3.2: Add Hover Command
- **Objective**: Trigger hover state on element
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `HoverCommand` with `selector: string`
  - Use `page.hover(selector)`
  - Return success with element info

#### Step 3.3: Add Select Command
- **Objective**: Select option(s) in dropdown/select elements
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `SelectCommand` with `selector: string`, `value: string | string[]`
  - Use `page.selectOption(selector, value)`
  - Return selected values

#### Step 3.4: Add Keys Command
- **Objective**: Send keyboard shortcuts and special keys
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `KeysCommand` with `keys: string` (e.g., "Control+a", "Escape", "Enter")
  - Use `page.keyboard.press()` for single keys
  - Support key combinations

## Phase 4: Network Commands

### Description
Add commands for network inspection and manipulation. Enables debugging API calls, blocking resources, and simulating network conditions.

### Steps

#### Step 4.1: Add Network Logging
- **Objective**: Capture and return network requests/responses
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `NetworkCommand` with `action: 'log' | 'clear'`, optional `filter: string`
  - Store requests via `page.on('request')` and `page.on('response')`
  - Return array of {url, method, status, type, timing}

#### Step 4.2: Add Block Command
- **Objective**: Block URLs or patterns (ads, analytics, etc.)
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: Step 4.1
- **Implementation**:
  - Add `BlockCommand` with `patterns: string[]` and `action: 'add' | 'remove' | 'clear'`
  - Use `page.route()` to abort matching requests
  - Maintain list of blocked patterns

#### Step 4.3: Add Throttle Command
- **Objective**: Simulate slow network conditions
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `ThrottleCommand` with `preset: 'slow3g' | 'fast3g' | 'offline' | 'none'`
  - Use CDP session to set network conditions via `Network.emulateNetworkConditions`

## Phase 5: Output Commands

### Description
Add commands for exporting page content in different formats.

### Steps

#### Step 5.1: Add PDF Command
- **Objective**: Save page as PDF
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `PdfCommand` with `path: string`, optional `format`, `landscape`, `margin`
  - Use `page.pdf()` (WebKit supports this)
  - Return path to saved file

#### Step 5.2: Add Accessibility Command
- **Objective**: Dump accessibility tree snapshot
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `AccessibilityCommand` with optional `selector` for subtree
  - Use `page.accessibility.snapshot()`
  - Return tree structure

## Phase 6: Advanced Commands

### Description
Add commands for viewport manipulation, device emulation, and frame handling.

### Steps

#### Step 6.1: Add Viewport Command
- **Objective**: Resize viewport dynamically
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `ViewportCommand` with `width: number`, `height: number`
  - Use `page.setViewportSize()`
  - Return new dimensions

#### Step 6.2: Add Emulate Command
- **Objective**: Emulate mobile devices
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: Step 6.1
- **Implementation**:
  - Add `EmulateCommand` with `device: string` (e.g., 'iPhone 12', 'Pixel 5')
  - Use Playwright's device descriptors
  - Apply viewport, userAgent, deviceScaleFactor

#### Step 6.3: Add Frames Command
- **Objective**: List and switch to iframe contexts
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `FramesCommand` with `action: 'list' | 'switch'`, optional `selector` or `index`
  - Use `page.frames()` to list, `frame.locator()` to switch context
  - Track current frame for subsequent commands

#### Step 6.4: Add Dialog Command
- **Objective**: Handle alert/confirm/prompt dialogs
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `DialogCommand` with `action: 'accept' | 'dismiss'`, optional `text` for prompt
  - Set up `page.on('dialog')` handler
  - Queue dialogs and respond based on command

#### Step 6.5: Add Upload Command
- **Objective**: Fill file input elements
- **Files**: `src/types.ts`, `src/browser.ts`, `src/server.ts`, `src/index.ts`
- **Dependencies**: None
- **Implementation**:
  - Add `UploadCommand` with `selector: string`, `files: string[]`
  - Use `page.setInputFiles(selector, files)`
  - Return success with file count

## Phase 7: Documentation & Polish

### Description
Update documentation and CLI help text with all new commands.

### Steps

#### Step 7.1: Update README
- **Objective**: Document all new commands with examples
- **Files**: `README.md`
- **Dependencies**: Phases 1-6
- **Implementation**:
  - Add command reference section
  - Include curl examples for each command
  - Document response formats

#### Step 7.2: Update CLAUDE.md
- **Objective**: Update developer documentation
- **Files**: `CLAUDE.md`
- **Dependencies**: Step 7.1
- **Implementation**:
  - Update architecture section with new command flow
  - Document internal logging format

#### Step 7.3: Update CLI Help
- **Objective**: Update --help output with command list
- **Files**: `src/cli.ts`
- **Dependencies**: Phases 1-6
- **Implementation**:
  - Expand server mode help section
  - Group commands by category
