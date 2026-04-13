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
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
/**
 * Finalize a partial profile into a full FirefoxProfile if valid
 */
function finalizeProfile(partial) {
    if (!partial?.name || !partial?.path)
        return null;
    return {
        name: partial.name,
        path: partial.path,
        isRelative: partial.isRelative ?? true,
        isDefault: partial.isDefault ?? false,
    };
}
/**
 * Apply a key=value line to a partial profile
 */
function applyProfileField(profile, key, value) {
    if (key === 'Name')
        profile.name = value;
    else if (key === 'Path')
        profile.path = value;
    else if (key === 'IsRelative')
        profile.isRelative = value === '1';
    else if (key === 'Default')
        profile.isDefault = value === '1';
}
/**
 * Process a single line of profiles.ini, updating state
 */
function processIniLine(line, current, profiles) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[Profile') || trimmed.startsWith('[Install')) {
        const finalized = finalizeProfile(current);
        if (finalized)
            profiles.push(finalized);
        return trimmed.startsWith('[Profile') ? {} : null;
    }
    if (current) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1)
            applyProfileField(current, trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
    }
    return current;
}
/**
 * Parse Firefox profiles.ini to find available profiles
 */
function parseProfilesIni(iniPath) {
    if (!existsSync(iniPath))
        return [];
    const lines = readFileSync(iniPath, 'utf-8').split('\n');
    const profiles = [];
    let current = null;
    for (const line of lines) {
        current = processIniLine(line, current, profiles);
    }
    const last = finalizeProfile(current);
    if (last)
        profiles.push(last);
    return profiles;
}
/**
 * Get the Firefox profiles root directory for the current platform
 */
function getFirefoxRoot() {
    const home = homedir();
    switch (platform()) {
        case 'darwin':
            return join(home, 'Library/Application Support/Firefox');
        case 'linux':
            return join(home, '.mozilla/firefox');
        case 'win32':
            return join(process.env.APPDATA || join(home, 'AppData/Roaming'), 'Mozilla/Firefox');
        default:
            throw new Error(`Unsupported platform: ${platform()}`);
    }
}
/**
 * List available Firefox profiles
 */
export function listFirefoxProfiles() {
    const root = getFirefoxRoot();
    const iniPath = join(root, 'profiles.ini');
    return parseProfilesIni(iniPath);
}
/**
 * Resolve a FirefoxProfile to its absolute path
 */
function profileToAbsolutePath(root, p) {
    return p.isRelative ? join(root, p.path) : p.path;
}
/**
 * Resolve the full path to a Firefox profile directory
 */
function resolveProfilePath(profile) {
    const root = getFirefoxRoot();
    const profiles = listFirefoxProfiles();
    if (!profile) {
        const defaultProfile = profiles.find((p) => p.isDefault) || profiles[0];
        if (!defaultProfile)
            throw new Error('No Firefox profiles found. Is Firefox installed?');
        return profileToAbsolutePath(root, defaultProfile);
    }
    // Try exact match by name or path
    const match = profiles.find((p) => p.name === profile || p.path === profile);
    if (match)
        return profileToAbsolutePath(root, match);
    // Try as direct path fragment in Profiles dir
    const directPath = join(root, 'Profiles', profile);
    if (existsSync(directPath))
        return directPath;
    // Try as absolute path
    if (existsSync(profile))
        return profile;
    const available = profiles.map((p) => p.name).join(', ');
    throw new Error(`Firefox profile not found: "${profile}". Available: ${available}`);
}
/**
 * Safely copy the Firefox cookies database to a temp directory.
 * Copies cookies.sqlite + WAL + SHM files to avoid lock conflicts.
 */
function copyDatabaseSafely(dbPath) {
    if (!existsSync(dbPath)) {
        throw new Error(`Firefox cookies database not found at: ${dbPath}\nMake sure Firefox has been used at least once.`);
    }
    const tmpDir = mkdtempSync(join(tmpdir(), 'browse-fx-'));
    const dbName = 'cookies.sqlite';
    try {
        // Copy main database
        copyFileSync(dbPath, join(tmpDir, dbName));
        // Copy WAL and SHM if they exist (needed for up-to-date reads)
        for (const ext of ['-wal', '-shm']) {
            const src = `${dbPath}${ext}`;
            if (existsSync(src)) {
                copyFileSync(src, join(tmpDir, `${dbName}${ext}`));
            }
        }
        return { tmpDir, tmpDbPath: join(tmpDir, dbName) };
    }
    catch (err) {
        // Clean up on failure
        rmSync(tmpDir, { recursive: true, force: true });
        throw err;
    }
}
/**
 * Convert Firefox sameSite integer to string
 * 0 = None, 1 = Lax, 2 = Strict
 */
function sameSiteToString(value) {
    switch (value) {
        case 2:
            return 'Strict';
        case 1:
            return 'Lax';
        default:
            return 'None';
    }
}
/**
 * Import cookies from Firefox's cookies.sqlite database
 */
export function importFirefoxCookies(options) {
    const profilePath = resolveProfilePath(options?.profile);
    const dbPath = join(profilePath, 'cookies.sqlite');
    const { tmpDir, tmpDbPath } = copyDatabaseSafely(dbPath);
    try {
        const db = new DatabaseSync(tmpDbPath, { readOnly: true });
        let query = 'SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies';
        const params = [];
        if (options?.domain) {
            const domain = options.domain.toLowerCase();
            query += ' WHERE LOWER(host) = ? OR LOWER(host) = ? OR LOWER(host) LIKE ?';
            params.push(domain, `.${domain}`, `%.${domain}`);
        }
        const stmt = db.prepare(query);
        const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
        db.close();
        return rows.map((row) => ({
            name: row.name,
            value: row.value,
            domain: row.host,
            path: row.path,
            expires: row.expiry,
            secure: row.isSecure === 1,
            httpOnly: row.isHttpOnly === 1,
            sameSite: sameSiteToString(row.sameSite),
        }));
    }
    finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}
/**
 * Convert FirefoxCookie to Playwright cookie format
 */
export function toPlaywrightCookie(cookie) {
    // Firefox uses 0 for session cookies; Playwright requires -1 or positive unix timestamp (seconds).
    // Some Firefox cookies store expiry in milliseconds instead of seconds — detect and convert.
    // Any expiry > year 2100 in seconds (4102444800) is likely milliseconds.
    let expires = cookie.expires;
    if (expires > 4102444800) {
        expires = Math.floor(expires / 1000);
    }
    if (expires <= 0) {
        expires = -1;
    }
    // Normalize domain: Firefox sometimes stores ".www.example.com" which Playwright
    // won't match for "www.example.com". Strip ".www." prefix to ".example.com".
    let domain = cookie.domain;
    if (domain.startsWith('.www.')) {
        domain = domain.slice(4); // ".www.example.com" -> ".example.com"
    }
    return {
        name: cookie.name,
        value: cookie.value,
        domain,
        path: cookie.path,
        expires,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
    };
}
//# sourceMappingURL=firefox.js.map