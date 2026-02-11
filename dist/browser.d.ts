import { type BrowserContext, type Page } from 'playwright';
import type { BrowserCommand, BrowserOptions, CommandResponse, ConsoleMessage, ElementInfo, NetworkEntry } from './types.js';
export declare class ClaudeBrowser {
    private browser;
    private context;
    private page;
    private options;
    private consoleMessages;
    private networkEntries;
    private interceptPatterns;
    constructor(options?: BrowserOptions);
    launch(): Promise<void>;
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
    addIntercept(pattern: string, action: 'block' | 'mock', response?: {
        status?: number;
        body?: string;
        contentType?: string;
    }): Promise<void>;
    clearIntercepts(): Promise<void>;
    getInterceptPatterns(): string[];
    executeCommand(cmd: BrowserCommand): Promise<CommandResponse>;
}
//# sourceMappingURL=browser.d.ts.map