export interface BrowserOptions {
  headless?: boolean;
  width?: number;
  height?: number;
  fullscreen?: boolean;
  preview?: boolean;
  previewDelay?: number;
}

export interface ElementInfo {
  tag: string;
  text: string;
  attributes: Record<string, string>;
}

// Command types
export interface GotoCommand {
  cmd: 'goto';
  url: string;
}

export interface ClickCommand {
  cmd: 'click';
  selector: string;
}

export interface TypeCommand {
  cmd: 'type';
  selector: string;
  text: string;
}

export interface QueryCommand {
  cmd: 'query';
  selector: string;
}

export interface ScreenshotCommand {
  cmd: 'screenshot';
  path?: string;
  fullPage?: boolean;
}

export interface UrlCommand {
  cmd: 'url';
}

export interface HtmlCommand {
  cmd: 'html';
  full?: boolean;
}

export interface BackCommand {
  cmd: 'back';
}

export interface ForwardCommand {
  cmd: 'forward';
}

export interface ReloadCommand {
  cmd: 'reload';
}

export interface WaitCommand {
  cmd: 'wait';
  ms?: number;
}

export interface NewPageCommand {
  cmd: 'newpage';
}

export interface CloseCommand {
  cmd: 'close';
}

export interface EvalCommand {
  cmd: 'eval';
  script: string;
}

// Image processing commands
export interface FaviconCommand {
  cmd: 'favicon';
  input: string;
  outputDir: string;
}

export interface ConvertCommand {
  cmd: 'convert';
  input: string;
  output: string;
  format: 'png' | 'jpeg' | 'webp' | 'avif';
}

export interface ResizeCommand {
  cmd: 'resize';
  input: string;
  output: string;
  width: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface CropCommand {
  cmd: 'crop';
  input: string;
  output: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CompressCommand {
  cmd: 'compress';
  input: string;
  output: string;
  quality?: number;
}

export interface ThumbnailCommand {
  cmd: 'thumbnail';
  input: string;
  output: string;
  size?: 'small' | 'medium' | 'large';
}

export interface ConsoleCommand {
  cmd: 'console';
  clear?: boolean;
  level?: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'all';
}

export interface ConsoleMessage {
  level: string;
  text: string;
  timestamp: number;
  location?: string;
}

export interface NetworkEntry {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  timing?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  size?: number;
  error?: string;
}

export interface NetworkCommand {
  cmd: 'network';
  clear?: boolean;
  filter?: 'all' | 'failed' | 'xhr' | 'fetch' | 'document' | 'script' | 'stylesheet' | 'image';
}

export interface InterceptCommand {
  cmd: 'intercept';
  action: 'block' | 'mock' | 'list' | 'clear';
  pattern?: string;
  response?: {
    status?: number;
    body?: string;
    contentType?: string;
  };
}

export interface PageError {
  message: string;
  stack?: string;
  timestamp: number;
}

export interface ErrorsCommand {
  cmd: 'errors';
  clear?: boolean;
}

export interface MetricsData {
  timing: {
    domContentLoaded?: number;
    load?: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  };
  dom: {
    nodes: number;
    scripts: number;
    stylesheets: number;
    images: number;
  };
  resources?: Array<{
    name: string;
    type: string;
    duration: number;
    size: number;
  }>;
}

export interface MetricsCommand {
  cmd: 'metrics';
  resources?: boolean;
}

export interface A11yNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  children?: A11yNode[];
}

export interface A11yCommand {
  cmd: 'a11y';
  selector?: string;
}

export interface DialogEntry {
  type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  message: string;
  defaultValue?: string;
  response?: string | boolean;
  timestamp: number;
}

export interface DialogCommand {
  cmd: 'dialog';
  action: 'status' | 'accept' | 'dismiss' | 'config';
  text?: string;
  autoAccept?: boolean;
  autoDismiss?: boolean;
}

// Phase 6: Storage & Cookies
export interface CookiesCommand {
  cmd: 'cookies';
  action: 'get' | 'set' | 'delete' | 'clear';
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  url?: string;
}

export interface StorageCommand {
  cmd: 'storage';
  type: 'local' | 'session';
  action: 'get' | 'set' | 'delete' | 'clear';
  key?: string;
  value?: string;
}

// Phase 7: Advanced Interactions
export interface HoverCommand {
  cmd: 'hover';
  selector: string;
}

export interface SelectCommand {
  cmd: 'select';
  selector: string;
  value: string | string[];
}

export interface KeysCommand {
  cmd: 'keys';
  keys: string;
}

export interface UploadCommand {
  cmd: 'upload';
  selector: string;
  files: string[];
}

export interface ScrollCommand {
  cmd: 'scroll';
  selector?: string;
  x?: number;
  y?: number;
}

// Phase 8: Viewport & Emulation
export interface ViewportCommand {
  cmd: 'viewport';
  width: number;
  height: number;
}

export interface EmulateCommand {
  cmd: 'emulate';
  device: string;
}

// Safari import
export interface ImportCommand {
  cmd: 'import';
  source: 'safari';
  domain?: string;
  profile?: string;
}

export type BrowserCommand =
  | GotoCommand
  | ClickCommand
  | TypeCommand
  | QueryCommand
  | ScreenshotCommand
  | UrlCommand
  | HtmlCommand
  | BackCommand
  | ForwardCommand
  | ReloadCommand
  | WaitCommand
  | NewPageCommand
  | CloseCommand
  | EvalCommand
  | FaviconCommand
  | ConvertCommand
  | ResizeCommand
  | CropCommand
  | CompressCommand
  | ThumbnailCommand
  | ConsoleCommand
  | NetworkCommand
  | InterceptCommand
  | ErrorsCommand
  | MetricsCommand
  | A11yCommand
  | DialogCommand
  | CookiesCommand
  | StorageCommand
  | HoverCommand
  | SelectCommand
  | KeysCommand
  | UploadCommand
  | ScrollCommand
  | ViewportCommand
  | EmulateCommand
  | ImportCommand;

// Response types
export interface SuccessResponse {
  ok: true;
  url?: string;
  title?: string;
  path?: string;
  html?: string;
  count?: number;
  elements?: ElementInfo[];
  result?: unknown;
  // Image processing fields
  files?: string[];
  outputDir?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  // Console fields
  messages?: ConsoleMessage[];
  // Network fields
  requests?: NetworkEntry[];
  patterns?: string[];
  // Error fields
  errors?: PageError[];
  // Metrics fields
  metrics?: MetricsData;
  // Accessibility fields
  a11y?: A11yNode;
  // Dialog fields
  dialogs?: DialogEntry[];
  dialogConfig?: { autoAccept: boolean; autoDismiss: boolean };
  // Cookie fields
  cookies?: Array<{ name: string; value: string; domain: string; path: string }>;
  // Storage fields
  storage?: Record<string, string>;
  // Viewport fields
  viewport?: { width: number; height: number };
  // Selected values
  selected?: string[];
  // Import fields
  imported?: number;
  source?: string;
  domains?: string[];
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type CommandResponse = SuccessResponse | ErrorResponse;
