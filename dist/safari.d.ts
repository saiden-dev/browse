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
export interface SafariCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    secure: boolean;
    httpOnly: boolean;
}
/**
 * Parse a Safari Cookies.binarycookies file
 */
export declare function parseBinaryCookies(filePath: string): Promise<SafariCookie[]>;
/**
 * Get the default Safari cookies file path
 */
export declare function getSafariCookiesPath(profile?: string): string;
/**
 * List available Safari profiles (WebKit data stores)
 */
export declare function listSafariProfiles(): Promise<string[]>;
/**
 * Import Safari cookies, optionally filtered by domain
 */
export declare function importSafariCookies(options?: {
    profile?: string;
    domain?: string;
}): Promise<SafariCookie[]>;
/**
 * Convert SafariCookie to Playwright cookie format
 */
export declare function toPlaywrightCookie(cookie: SafariCookie): {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
};
//# sourceMappingURL=safari.d.ts.map