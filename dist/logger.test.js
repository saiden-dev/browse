import { describe, expect, it, vi } from 'vitest';
import { createLogger, formatCommand, formatResult, getCommandDetail, icons, truncate, } from './logger.js';
describe('truncate', () => {
    it('returns string unchanged if shorter than max', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });
    it('truncates and adds ellipsis if longer than max', () => {
        expect(truncate('hello world', 5)).toBe('hello...');
    });
    it('handles exact length', () => {
        expect(truncate('hello', 5)).toBe('hello');
    });
});
describe('icons', () => {
    it('has icon for each command type', () => {
        expect(icons.goto).toBe('→');
        expect(icons.click).toBe('◉');
        expect(icons.type).toBe('⌨');
        expect(icons.screenshot).toBe('📷');
    });
});
describe('getCommandDetail', () => {
    it('returns url for goto command', () => {
        const result = getCommandDetail({ cmd: 'goto', url: 'https://example.com' });
        expect(result).toContain('https://example.com');
    });
    it('returns selector for click command', () => {
        const result = getCommandDetail({ cmd: 'click', selector: '#btn' });
        expect(result).toContain('#btn');
    });
    it('returns selector and text for type command', () => {
        const result = getCommandDetail({ cmd: 'type', selector: '#input', text: 'hello' });
        expect(result).toContain('#input');
        expect(result).toContain('hello');
    });
    it('returns path for screenshot command', () => {
        const result = getCommandDetail({ cmd: 'screenshot', path: 'test.png' });
        expect(result).toContain('test.png');
    });
    it('returns default path when none provided for screenshot', () => {
        const result = getCommandDetail({ cmd: 'screenshot' });
        expect(result).toContain('screenshot.png');
    });
    it('returns undefined for url command', () => {
        expect(getCommandDetail({ cmd: 'url' })).toBeUndefined();
    });
    it('returns ms for wait command', () => {
        const result = getCommandDetail({ cmd: 'wait', ms: 500 });
        expect(result).toContain('500');
    });
    it('returns default ms for wait command without ms', () => {
        const result = getCommandDetail({ cmd: 'wait' });
        expect(result).toContain('1000');
    });
    it('returns script for eval command', () => {
        const result = getCommandDetail({ cmd: 'eval', script: 'document.title' });
        expect(result).toContain('document.title');
    });
    it('truncates long eval scripts', () => {
        const longScript = 'a'.repeat(100);
        const result = getCommandDetail({ cmd: 'eval', script: longScript });
        expect(result).toContain('...');
    });
    it('returns (full) for html command with full=true', () => {
        const result = getCommandDetail({ cmd: 'html', full: true });
        expect(result).toContain('full');
    });
    it('returns undefined for html command with full=false', () => {
        expect(getCommandDetail({ cmd: 'html', full: false })).toBeUndefined();
    });
    it('returns selector for query command', () => {
        const result = getCommandDetail({ cmd: 'query', selector: '.items' });
        expect(result).toContain('.items');
    });
});
describe('formatCommand', () => {
    it('formats goto command', () => {
        const result = formatCommand({ cmd: 'goto', url: 'https://example.com' });
        expect(result).toContain('GOTO');
        expect(result).toContain('https://example.com');
    });
    it('formats click command', () => {
        const result = formatCommand({ cmd: 'click', selector: '#btn' });
        expect(result).toContain('CLICK');
        expect(result).toContain('#btn');
    });
});
describe('formatResult', () => {
    it('formats error result', () => {
        const result = formatResult({ cmd: 'goto' }, { ok: false, error: 'Failed' });
        expect(result).toContain('Failed');
    });
    it('formats successful goto result with title', () => {
        const result = formatResult({ cmd: 'goto' }, { ok: true, title: 'Example' });
        expect(result).toContain('Example');
    });
    it('formats query result with count', () => {
        const result = formatResult({ cmd: 'query' }, { ok: true, count: 5 });
        expect(result).toContain('5');
    });
    it('formats click result with url', () => {
        const result = formatResult({ cmd: 'click' }, { ok: true, url: '/page' });
        expect(result).toContain('/page');
    });
    it('formats screenshot result with path', () => {
        const result = formatResult({ cmd: 'screenshot' }, { ok: true, path: 'test.png' });
        expect(result).toContain('Saved to test.png');
    });
    it('formats url result', () => {
        const result = formatResult({ cmd: 'url' }, { ok: true, url: 'https://example.com' });
        expect(result).toContain('https://example.com');
    });
    it('formats html result with length', () => {
        const result = formatResult({ cmd: 'html' }, { ok: true, html: '<html></html>' });
        expect(result).toContain('13 chars');
    });
    it('formats eval result', () => {
        const result = formatResult({ cmd: 'eval' }, { ok: true, result: { foo: 'bar' } });
        expect(result).toContain('foo');
        expect(result).toContain('bar');
    });
    it('formats result without formatter', () => {
        const result = formatResult({ cmd: 'wait' }, { ok: true });
        expect(result).toBeDefined();
    });
});
describe('createLogger', () => {
    it('creates logger with custom log function', () => {
        const logs = [];
        const logFn = (msg) => logs.push(msg);
        const logger = createLogger(logFn);
        logger.command({ cmd: 'goto', url: 'https://example.com' });
        expect(logs).toHaveLength(1);
        expect(logs[0]).toContain('GOTO');
        logger.result({ cmd: 'goto' }, { ok: true, title: 'Example' });
        expect(logs).toHaveLength(2);
    });
    it('logs command and result', () => {
        const spy = vi.fn();
        const logger = createLogger(spy);
        logger.command({ cmd: 'click', selector: '#btn' });
        logger.result({ cmd: 'click' }, { ok: true, url: '/page' });
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=logger.test.js.map