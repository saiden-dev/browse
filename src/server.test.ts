import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrowserServer } from './server.js';

// Mock the browser module
vi.mock('./browser.js', () => ({
  ClaudeBrowser: class MockClaudeBrowser {
    async launch() {}
    async close() {}
    async executeCommand(cmd: { cmd: string; url?: string; path?: string }) {
      switch (cmd.cmd) {
        case 'goto':
          return { ok: true, url: cmd.url, title: 'Test Page' };
        case 'click':
          return { ok: true, url: '/clicked' };
        case 'type':
          return { ok: true };
        case 'query':
          return { ok: true, count: 2, elements: [] };
        case 'url':
          return { ok: true, url: 'https://example.com', title: 'Example' };
        case 'html':
          return { ok: true, html: '<html></html>' };
        case 'back':
          return { ok: true, url: '/previous' };
        case 'forward':
          return { ok: true, url: '/next' };
        case 'reload':
          return { ok: true, url: '/current' };
        case 'wait':
          return { ok: true };
        case 'screenshot':
          return { ok: true, path: cmd.path || 'screenshot.png' };
        case 'eval':
          return { ok: true, result: 2 };
        case 'newpage':
          return { ok: true };
        case 'error':
          throw new Error('Test error');
        default:
          return { ok: true };
      }
    }
  },
}));

describe('BrowserServer', () => {
  let server: BrowserServer;

  beforeAll(async () => {
    server = new BrowserServer({ port: 0 }); // Use port 0 to get random available port
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('constructor', () => {
    it('creates server with default port', () => {
      const s = new BrowserServer();
      expect(s.getPort()).toBe(13373);
    });

    it('creates server with custom port', () => {
      const s = new BrowserServer({ port: 8080 });
      expect(s.getPort()).toBe(8080);
    });
  });

  describe('POST /', () => {
    it('handles goto command', async () => {
      const app = server.getApp();
      const res = await request(app)
        .post('/')
        .send({ cmd: 'goto', url: 'https://example.com' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.url).toBe('https://example.com');
      expect(res.body.title).toBe('Test Page');
    });

    it('handles click command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'click', selector: '#btn' }).expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.url).toBe('/clicked');
    });

    it('handles type command', async () => {
      const app = server.getApp();
      const res = await request(app)
        .post('/')
        .send({ cmd: 'type', selector: '#input', text: 'hello' })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('handles query command', async () => {
      const app = server.getApp();
      const res = await request(app)
        .post('/')
        .send({ cmd: 'query', selector: '.items' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.count).toBe(2);
    });

    it('handles url command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'url' }).expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.url).toBe('https://example.com');
    });

    it('handles html command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'html' }).expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.html).toBe('<html></html>');
    });

    it('handles JSON string body', async () => {
      const app = server.getApp();
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify({ cmd: 'url' }))
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('handles back command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'back' }).expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles forward command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'forward' }).expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles reload command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'reload' }).expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles wait command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'wait', ms: 100 }).expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles screenshot command', async () => {
      const app = server.getApp();
      const res = await request(app)
        .post('/')
        .send({ cmd: 'screenshot', path: 'test.png' })
        .expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles eval command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'eval', script: '1+1' }).expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles newpage command', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'newpage' }).expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('handles errors and returns 500', async () => {
      const app = server.getApp();
      const res = await request(app).post('/').send({ cmd: 'error' }).expect(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Test error');
    });
  });
});
