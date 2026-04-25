import type { BrowserOptions } from './types.js';
export interface ServerOptions extends BrowserOptions {
    port?: number;
}
export declare class BrowserServer {
    private browser;
    private server;
    private port;
    constructor(options?: ServerOptions);
    private handleRequest;
    start(): Promise<void>;
    stop(): Promise<void>;
    getPort(): number;
}
export declare function startServer(options?: ServerOptions): Promise<BrowserServer>;
//# sourceMappingURL=server.d.ts.map