import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPassword, parseCookies, base64UrlEncode } from './lib/crypto.js';
import { verifyIdToken } from './lib/oidc.js';
import { createAccountService } from './services/accounts.js';
import { createSyncService, readSnapshot } from './services/sync.js';
import { publicServerConfig, readServerConfig } from './config.js';
import { isUuid } from '../shared/commands.js';

function hasExactKeys(value, required, optional = []) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const allowed = new Set([...required, ...optional]);
    return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.has(key));
}

export function createApp({ database, config: serverConfig = readServerConfig(), distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist') }) {
    const { runSql, getSql, allSql } = database;
    const accounts = createAccountService(database);
    const sync = createSyncService(database);
    const SESSION_COOKIE = 'gymapp_session';
    const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
    const COOKIE_SECURE = serverConfig.cookieSecure;
    const OIDC_STATE_TTL_MS = 1000 * 60 * 10;
    const ADMIN_USERNAME = serverConfig.adminUsername;
    const PUBLIC_URL = serverConfig.publicUrl;
    const DIST_DIR = distDir;

    function setSessionCookie(res, sessionId) {
        const secure = COOKIE_SECURE ? '; Secure' : '';
        const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`);
    }

    function clearSessionCookie(res) {
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    }

    async function createSession(userId, res) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + SESSION_TTL_MS;
        await runSql('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)', [sessionId, userId, expiresAt]);
        await runSql('UPDATE users SET lastLoginAt = ? WHERE id = ?', [Date.now(), userId]).catch(() => {});
        setSessionCookie(res, sessionId);
    }

    async function resolveSessionUser(req, sql = database) {
        const cookies = parseCookies(req.headers.cookie);
        const sessionId = cookies[SESSION_COOKIE];
        if (!sessionId) {
            return null;
        }

        const row = await sql.getSql(
            'SELECT users.id, users.username, users.name, users.language, users.theme, users.isAdmin FROM sessions JOIN users ON users.id = sessions.userId WHERE sessions.id = ? AND sessions.expiresAt > ?',
            [sessionId, Date.now()]
        );

        if (!row) {
            await sql.runSql('DELETE FROM sessions WHERE id = ?', [sessionId]).catch(() => {});
            return null;
        }

        return { ...row, isAdmin: Boolean(row.isAdmin) };
    }

    async function getUserCount() {
        const row = await getSql('SELECT COUNT(*) AS count FROM users');
        return row ? Number(row.count) : 0;
    }

    async function getSetting(key) {
        const row = await getSql('SELECT value FROM app_settings WHERE key = ?', [key]);
        return row ? row.value : null;
    }

    async function setSetting(key, value) {
        await runSql(
            'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [key, value]
        );
    }

    const OIDC_SETTING_KEY = 'oidc.config';

    const DEFAULT_OIDC_CONFIG = {
        enabled: false,
        issuer: '',
        scopes: 'openid profile email'
    };

    async function getOidcConfig() {
        const raw = await getSetting(OIDC_SETTING_KEY);
        const stored = raw ? JSON.parse(raw) : {};
        return { ...DEFAULT_OIDC_CONFIG, ...stored, ...serverConfig.oidc };
    }

    async function saveOidcConfig(config) {
        const editable = Object.fromEntries(['enabled', 'issuer', 'scopes']
            .filter(key => !Object.hasOwn(serverConfig.oidc, key)).map(key => [key, config[key]]));
        await setSetting(OIDC_SETTING_KEY, JSON.stringify(editable));
        discoveryCache.clear();
    }

    function publicOidcConfig(config) {
        return {
            enabled: config.enabled, issuer: config.issuer, scopes: config.scopes,
            hasCredentials: Boolean(config.clientId && config.clientSecret),
            environmentManaged: ['enabled', 'issuer', 'scopes'].filter(key => Object.hasOwn(serverConfig.oidc, key)),
        };
    }

    const discoveryCache = new Map();
    const DISCOVERY_TTL_MS = 1000 * 60 * 60;

    async function discoverOidc(issuer) {
        const normalizedIssuer = String(issuer ?? '').replace(/\/$/, '');
        if (!normalizedIssuer) {
            throw new Error('missing_issuer');
        }

        const cached = discoveryCache.get(normalizedIssuer);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.document;
        }

        const response = await fetch(`${normalizedIssuer}/.well-known/openid-configuration`);
        if (!response.ok) {
            throw new Error('discovery_failed');
        }

        const document = await response.json();
        if (!document.authorization_endpoint || !document.token_endpoint || !document.jwks_uri || !document.issuer) {
            throw new Error('invalid_discovery_document');
        }

        discoveryCache.set(normalizedIssuer, { document, expiresAt: Date.now() + DISCOVERY_TTL_MS });
        return document;
    }

    function getPublicBaseUrl(req) {
        if (PUBLIC_URL) {
            return PUBLIC_URL.replace(/\/$/, '');
        }

        const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
        const proto = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');
        const host = req.headers['x-forwarded-host'] ?? req.headers.host;
        return `${proto}://${host}`;
    }

    function getRedirectUri(req) {
        return `${getPublicBaseUrl(req)}/api/auth/oidc/callback`;
    }

    async function requireAdmin(req, res) {
        const user = await resolveSessionUser(req);
        if (!user) {
            res.status(401).json({ ok: false, error: 'unauthorized' });
            return null;
        }

        if (!user.isAdmin) {
            res.status(403).json({ ok: false, error: 'forbidden' });
            return null;
        }

        return user;
    }

    async function bootstrapAdmin() {
        try {
            const installation = await getSql('SELECT initializationMode FROM installation WHERE singleton = 1');
            if (installation?.initializationMode === 'fixtures') return;
            if (ADMIN_USERNAME) {
                const target = await getSql('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [ADMIN_USERNAME]);
                if (target) {
                    await runSql('UPDATE users SET isAdmin = 1 WHERE id = ?', [target.id]);
                    return;
                }
            }

            const existingAdmin = await getSql('SELECT id FROM users WHERE isAdmin = 1 LIMIT 1');
            if (existingAdmin) {
                return;
            }

            const firstUser = await getSql('SELECT id FROM users ORDER BY id ASC LIMIT 1');
            if (firstUser) {
                await runSql('UPDATE users SET isAdmin = 1 WHERE id = ?', [firstUser.id]);
            }
        } catch {
            // best-effort bootstrap; ignore failures
        }
    }

    const app = express();

    // Behind a reverse proxy (the documented deployment), trust the first hop so
    // req.ip reflects the real client for rate limiting.
    app.set('trust proxy', 1);

    app.use(express.json({ limit: '1mb' }));

    // Lightweight in-memory fixed-window rate limiter. Keyed by an arbitrary
    // string (typically IP and/or username). Sufficient for a single-instance
    // self-hosted deployment; swap for a shared store if scaled horizontally.
    const rateLimitBuckets = new Map();

    function rateLimit(key, max, windowMs) {
        const now = Date.now();
        const bucket = rateLimitBuckets.get(key);

        if (!bucket || bucket.resetAt <= now) {
            rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }

        if (bucket.count >= max) {
            return false;
        }

        bucket.count += 1;
        return true;
    }

    // Periodically evict expired buckets so the map can't grow unbounded.
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of rateLimitBuckets) {
            if (bucket.resetAt <= now) {
                rateLimitBuckets.delete(key);
            }
        }
    }, 1000 * 60 * 10).unref?.();

    function enforceRateLimit(req, res, scope, max, windowMs, extraKey = '') {
        const key = `${scope}:${req.ip}:${extraKey}`;
        if (!rateLimit(key, max, windowMs)) {
            res.status(429).json({ ok: false, error: 'too_many_requests' });
            return false;
        }
        return true;
    }

    const RATE_WINDOW_MS = 1000 * 60 * 15;

    app.get('/api/bootstrap', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        try {
            const result = await database.transaction(async tx => {
                const { id: installationId } = await tx.getSql('SELECT id FROM installation WHERE singleton = 1');
                const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users');
                if (!count) return { status: 'setup', installationId };
                const user = await resolveSessionUser(req, tx);
                if (!user) return { status: 'signedOut', installationId };
                return {
                    status: 'authenticated', installationId, user,
                    capabilities: { manageUsers: user.isAdmin, manageOidc: user.isAdmin, manageGyms: user.isAdmin },
                    snapshot: await readSnapshot(tx, user.id)
                };
            });
            res.json({ ok: true, ...result, defaultTimeFormat: serverConfig.defaultTimeFormat });
        } catch (error) {
            console.error('bootstrap_failed', error);
            res.status(500).json({ ok: false, error: 'bootstrap_failed' });
        }
    });

    app.get('/api/setup/status', async (_req, res) => {
        try {
            const count = await getUserCount();
            res.json({ ok: true, needsSetup: count === 0 });
        } catch (error) {
            console.error('status_failed', error);
            res.status(500).json({ ok: false, error: 'status_failed' });
        }
    });

    app.post('/api/setup', async (req, res) => {
        if (!enforceRateLimit(req, res, 'setup', 10, RATE_WINDOW_MS)) {
            return;
        }

        if (!hasExactKeys(req.body, ['username', 'password', 'name'], ['email', 'language'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string'
            || typeof req.body.name !== 'string' || (Object.hasOwn(req.body, 'email') && typeof req.body.email !== 'string')
            || (Object.hasOwn(req.body, 'language') && !['en', 'de'].includes(req.body.language))) {
            res.status(400).json({ ok: false, error: 'invalid_payload' });
            return;
        }
        const username = req.body.username.trim();
        const password = req.body.password;
        const name = req.body.name.trim();
        const email = req.body.email?.trim() || null;
        const language = req.body.language ?? 'en';

        if (username.length < 3 || password.length < 8 || name.length < 1) {
            res.status(400).json({ ok: false, error: 'invalid_input' });
            return;
        }

        try {
            const result = await accounts.setup({ username, password, name, email, language });
            if (result.error) {
                res.status(result.status).json({ ok: false, error: result.error });
                return;
            }

            const user = await getSql('SELECT id, username, name, language, theme, isAdmin FROM users WHERE id = ?', [result.id]);
            await createSession(result.id, res);
            res.json({ ok: true, user: { ...user, isAdmin: Boolean(user?.isAdmin) } });
        } catch (error) {
            console.error('setup_failed', error);
            res.status(500).json({ ok: false, error: 'setup_failed' });
        }
    });

    app.post('/api/auth/register', async (req, res) => {
        if (!enforceRateLimit(req, res, 'register', 10, RATE_WINDOW_MS)) {
            return;
        }

        if (!hasExactKeys(req.body, ['username', 'password'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
            res.status(400).json({ ok: false, error: 'invalid_payload' });
            return;
        }
        const username = req.body.username.trim();
        const password = req.body.password;

        if (username.length < 3 || password.length < 8) {
            res.status(400).json({ ok: false, error: 'invalid_credentials' });
            return;
        }

        try {
            const result = await accounts.create({ username, password });
            if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
            const user = await getSql('SELECT id, username, name, language, theme, isAdmin FROM users WHERE id = ?', [result.id]);
            await createSession(result.id, res);
            res.json({ ok: true, user: { ...user, isAdmin: Boolean(user.isAdmin) } });
        } catch (error) {
            console.error('register_failed', error);
            res.status(500).json({ ok: false, error: 'register_failed' });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        if (!hasExactKeys(req.body, ['username', 'password'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
            res.status(400).json({ ok: false, error: 'invalid_payload' });
            return;
        }
        const username = req.body.username.trim();
        const password = req.body.password;

        // Throttle both by source IP and by targeted username to slow credential
        // stuffing and per-account brute force.
        if (!enforceRateLimit(req, res, 'login-ip', 20, RATE_WINDOW_MS)) {
            return;
        }
        if (!enforceRateLimit(req, res, 'login-user', 10, RATE_WINDOW_MS, username.toLowerCase())) {
            return;
        }

        if (!username || !password) {
            res.status(400).json({ ok: false, error: 'invalid_credentials' });
            return;
        }

        try {
            const user = await getSql('SELECT id, username, name, language, theme, isAdmin, passwordHash FROM users WHERE username = ? COLLATE NOCASE', [username]);
            if (!user || !verifyPassword(password, user.passwordHash)) {
                res.status(401).json({ ok: false, error: 'invalid_credentials' });
                return;
            }

            await createSession(user.id, res);
            res.json({
                ok: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    language: user.language,
                    theme: user.theme,
                    isAdmin: Boolean(user.isAdmin)
                }
            });
        } catch (error) {
            console.error('login_failed', error);
            res.status(500).json({ ok: false, error: 'login_failed' });
        }
    });

    app.get('/api/auth/me', async (req, res) => {
        try {
            const user = await resolveSessionUser(req);
            if (!user) {
                res.status(401).json({ ok: false, error: 'unauthorized' });
                return;
            }

            res.json({ ok: true, user });
        } catch (error) {
            console.error('session_failed', error);
            res.status(500).json({ ok: false, error: 'session_failed' });
        }
    });

    app.post('/api/auth/logout', async (req, res) => {
        try {
            const cookies = parseCookies(req.headers.cookie);
            const sessionId = cookies[SESSION_COOKIE];
            if (sessionId) {
                await runSql('DELETE FROM sessions WHERE id = ?', [sessionId]);
            }

            clearSessionCookie(res);
            res.json({ ok: true });
        } catch (error) {
            console.error('logout_failed', error);
            res.status(500).json({ ok: false, error: 'logout_failed' });
        }
    });

    app.get('/api/auth/oidc/status', async (_req, res) => {
        try {
            const config = await getOidcConfig();
            const enabled = Boolean(config.enabled && config.issuer && config.clientId && config.clientSecret);
            res.json({ ok: true, enabled });
        } catch {
            res.json({ ok: true, enabled: false });
        }
    });

    app.get('/api/admin/config', async (req, res) => {
        if (!await requireAdmin(req, res)) return;
        res.json({ ok: true, config: publicServerConfig(serverConfig) });
    });

    app.get('/api/admin/oidc', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        try {
            const config = await getOidcConfig();
            res.json({
                ok: true,
                config: publicOidcConfig(config),
                redirectUri: getRedirectUri(req)
            });
        } catch (error) {
            console.error('load_failed', error);
            res.status(500).json({ ok: false, error: 'load_failed' });
        }
    });

    app.put('/api/admin/oidc', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        try {
            const current = await getOidcConfig();
            const body = req.body;
            if (!hasExactKeys(body, ['enabled', 'issuer', 'scopes'])
                || typeof body.enabled !== 'boolean' || typeof body.issuer !== 'string'
                || typeof body.scopes !== 'string') {
                res.status(400).json({ ok: false, error: 'invalid_payload' });
                return;
            }

            const issuer = body.issuer.trim().replace(/\/$/, '');
            const scopes = body.scopes.trim() || DEFAULT_OIDC_CONFIG.scopes;
            const enabled = body.enabled;

            const nextConfig = { ...current, enabled, issuer, scopes };
            for (const key of ['enabled', 'issuer', 'scopes']) {
                if (Object.hasOwn(serverConfig.oidc, key) && nextConfig[key] !== current[key]) {
                    res.status(400).json({ ok: false, error: 'environment_managed' });
                    return;
                }
            }
            if (issuer) {
                try { readServerConfig({ OIDC_ISSUER: issuer }); } catch {
                    res.status(400).json({ ok: false, error: 'invalid_payload' });
                    return;
                }
            }

            if (enabled) {
                if (!issuer || !current.clientId || !current.clientSecret) {
                    res.status(400).json({ ok: false, error: 'missing_required_fields' });
                    return;
                }

                try {
                    await discoverOidc(issuer);
                } catch {
                    res.status(400).json({ ok: false, error: 'discovery_failed' });
                    return;
                }
            }

            await saveOidcConfig(nextConfig);

            res.json({
                ok: true,
                config: publicOidcConfig(nextConfig),
                redirectUri: getRedirectUri(req)
            });
        } catch (error) {
            console.error('save_failed', error);
            res.status(500).json({ ok: false, error: 'save_failed' });
        }
    });

    app.get('/api/admin/users', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        try {
            const rows = await allSql(
                'SELECT id, username, name, email, isAdmin, oidcSubject, oidcIssuer, createdAt, lastLoginAt FROM users ORDER BY id ASC'
            );

            const users = rows.map((row) => ({
                id: row.id,
                username: row.username,
                name: row.name,
                email: row.email,
                isAdmin: Boolean(row.isAdmin),
                authType: row.oidcSubject ? 'oidc' : 'password',
                oidcIssuer: row.oidcIssuer ?? null,
                createdAt: row.createdAt ?? null,
                lastLoginAt: row.lastLoginAt ?? null,
                isSelf: row.id === admin.id
            }));

            res.json({ ok: true, users });
        } catch (error) {
            console.error('users_load_failed', error);
            res.status(500).json({ ok: false, error: 'load_failed' });
        }
    });

    app.post('/api/admin/users', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        if (!hasExactKeys(req.body, ['username', 'password', 'name', 'isAdmin'], ['email'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string'
            || typeof req.body.name !== 'string' || typeof req.body.isAdmin !== 'boolean'
            || (Object.hasOwn(req.body, 'email') && typeof req.body.email !== 'string')) {
            res.status(400).json({ ok: false, error: 'invalid_payload' });
            return;
        }
        const username = req.body.username.trim();
        const password = req.body.password;
        const name = req.body.name.trim();
        const email = req.body.email?.trim() || null;
        const isAdmin = req.body.isAdmin;

        if (username.length < 3 || password.length < 8 || name.length < 1) {
            res.status(400).json({ ok: false, error: 'invalid_input' });
            return;
        }

        try {
            const result = await accounts.create({ username, password, name, email, isAdmin }, admin.id);
            if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
            res.json({ ok: true, id: result.id });
        } catch (error) {
            console.error('user_create_failed', error);
            res.status(500).json({ ok: false, error: 'create_failed' });
        }
    });

    app.post('/api/admin/users/:id/password', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        const userId = req.params.id;
        if (!isUuid(userId)) {
            res.status(400).json({ ok: false, error: 'invalid_user' });
            return;
        }

        if (!hasExactKeys(req.body, ['password']) || typeof req.body.password !== 'string') {
            res.status(400).json({ ok: false, error: 'invalid_payload' });
            return;
        }
        const password = req.body.password;
        if (password.length < 8) {
            res.status(400).json({ ok: false, error: 'invalid_password' });
            return;
        }

        try {
            const result = await accounts.resetPassword(admin.id, userId, password);
            if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
            res.json({ ok: true });
        } catch (error) {
            console.error('password_reset_failed', error);
            res.status(500).json({ ok: false, error: 'reset_failed' });
        }
    });

    app.patch('/api/admin/users/:id', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        const userId = req.params.id;
        if (!isUuid(userId)) {
            res.status(400).json({ ok: false, error: 'invalid_user' });
            return;
        }

        if (!hasExactKeys(req.body, ['isAdmin']) || typeof req.body.isAdmin !== 'boolean') {
            res.status(400).json({ ok: false, error: 'invalid_payload' });
            return;
        }

        const nextIsAdmin = req.body.isAdmin;

        try {
            const result = await accounts.changeRole(admin.id, userId, nextIsAdmin);
            if (result.error) {
                res.status(result.status).json({ ok: false, error: result.error });
                return;
            }
            res.json({ ok: true });
        } catch (error) {
            console.error('user_update_failed', error);
            res.status(500).json({ ok: false, error: 'update_failed' });
        }
    });

    app.delete('/api/admin/users/:id', async (req, res) => {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            return;
        }

        const userId = req.params.id;
        if (!isUuid(userId)) {
            res.status(400).json({ ok: false, error: 'invalid_user' });
            return;
        }

        if (userId === admin.id) {
            res.status(400).json({ ok: false, error: 'cannot_delete_self' });
            return;
        }

        try {
            const result = await accounts.delete(admin.id, userId);
            if (result.error) {
                res.status(result.status).json({ ok: false, error: result.error });
                return;
            }
            res.json({ ok: true });
        } catch (error) {
            console.error('user_delete_failed', error);
            res.status(500).json({ ok: false, error: 'delete_failed' });
        }
    });

    app.get('/api/auth/oidc/login', async (req, res) => {
        if (!enforceRateLimit(req, res, 'oidc-login', 30, RATE_WINDOW_MS)) {
            return;
        }

        try {
            const config = await getOidcConfig();
            if (!config.enabled || !config.issuer || !config.clientId || !config.clientSecret) {
                res.redirect('/auth?oidc_error=oidc_disabled');
                return;
            }

            const discovery = await discoverOidc(config.issuer);

            const state = base64UrlEncode(crypto.randomBytes(32));
            const nonce = base64UrlEncode(crypto.randomBytes(32));
            const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
            const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

            await runSql('DELETE FROM oidc_states WHERE expiresAt < ?', [Date.now()]).catch(() => {});
            await runSql(
                'INSERT INTO oidc_states (state, codeVerifier, nonce, expiresAt) VALUES (?, ?, ?, ?)',
                [state, codeVerifier, nonce, Date.now() + OIDC_STATE_TTL_MS]
            );

            const authorizeUrl = new URL(discovery.authorization_endpoint);
            authorizeUrl.searchParams.set('response_type', 'code');
            authorizeUrl.searchParams.set('client_id', config.clientId);
            authorizeUrl.searchParams.set('redirect_uri', getRedirectUri(req));
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

    app.get('/api/auth/oidc/callback', async (req, res) => {
        const failRedirect = (code) => res.redirect(`/auth?oidc_error=${code}`);

        try {
            const code = String(req.query.code ?? '');
            const state = String(req.query.state ?? '');

            if (req.query.error) {
                failRedirect('oidc_denied');
                return;
            }

            if (!code || !state) {
                failRedirect('oidc_failed');
                return;
            }

            const stateRow = await getSql('SELECT state, codeVerifier, nonce, expiresAt FROM oidc_states WHERE state = ?', [state]);
            await runSql('DELETE FROM oidc_states WHERE state = ?', [state]).catch(() => {});

            if (!stateRow || stateRow.expiresAt < Date.now()) {
                failRedirect('oidc_state_invalid');
                return;
            }

            const config = await getOidcConfig();
            if (!config.enabled || !config.issuer || !config.clientId || !config.clientSecret) {
                failRedirect('oidc_disabled');
                return;
            }

            const discovery = await discoverOidc(config.issuer);

            const tokenResponse = await fetch(discovery.token_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: getRedirectUri(req),
                    code_verifier: stateRow.codeVerifier
                }).toString()
            });

            if (!tokenResponse.ok) {
                failRedirect('oidc_token_failed');
                return;
            }

            const tokens = await tokenResponse.json();
            const claims = await verifyIdToken(tokens.id_token, discovery, config.clientId);

            if (!claims || !claims.sub) {
                failRedirect('oidc_token_failed');
                return;
            }

            // The nonce binds the id_token to this specific login attempt and is
            // mandatory: a missing or mismatched nonce is rejected.
            if (claims.nonce !== stateRow.nonce) {
                failRedirect('oidc_nonce_invalid');
                return;
            }

            const issuer = config.issuer.replace(/\/$/, '');
            const subject = String(claims.sub);

            const user = await accounts.resolveOidc({
                issuer, subject,
                name: String(claims.name ?? claims.preferred_username ?? claims.email ?? 'User'),
                email: claims.email ? String(claims.email) : null
            });

            await createSession(user.id, res);
            res.redirect('/');
        } catch {
            failRedirect('oidc_failed');
        }
    });

    app.post('/api/sync', async (req, res) => {
        const user = await resolveSessionUser(req);
        if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
        try {
            const result = await sync.apply(user.id, req.body);
            if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('sync_failed', error);
            res.status(500).json({ ok: false, error: 'sync_failed' });
        }
    });

    app.get('/api/sync/snapshot', async (req, res) => {
        const user = await resolveSessionUser(req);
        if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
        try {
            const result = await sync.snapshot(user.id);
            if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('snapshot_failed', error);
            res.status(500).json({ ok: false, error: 'snapshot_failed' });
        }
    });

    app.use(express.static(DIST_DIR));

    app.use((_req, res) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });


    return { app, bootstrapAdmin };
}
