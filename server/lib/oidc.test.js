import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import { verifyIdToken } from './oidc.js';

const ISSUER = 'https://issuer.example.com';
const CLIENT_ID = 'gymapp-client';
const DISCOVERY = { issuer: ISSUER, jwks_uri: 'https://issuer.example.com/jwks' };

let privateKey;
let resolveJwks;

async function signToken(claims = {}, { expSeconds = 3600 } = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(ISSUER)
        .setAudience(CLIENT_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + expSeconds)
        .setSubject(claims.sub ?? 'user-123')
        .sign(privateKey);
}

beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';
    const localJwks = createLocalJWKSet({ keys: [publicJwk] });
    // verifyIdToken expects a resolver keyed by jwks_uri; ignore the uri and
    // always return our in-memory key set.
    resolveJwks = () => localJwks;
});

describe('verifyIdToken', () => {
    it('accepts a valid token and returns its claims', async () => {
        const token = await signToken({ sub: 'abc', email: 'a@b.com' });
        const payload = await verifyIdToken(token, DISCOVERY, CLIENT_ID, resolveJwks);
        expect(payload).not.toBeNull();
        expect(payload.sub).toBe('abc');
        expect(payload.email).toBe('a@b.com');
        expect(payload.iss).toBe(ISSUER);
    });

    it('rejects a token with the wrong audience', async () => {
        const token = await signToken();
        const payload = await verifyIdToken(token, DISCOVERY, 'different-client', resolveJwks);
        expect(payload).toBeNull();
    });

    it('rejects a token with the wrong issuer', async () => {
        const token = await signToken();
        const payload = await verifyIdToken(
            token,
            { issuer: 'https://evil.example.com', jwks_uri: DISCOVERY.jwks_uri },
            CLIENT_ID,
            resolveJwks
        );
        expect(payload).toBeNull();
    });

    it('rejects an expired token', async () => {
        const token = await signToken({}, { expSeconds: -10 });
        const payload = await verifyIdToken(token, DISCOVERY, CLIENT_ID, resolveJwks);
        expect(payload).toBeNull();
    });

    it('rejects a token signed by an unknown key', async () => {
        const otherPair = await generateKeyPair('RS256');
        const now = Math.floor(Date.now() / 1000);
        const forged = await new SignJWT({ sub: 'intruder' })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience(CLIENT_ID)
            .setIssuedAt(now)
            .setExpirationTime(now + 3600)
            .sign(otherPair.privateKey);
        const payload = await verifyIdToken(forged, DISCOVERY, CLIENT_ID, resolveJwks);
        expect(payload).toBeNull();
    });

    it('returns null for missing inputs', async () => {
        expect(await verifyIdToken('', DISCOVERY, CLIENT_ID, resolveJwks)).toBeNull();
        expect(await verifyIdToken('x', { issuer: ISSUER }, CLIENT_ID, resolveJwks)).toBeNull();
        expect(await verifyIdToken('x', { jwks_uri: DISCOVERY.jwks_uri }, CLIENT_ID, resolveJwks)).toBeNull();
    });
});
