export interface BrowserOptions {
  headless?: boolean;
  width?: number;
  height?: number;
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
  | EvalCommand;

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
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type CommandResponse = SuccessResponse | ErrorResponse;
