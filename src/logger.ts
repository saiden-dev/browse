import chalk from 'chalk';
import logSymbols from 'log-symbols';

// Icons for commands
export const icons: Record<string, string> = {
  goto: '→',
  click: '◉',
  type: '⌨',
  query: '?',
  screenshot: '📷',
  url: '🔗',
  html: '<>',
  back: '←',
  forward: '→',
  reload: '↻',
  wait: '⏳',
  newpage: '+',
  close: '✕',
  eval: '⚡',
};

// Colors for command types
export const cmdColor: Record<string, (s: string) => string> = {
  goto: chalk.cyan,
  click: chalk.yellow,
  type: chalk.magenta,
  query: chalk.blue,
  screenshot: chalk.green,
  url: chalk.cyan,
  html: chalk.blue,
  back: chalk.yellow,
  forward: chalk.yellow,
  reload: chalk.yellow,
  wait: chalk.gray,
  newpage: chalk.green,
  close: chalk.red,
  eval: chalk.magenta,
};

export function ts(): string {
  return chalk.gray(`[${new Date().toISOString()}]`);
}

export function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

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

export function getCommandDetail(cmd: CommandLike): string | undefined {
  switch (cmd.cmd) {
    case 'goto':
      return chalk.white(cmd.url);
    case 'click':
    case 'query':
      return chalk.white(cmd.selector);
    case 'type':
      return `${chalk.white(cmd.selector)} ${chalk.dim(`="${cmd.text}"`)}`;
    case 'screenshot':
      return chalk.dim(cmd.path || 'screenshot.png');
    case 'html':
      return cmd.full ? chalk.dim('(full)') : undefined;
    case 'wait':
      return chalk.dim(`${cmd.ms || 1000}ms`);
    case 'eval':
      return chalk.dim(truncate(cmd.script || '', 50));
    default:
      return undefined;
  }
}

export function formatCommand(cmd: CommandLike): string {
  const color = cmdColor[cmd.cmd] || chalk.white;
  const icon = icons[cmd.cmd] || '•';
  const detail = getCommandDetail(cmd);
  const suffix = detail ? ` ${detail}` : '';
  return `${ts()} ${chalk.bold(color(icon))} ${color(cmd.cmd.toUpperCase())}${suffix}`;
}

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

const resultFormatters: Record<string, (r: ResultLike) => string | undefined> = {
  goto: (r) => r.title,
  click: (r) => (r.url ? `→ ${r.url}` : undefined),
  query: (r) => (r.count !== undefined ? `Found ${r.count} element(s)` : undefined),
  screenshot: (r) => (r.path ? `Saved to ${r.path}` : undefined),
  url: (r) => r.url,
  html: (r) => (r.html !== undefined ? `${r.html.length} chars` : undefined),
  eval: (r) => (r.result !== undefined ? truncate(JSON.stringify(r.result), 80) : undefined),
};

export function formatResult(cmd: CommandLike, result: ResultLike): string {
  if (!result.ok) {
    return `${ts()}   ${logSymbols.error} ${chalk.red(result.error)}`;
  }
  const formatter = resultFormatters[cmd.cmd];
  const msg = formatter ? formatter(result) : undefined;
  const suffix = msg ? ` ${chalk.dim(msg)}` : '';
  return `${ts()}   ${logSymbols.success}${suffix}`;
}

export type LogFn = (msg: string) => void;

export function createLogger(logFn: LogFn = console.log) {
  return {
    command(cmd: CommandLike): void {
      logFn(formatCommand(cmd));
    },
    result(cmd: CommandLike, result: ResultLike): void {
      logFn(formatResult(cmd, result));
    },
  };
}

// Default logger to stdout
export const logger = createLogger();

// Logger to stderr (for MCP)
export const stderrLogger = createLogger((msg) => process.stderr.write(`${msg}\n`));
