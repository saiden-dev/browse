import { type BrowserContext, type Page } from 'playwright';
import type { A11yNode, BrowserCommand, BrowserOptions, CommandResponse, ConsoleMessage, DialogEntry, ElementInfo, MetricsData, NetworkEntry, PageError } from './types.js';
export declare class ClaudeBrowser {
    private browser;
    private context;
    private page;
    private options;
    private consoleMessages;
    private networkEntries;
    private pageErrors;
    private dialogHistory;
    private dialogConfig;
    private interceptPatterns;
    constructor(options?: BrowserOptions);
    launch(): Promise<void>;
    private enterFullscreen;
    private previewAction;
    private setupErrorListener;
    private setupDialogListener;
    private setupConsoleListener;
    private setupNetworkListener;
    close(): Promise<void>;
    private ensurePage;
    /** Get the current page instance (for advanced usage) */
    getPage(): Page | null;
    /** Get the browser context (for advanced usage like cookies) */
    getContext(): BrowserContext | null;
    goto(url: string): Promise<{
        url: string;
        title: string;
    }>;
    click(selector: string): Promise<{
        url: string;
    }>;
    type(selector: string, text: string): Promise<void>;
    query(selector: string): Promise<ElementInfo[]>;
    screenshot(path?: string, fullPage?: boolean): Promise<{
        path: string;
        buffer?: Buffer;
    }>;
    getUrl(): Promise<{
        url: string;
        title: string;
    }>;
    getHtml(full?: boolean): Promise<string>;
    back(): Promise<{
        url: string;
    }>;
    forward(): Promise<{
        url: string;
    }>;
    reload(): Promise<{
        url: string;
    }>;
    wait(ms?: number): Promise<void>;
    newPage(): Promise<void>;
    eval(script: string): Promise<unknown>;
    getConsole(level?: string, clear?: boolean): ConsoleMessage[];
    clearConsole(): void;
    getNetwork(filter?: string, clear?: boolean): NetworkEntry[];
    clearNetwork(): void;
    getErrors(clear?: boolean): PageError[];
    clearErrors(): void;
    getMetrics(includeResources?: boolean): Promise<MetricsData>;
    getA11y(selector?: string): Promise<A11yNode | null>;
    getDialogs(): DialogEntry[];
    clearDialogs(): void;
    setDialogConfig(config: {
        autoAccept?: boolean;
        autoDismiss?: boolean;
        text?: string;
    }): void;
    getDialogConfig(): {
        autoAccept: boolean;
        autoDismiss: boolean;
    };
    addIntercept(pattern: string, action: 'block' | 'mock', response?: {
        status?: number;
        body?: string;
        contentType?: string;
    }): Promise<void>;
    private handleIntercept;
    clearIntercepts(): Promise<void>;
    getInterceptPatterns(): string[];
    getCookies(name?: string): Promise<Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
    }>>;
    setCookie(name: string, value: string, url?: string): Promise<void>;
    deleteCookie(name: string): Promise<void>;
    clearCookies(): Promise<void>;
    getStorage(type: 'local' | 'session', key?: string): Promise<Record<string, string>>;
    setStorage(type: 'local' | 'session', key: string, value: string): Promise<void>;
    deleteStorage(type: 'local' | 'session', key: string): Promise<void>;
    clearStorage(type: 'local' | 'session'): Promise<void>;
    hover(selector: string): Promise<void>;
    select(selector: string, value: string | string[]): Promise<string[]>;
    keys(keys: string): Promise<void>;
    upload(selector: string, files: string[]): Promise<void>;
    scroll(selector?: string, x?: number, y?: number): Promise<void>;
    setViewport(width: number, height: number): Promise<{
        width: number;
        height: number;
    }>;
    emulate(device: string): Promise<{
        width: number;
        height: number;
    }>;
    private handleDialogCommand;
    private handleCookiesCommand;
    private handleStorageCommand;
    executeCommand(cmd: BrowserCommand): Promise<CommandResponse>;
}
//# sourceMappingURL=browser.d.ts.map