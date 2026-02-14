import { describe, expect, it } from 'vitest';
import { type SafariCookie, toPlaywrightCookie } from './safari.js';

describe('safari', () => {
  describe('toPlaywrightCookie', () => {
    it('should convert SafariCookie to Playwright format', () => {
      const safariCookie: SafariCookie = {
        name: 'session_id',
        value: 'abc123',
        domain: '.example.com',
        path: '/',
        expires: 1735689600, // 2025-01-01
        secure: true,
        httpOnly: true,
      };

      const result = toPlaywrightCookie(safariCookie);

      expect(result.name).toBe('session_id');
      expect(result.value).toBe('abc123');
      expect(result.domain).toBe('.example.com');
      expect(result.path).toBe('/');
      expect(result.expires).toBe(1735689600);
      expect(result.secure).toBe(true);
      expect(result.httpOnly).toBe(true);
      expect(result.sameSite).toBe('None'); // Secure cookies get SameSite=None
    });

    it('should set SameSite to Lax for non-secure cookies', () => {
      const safariCookie: SafariCookie = {
        name: 'tracking',
        value: 'xyz',
        domain: 'example.com',
        path: '/',
        expires: 1735689600,
        secure: false,
        httpOnly: false,
      };

      const result = toPlaywrightCookie(safariCookie);

      expect(result.secure).toBe(false);
      expect(result.sameSite).toBe('Lax');
    });
  });
});
