import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, parseCookies, base64UrlEncode } from './crypto.js';

describe('password hashing', () => {
    it('produces a salt:hash pair and verifies the correct password', () => {
        const password = randomUUID();
        const stored = hashPassword(password);
        expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
        expect(verifyPassword(password, stored)).toBe(true);
    });

    it('uses a unique salt so equal passwords hash differently', () => {
        const password = randomUUID();
        const a = hashPassword(password);
        const b = hashPassword(password);
        expect(a).not.toBe(b);
        expect(verifyPassword(password, a)).toBe(true);
        expect(verifyPassword(password, b)).toBe(true);
    });

    it('rejects an incorrect password', () => {
        const stored = hashPassword(randomUUID());
        expect(verifyPassword(randomUUID(), stored)).toBe(false);
    });

    it('rejects a tampered hash without throwing', () => {
        const password = randomUUID();
        const stored = hashPassword(password);
        const [salt] = stored.split(':');
        const tampered = `${salt}:${'0'.repeat(128)}`;
        expect(verifyPassword(password, tampered)).toBe(false);
    });

    it('returns false for malformed or missing hashes', () => {
        const password = randomUUID();
        expect(verifyPassword(password, '')).toBe(false);
        expect(verifyPassword(password, null)).toBe(false);
        expect(verifyPassword(password, 'no-colon')).toBe(false);
        expect(verifyPassword(password, 'salt:')).toBe(false);
    });
});

describe('parseCookies', () => {
    it('returns an empty object for missing headers', () => {
        expect(parseCookies(undefined)).toEqual({});
        expect(parseCookies('')).toEqual({});
    });

    it('parses multiple cookies and decodes values', () => {
        const cookies = parseCookies('gymapp_session=abc%20123; theme=dark');
        expect(cookies.gymapp_session).toBe('abc 123');
        expect(cookies.theme).toBe('dark');
    });

    it('handles values containing equals signs', () => {
        const cookies = parseCookies('token=a=b=c');
        expect(cookies.token).toBe('a=b=c');
    });
});

describe('base64UrlEncode', () => {
    it('produces URL-safe base64 without padding', () => {
        const encoded = base64UrlEncode(Buffer.from([251, 255, 191, 0]));
        expect(encoded).not.toMatch(/[+/=]/);
    });
});
