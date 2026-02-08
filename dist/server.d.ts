import type { BrowserOptions } from './types.js';
export interface ServerOptions extends BrowserOptions {
    port?: number;
}
export declare class BrowserServer {
    private browser;
    private app;
    private server;
    private port;
    constructor(options?: ServerOptions);
    private setupMiddleware;
    private setupRoutes;
    private handleCommand;
    start(): Promise<void>;
    stop(): Promise<void>;
    getPort(): number;
    getApp(): import("express-serve-static-core").Express;
}
export declare function startServer(options?: ServerOptions): Promise<BrowserServer>;
//# sourceMappingURL=server.d.ts.map