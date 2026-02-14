/**
 * Safari Cookies.binarycookies parser
 *
 * Format specification: https://github.com/libyal/dtformats/blob/main/documentation/Safari%20Cookies.asciidoc
 *
 * File structure:
 * - Header: "cook" magic + page count + page sizes array
 * - Pages: Each contains cookie records
 * - Footer: 8 bytes (checksum)
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SafariCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number; // Unix timestamp (seconds)
  secure: boolean;
  httpOnly: boolean;
}

// Cocoa epoch (Jan 1, 2001) to Unix epoch (Jan 1, 1970) offset in seconds
const COCOA_EPOCH_OFFSET = 978307200;

/**
 * Convert Cocoa timestamp (seconds since Jan 1, 2001) to Unix timestamp
 */
function cocoaToUnix(cocoaTime: number): number {
  return Math.floor(cocoaTime + COCOA_EPOCH_OFFSET);
}

/**
 * Read a null-terminated string from buffer at offset
 */
function readCString(buffer: Buffer, offset: number): string {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end++;
  }
  return buffer.subarray(offset, end).toString('utf8');
}

/**
 * Parse a single cookie record from a page
 */
function parseCookieRecord(buffer: Buffer, recordOffset: number): SafariCookie {
  // Cookie record structure (little-endian):
  // 0-3: Record size
  // 4-7: Unknown
  // 8-11: Flags (1=secure, 4=httpOnly)
  // 12-15: Unknown
  // 16-19: URL/domain offset (relative to record start)
  // 20-23: Name offset
  // 24-27: Path offset
  // 28-31: Value offset
  // 32-39: Unknown (end marker)
  // 40-47: Expiration (64-bit float, Cocoa timestamp)
  // 48-55: Creation (64-bit float, Cocoa timestamp)
  // 56+: String data

  const flags = buffer.readUInt32LE(recordOffset + 8);
  const domainOffset = buffer.readUInt32LE(recordOffset + 16);
  const nameOffset = buffer.readUInt32LE(recordOffset + 20);
  const pathOffset = buffer.readUInt32LE(recordOffset + 24);
  const valueOffset = buffer.readUInt32LE(recordOffset + 28);
  const expiration = buffer.readDoubleLE(recordOffset + 40);

  return {
    name: readCString(buffer, recordOffset + nameOffset),
    value: readCString(buffer, recordOffset + valueOffset),
    domain: readCString(buffer, recordOffset + domainOffset),
    path: readCString(buffer, recordOffset + pathOffset),
    expires: cocoaToUnix(expiration),
    secure: (flags & 0x01) !== 0,
    httpOnly: (flags & 0x04) !== 0,
  };
}

/**
 * Parse a page of cookies
 */
function parsePage(buffer: Buffer): SafariCookie[] {
  const cookies: SafariCookie[] = [];

  // Page header:
  // 0-3: Page signature (0x00000100 as big-endian)
  // 4-7: Number of cookies (little-endian)
  // 8+: Cookie record offsets array (little-endian)

  const signature = buffer.readUInt32BE(0);
  if (signature !== 0x00000100) {
    // Invalid page signature, skip
    return cookies;
  }

  const cookieCount = buffer.readUInt32LE(4);

  for (let i = 0; i < cookieCount; i++) {
    const recordOffset = buffer.readUInt32LE(8 + i * 4);
    try {
      const cookie = parseCookieRecord(buffer, recordOffset);
      cookies.push(cookie);
    } catch {
      // Skip malformed cookie records
    }
  }

  return cookies;
}

/**
 * Parse a Safari Cookies.binarycookies file
 */
export async function parseBinaryCookies(filePath: string): Promise<SafariCookie[]> {
  const buffer = await readFile(filePath);
  const cookies: SafariCookie[] = [];

  // File header (big-endian):
  // 0-3: Magic "cook"
  // 4-7: Number of pages
  // 8+: Page sizes array (4 bytes each)

  const magic = buffer.subarray(0, 4).toString('ascii');
  if (magic !== 'cook') {
    throw new Error(`Invalid binarycookies file: expected "cook" magic, got "${magic}"`);
  }

  const pageCount = buffer.readUInt32BE(4);
  const pageSizes: number[] = [];

  for (let i = 0; i < pageCount; i++) {
    pageSizes.push(buffer.readUInt32BE(8 + i * 4));
  }

  // Calculate where pages start (after header)
  let pageOffset = 8 + pageCount * 4;

  // Parse each page
  for (let i = 0; i < pageCount; i++) {
    const pageSize = pageSizes[i];
    const pageBuffer = buffer.subarray(pageOffset, pageOffset + pageSize);
    const pageCookies = parsePage(pageBuffer);
    cookies.push(...pageCookies);
    pageOffset += pageSize;
  }

  return cookies;
}

/**
 * Get the default Safari cookies file path
 */
export function getSafariCookiesPath(profile?: string): string {
  const home = homedir();

  if (profile) {
    // Profile-specific WebKit data store
    return join(
      home,
      'Library/Containers/com.apple.Safari/Data/Library/WebKit/WebsiteDataStore',
      profile,
      'Cookies/Cookies.binarycookies'
    );
  }

  // Default Safari cookies location
  return join(
    home,
    'Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies'
  );
}

/**
 * List available Safari profiles (WebKit data stores)
 */
export async function listSafariProfiles(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const home = homedir();
  const webkitPath = join(
    home,
    'Library/Containers/com.apple.Safari/Data/Library/WebKit/WebsiteDataStore'
  );

  try {
    const entries = await readdir(webkitPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => {
        // Check if this profile has a cookies file
        const cookiePath = join(webkitPath, name, 'Cookies/Cookies.binarycookies');
        return existsSync(cookiePath);
      });
  } catch {
    return [];
  }
}

/**
 * Import Safari cookies, optionally filtered by domain
 */
export async function importSafariCookies(options?: {
  profile?: string;
  domain?: string;
}): Promise<SafariCookie[]> {
  const cookiesPath = getSafariCookiesPath(options?.profile);

  if (!existsSync(cookiesPath)) {
    throw new Error(
      `Safari cookies file not found at: ${cookiesPath}\nMake sure Safari has been used and Full Disk Access is granted to your terminal.`
    );
  }

  let cookies = await parseBinaryCookies(cookiesPath);

  // Filter by domain if specified
  if (options?.domain) {
    const domainFilter = options.domain.toLowerCase();
    cookies = cookies.filter((c) => {
      const cookieDomain = c.domain.toLowerCase();
      // Match exact domain or subdomain (e.g., ".example.com" matches "sub.example.com")
      return (
        cookieDomain === domainFilter ||
        cookieDomain === `.${domainFilter}` ||
        cookieDomain.endsWith(`.${domainFilter}`)
      );
    });
  }

  return cookies;
}

/**
 * Convert SafariCookie to Playwright cookie format
 */
export function toPlaywrightCookie(cookie: SafariCookie): {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
} {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.secure ? 'None' : 'Lax', // Best guess since Safari doesn't store this
  };
}
