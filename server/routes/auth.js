import { Router } from 'express';
import { verifyPassword } from '../lib/crypto.js';
import { hasExactKeys, RATE_WINDOW_MS, sendError } from '../lib/http.js';
import { readSnapshot } from '../services/sync.js';

export function createAuthRoutes({ database, serverConfig, accounts, sessions, oidc, enforceRateLimit }) {
    const router = Router();

    router.get('/api/bootstrap', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        try {
            const result = await database.transaction(async tx => {
                const { id: installationId } = await tx.getSql('SELECT id FROM installation WHERE singleton = 1');
                const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users');
                if (!count) return { status: 'setup', installationId };
                const user = await sessions.resolveSessionUser(req, tx);
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
            sendError(res, 500, 'bootstrap_failed');
        }
    });

    router.get('/api/setup/status', async (_req, res) => {
        try {
            const row = await database.getSql('SELECT COUNT(*) AS count FROM users');
            res.json({ ok: true, needsSetup: Number(row?.count ?? 0) === 0 });
        } catch (error) {
            console.error('status_failed', error);
            sendError(res, 500, 'status_failed');
        }
    });

    router.post('/api/setup', async (req, res) => {
        if (!enforceRateLimit(req, res, 'setup', 10, RATE_WINDOW_MS)) return;

        if (!hasExactKeys(req.body, ['username', 'password', 'name'], ['email', 'language'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string'
            || typeof req.body.name !== 'string' || (Object.hasOwn(req.body, 'email') && typeof req.body.email !== 'string')
            || (Object.hasOwn(req.body, 'language') && !['en', 'de'].includes(req.body.language))) {
            return sendError(res, 400, 'invalid_payload');
        }
        const username = req.body.username.trim();
        const password = req.body.password;
        const name = req.body.name.trim();
        const email = req.body.email?.trim() || null;
        const language = req.body.language ?? 'en';

        if (username.length < 3 || password.length < 8 || name.length < 1) return sendError(res, 400, 'invalid_input');

        try {
            const result = await accounts.setup({ username, password, name, email, language });
            if (result.error) return sendError(res, result.status, result.error);
            const user = await sessions.readUser(result.id);
            await sessions.createSession(result.id, res);
            res.json({ ok: true, user });
        } catch (error) {
            console.error('setup_failed', error);
            sendError(res, 500, 'setup_failed');
        }
    });

    router.post('/api/auth/register', async (req, res) => {
        if (!enforceRateLimit(req, res, 'register', 10, RATE_WINDOW_MS)) return;

        if (!hasExactKeys(req.body, ['username', 'password'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
            return sendError(res, 400, 'invalid_payload');
        }
        const username = req.body.username.trim();
        const password = req.body.password;

        if (username.length < 3 || password.length < 8) return sendError(res, 400, 'invalid_credentials');

        try {
            const result = await accounts.create({ username, password });
            if (result.error) return sendError(res, result.status, result.error);
            const user = await sessions.readUser(result.id);
            await sessions.createSession(result.id, res);
            res.json({ ok: true, user });
        } catch (error) {
            console.error('register_failed', error);
            sendError(res, 500, 'register_failed');
        }
    });

    router.post('/api/auth/login', async (req, res) => {
        if (!hasExactKeys(req.body, ['username', 'password'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
            return sendError(res, 400, 'invalid_payload');
        }
        const username = req.body.username.trim();
        const password = req.body.password;

        // Throttle both by source IP and by targeted username to slow credential
        // stuffing and per-account brute force.
        if (!enforceRateLimit(req, res, 'login-ip', 20, RATE_WINDOW_MS)) return;
        if (!enforceRateLimit(req, res, 'login-user', 10, RATE_WINDOW_MS, username.toLowerCase())) return;

        if (!username || !password) return sendError(res, 400, 'invalid_credentials');

        try {
            const user = await database.getSql('SELECT id, username, name, language, theme, isAdmin, passwordHash FROM users WHERE username = ? COLLATE NOCASE', [username]);
            if (!user || !verifyPassword(password, user.passwordHash)) return sendError(res, 401, 'invalid_credentials');

            await sessions.createSession(user.id, res);
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
            sendError(res, 500, 'login_failed');
        }
    });

    router.get('/api/auth/me', async (req, res) => {
        try {
            const user = await sessions.requireUser(req, res);
            if (user) res.json({ ok: true, user });
        } catch (error) {
            console.error('session_failed', error);
            sendError(res, 500, 'session_failed');
        }
    });

    router.post('/api/auth/logout', async (req, res) => {
        try {
            await sessions.destroySession(req, res);
            res.json({ ok: true });
        } catch (error) {
            console.error('logout_failed', error);
            sendError(res, 500, 'logout_failed');
        }
    });

    router.get('/api/auth/oidc/status', async (_req, res) => {
        try {
            res.json({ ok: true, enabled: oidc.isUsable(await oidc.getConfig()) });
        } catch {
            res.json({ ok: true, enabled: false });
        }
    });

    return router;
}
