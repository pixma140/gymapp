import { Router } from 'express';
import crypto from 'node:crypto';
import { base64UrlEncode } from '../lib/crypto.js';
import { RATE_WINDOW_MS } from '../lib/http.js';
import { verifyIdToken } from '../lib/oidc.js';
import { DEFAULT_OIDC_CONFIG } from '../services/oidcSettings.js';

const OIDC_STATE_TTL_MS = 1000 * 60 * 10;

export function createOidcRoutes({ database, accounts, sessions, oidc, enforceRateLimit }) {
    const router = Router();

    router.get('/api/auth/oidc/login', async (req, res) => {
        if (!enforceRateLimit(req, res, 'oidc-login', 30, RATE_WINDOW_MS)) return;

        try {
            const config = await oidc.getConfig();
            if (!oidc.isUsable(config)) return res.redirect('/auth?oidc_error=oidc_disabled');

            const discovery = await oidc.discover(config.issuer);

            const state = base64UrlEncode(crypto.randomBytes(32));
            const nonce = base64UrlEncode(crypto.randomBytes(32));
            const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
            const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

            await database.runSql('DELETE FROM oidc_states WHERE expiresAt < ?', [Date.now()]).catch(() => {});
            await database.runSql(
                'INSERT INTO oidc_states (state, codeVerifier, nonce, expiresAt) VALUES (?, ?, ?, ?)',
                [state, codeVerifier, nonce, Date.now() + OIDC_STATE_TTL_MS]
            );

            const authorizeUrl = new URL(discovery.authorization_endpoint);
            authorizeUrl.searchParams.set('response_type', 'code');
            authorizeUrl.searchParams.set('client_id', config.clientId);
            authorizeUrl.searchParams.set('redirect_uri', oidc.redirectUri(req));
            authorizeUrl.searchParams.set('scope', config.scopes || DEFAULT_OIDC_CONFIG.scopes);
            authorizeUrl.searchParams.set('state', state);
            authorizeUrl.searchParams.set('nonce', nonce);
            authorizeUrl.searchParams.set('code_challenge', codeChallenge);
            authorizeUrl.searchParams.set('code_challenge_method', 'S256');

            res.redirect(authorizeUrl.toString());
        } catch {
            res.redirect('/auth?oidc_error=oidc_failed');
        }
    });

    router.get('/api/auth/oidc/callback', async (req, res) => {
        const failRedirect = code => res.redirect(`/auth?oidc_error=${code}`);

        try {
            const code = String(req.query.code ?? '');
            const state = String(req.query.state ?? '');

            if (req.query.error) return failRedirect('oidc_denied');
            if (!code || !state) return failRedirect('oidc_failed');

            const stateRow = await database.getSql('SELECT state, codeVerifier, nonce, expiresAt FROM oidc_states WHERE state = ?', [state]);
            await database.runSql('DELETE FROM oidc_states WHERE state = ?', [state]).catch(() => {});

            if (!stateRow || stateRow.expiresAt < Date.now()) return failRedirect('oidc_state_invalid');

            const config = await oidc.getConfig();
            if (!oidc.isUsable(config)) return failRedirect('oidc_disabled');

            const discovery = await oidc.discover(config.issuer);

            const tokenResponse = await fetch(discovery.token_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: oidc.redirectUri(req),
                    code_verifier: stateRow.codeVerifier
                }).toString()
            });

            if (!tokenResponse.ok) return failRedirect('oidc_token_failed');

            const tokens = await tokenResponse.json();
            const claims = await verifyIdToken(tokens.id_token, discovery, config.clientId);
            if (!claims || !claims.sub) return failRedirect('oidc_token_failed');

            // The nonce binds the id_token to this specific login attempt and is
            // mandatory: a missing or mismatched nonce is rejected.
            if (claims.nonce !== stateRow.nonce) return failRedirect('oidc_nonce_invalid');

            const user = await accounts.resolveOidc({
                issuer: config.issuer.replace(/\/$/, ''),
                subject: String(claims.sub),
                name: String(claims.name ?? claims.preferred_username ?? claims.email ?? 'User'),
                email: claims.email ? String(claims.email) : null
            });

            await sessions.createSession(user.id, res);
            res.redirect('/');
        } catch {
            failRedirect('oidc_failed');
        }
    });

    return router;
}
