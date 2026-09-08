import crypto from 'node:crypto';

// Salted scrypt password hashing. Stored as `salt:derivedKey` (both hex).
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
}

export function verifyPassword(password, passwordHash) {
    const [salt, expected] = String(passwordHash ?? '').split(':');
    if (!salt || !expected) {
        return false;
    }

    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    const candidateBuffer = Buffer.from(candidate, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (candidateBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function parseCookies(rawCookieHeader) {
    if (!rawCookieHeader) {
        return {};
    }

    return rawCookieHeader.split(';').reduce((acc, entry) => {
        const [rawKey, ...rest] = entry.trim().split('=');
        if (!rawKey) {
            return acc;
        }

        acc[rawKey] = decodeURIComponent(rest.join('='));
        return acc;
    }, {});
}

export function base64UrlEncode(buffer) {
    return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
