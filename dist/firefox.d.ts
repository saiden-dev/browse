/**
 * Firefox cookie importer
 *
 * Reads cookies from Firefox's cookies.sqlite database.
 * Firefox stores cookies as plain unencrypted SQLite — no binary parsing needed.
 *
 * Database schema (moz_cookies table):
 *   id, originAttributes, name, value, host, path, expiry,
 *   lastAccessed, creationTime, isSecure, isHttpOnly,
 *   inBrowserElement, sameSite, rawSameSite, schemeMap
 *
 * Note: expiry is Unix seconds, but lastAccessed/creationTime are microseconds.
 *
 * Firefox holds an exclusive WAL lock while running, so we copy the database
 * files (cookies.sqlite + WAL + SHM) to a temp directory before reading.
 */
export interface FirefoxCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'None' | 'Lax' | 'Strict';
}
interface FirefoxProfile {
    name: string;
    path: string;
    isRelative: boolean;
    isDefault: boolean;
}
/**
 * List available Firefox profiles
 */
export declare function listFirefoxProfiles(): FirefoxProfile[];
/**
 * Import cookies from Firefox's cookies.sqlite database
 */
export declare function importFirefoxCookies(options?: {
    profile?: string;
    domain?: string;
}): FirefoxCookie[];
/**
 * Convert FirefoxCookie to Playwright cookie format
 */
export declare function toPlaywrightCookie(cookie: FirefoxCookie): {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
};
export {};
//# sourceMappingURL=firefox.d.ts.map