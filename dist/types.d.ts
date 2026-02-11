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
export type BrowserCommand = GotoCommand | ClickCommand | TypeCommand | QueryCommand | ScreenshotCommand | UrlCommand | HtmlCommand | BackCommand | ForwardCommand | ReloadCommand | WaitCommand | NewPageCommand | CloseCommand | EvalCommand | FaviconCommand | ConvertCommand | ResizeCommand | CropCommand | CompressCommand | ThumbnailCommand | ConsoleCommand;
export interface SuccessResponse {
    ok: true;
    url?: string;
    title?: string;
    path?: string;
    html?: string;
    count?: number;
    elements?: ElementInfo[];
    result?: unknown;
    files?: string[];
    outputDir?: string;
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    messages?: ConsoleMessage[];
}
export interface ErrorResponse {
    ok: false;
    error: string;
}
export type CommandResponse = SuccessResponse | ErrorResponse;
//# sourceMappingURL=types.d.ts.map