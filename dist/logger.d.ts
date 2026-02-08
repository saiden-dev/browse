export declare const icons: Record<string, string>;
export declare const cmdColor: Record<string, (s: string) => string>;
export declare function ts(): string;
export declare function truncate(str: string, max: number): string;
export interface CommandLike {
    cmd: string;
    url?: string;
    selector?: string;
    text?: string;
    path?: string;
    full?: boolean;
    ms?: number;
    script?: string;
}
export declare function getCommandDetail(cmd: CommandLike): string | undefined;
export declare function formatCommand(cmd: CommandLike): string;
export interface ResultLike {
    ok: boolean;
    error?: string;
    title?: string;
    url?: string;
    count?: number;
    path?: string;
    html?: string;
    result?: unknown;
}
export declare function formatResult(cmd: CommandLike, result: ResultLike): string;
export type LogFn = (msg: string) => void;
export declare function createLogger(logFn?: LogFn): {
    command(cmd: CommandLike): void;
    result(cmd: CommandLike, result: ResultLike): void;
};
export declare const logger: {
    command(cmd: CommandLike): void;
    result(cmd: CommandLike, result: ResultLike): void;
};
export declare const stderrLogger: {
    command(cmd: CommandLike): void;
    result(cmd: CommandLike, result: ResultLike): void;
};
//# sourceMappingURL=logger.d.ts.map