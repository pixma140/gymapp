import { createRemoteJWKSet, jwtVerify } from 'jose';

// Cache one remote JWKS resolver per jwks_uri. jose handles key rotation and
// caching of the actual keys internally.
const jwksCache = new Map();

export function getJwks(jwksUri) {
    let jwks = jwksCache.get(jwksUri);
    if (!jwks) {
        jwks = createRemoteJWKSet(new URL(jwksUri));
        jwksCache.set(jwksUri, jwks);
    }
    return jwks;
}

/**
 * Verifies an OIDC id_token: signature against the issuer's JWKS, plus the
 * `iss`, `aud`, and `exp` claims. Returns the validated claim set or null.
 *
 * `resolveJwks` is injectable for testing; defaults to the cached resolver.
 */
export async function verifyIdToken(idToken, discovery, clientId, resolveJwks = getJwks) {
    if (!idToken || !discovery?.jwks_uri || !discovery?.issuer) {
        return null;
    }

    try {
        const { payload } = await jwtVerify(idToken, resolveJwks(discovery.jwks_uri), {
            issuer: discovery.issuer,
            audience: clientId
        });
        return payload;
    } catch {
        return null;
    }
}
