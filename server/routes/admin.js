import { Router } from 'express';
import { publicServerConfig, readServerConfig } from '../config.js';
import { hasExactKeys, sendError } from '../lib/http.js';
import { DEFAULT_OIDC_CONFIG } from '../services/oidcSettings.js';
import { isUuid } from '../../shared/commands.js';

export function createAdminRoutes({ database, serverConfig, accounts, sessions, oidc }) {
    const router = Router();

    router.get('/api/admin/config', async (req, res) => {
        if (!await sessions.requireAdmin(req, res)) return;
        res.json({ ok: true, config: publicServerConfig(serverConfig) });
    });

    router.get('/api/admin/oidc', async (req, res) => {
        if (!await sessions.requireAdmin(req, res)) return;
        try {
            const config = await oidc.getConfig();
            res.json({ ok: true, config: oidc.publicConfig(config), redirectUri: oidc.redirectUri(req) });
        } catch (error) {
            console.error('load_failed', error);
            sendError(res, 500, 'load_failed');
        }
    });

    router.put('/api/admin/oidc', async (req, res) => {
        if (!await sessions.requireAdmin(req, res)) return;
        try {
            const current = await oidc.getConfig();
            const body = req.body;
            if (!hasExactKeys(body, ['enabled', 'issuer', 'scopes'])
                || typeof body.enabled !== 'boolean' || typeof body.issuer !== 'string'
                || typeof body.scopes !== 'string') {
                return sendError(res, 400, 'invalid_payload');
            }

            const issuer = body.issuer.trim().replace(/\/$/, '');
            const scopes = body.scopes.trim() || DEFAULT_OIDC_CONFIG.scopes;
            const enabled = body.enabled;

            const nextConfig = { ...current, enabled, issuer, scopes };
            for (const key of oidc.editableKeys) {
                if (oidc.environmentManaged(key) && nextConfig[key] !== current[key]) {
                    return sendError(res, 400, 'environment_managed');
                }
            }
            if (issuer) {
                try { readServerConfig({ OIDC_ISSUER: issuer }); } catch {
                    return sendError(res, 400, 'invalid_payload');
                }
            }

            if (enabled) {
                if (!issuer || !current.clientId || !current.clientSecret) return sendError(res, 400, 'missing_required_fields');
                try {
                    await oidc.discover(issuer);
                } catch {
                    return sendError(res, 400, 'discovery_failed');
                }
            }

            await oidc.saveConfig(nextConfig);
            res.json({ ok: true, config: oidc.publicConfig(nextConfig), redirectUri: oidc.redirectUri(req) });
        } catch (error) {
            console.error('save_failed', error);
            sendError(res, 500, 'save_failed');
        }
    });

    router.get('/api/admin/users', async (req, res) => {
        const admin = await sessions.requireAdmin(req, res);
        if (!admin) return;
        try {
            const rows = await database.allSql(
                'SELECT id, username, name, email, isAdmin, oidcSubject, oidcIssuer, createdAt, lastLoginAt FROM users ORDER BY id ASC'
            );
            const users = rows.map(row => ({
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
            sendError(res, 500, 'load_failed');
        }
    });

    router.post('/api/admin/users', async (req, res) => {
        const admin = await sessions.requireAdmin(req, res);
        if (!admin) return;

        if (!hasExactKeys(req.body, ['username', 'password', 'name', 'isAdmin'], ['email'])
            || typeof req.body.username !== 'string' || typeof req.body.password !== 'string'
            || typeof req.body.name !== 'string' || typeof req.body.isAdmin !== 'boolean'
            || (Object.hasOwn(req.body, 'email') && typeof req.body.email !== 'string')) {
            return sendError(res, 400, 'invalid_payload');
        }
        const username = req.body.username.trim();
        const password = req.body.password;
        const name = req.body.name.trim();
        const email = req.body.email?.trim() || null;
        const isAdmin = req.body.isAdmin;

        if (username.length < 3 || password.length < 8 || name.length < 1) return sendError(res, 400, 'invalid_input');

        try {
            const result = await accounts.create({ username, password, name, email, isAdmin }, admin.id);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true, id: result.id });
        } catch (error) {
            console.error('user_create_failed', error);
            sendError(res, 500, 'create_failed');
        }
    });

    router.post('/api/admin/users/:id/password', async (req, res) => {
        const admin = await sessions.requireAdmin(req, res);
        if (!admin) return;

        const userId = req.params.id;
        if (!isUuid(userId)) return sendError(res, 400, 'invalid_user');
        if (!hasExactKeys(req.body, ['password']) || typeof req.body.password !== 'string') return sendError(res, 400, 'invalid_payload');
        const password = req.body.password;
        if (password.length < 8) return sendError(res, 400, 'invalid_password');

        try {
            const result = await accounts.resetPassword(admin.id, userId, password);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true });
        } catch (error) {
            console.error('password_reset_failed', error);
            sendError(res, 500, 'reset_failed');
        }
    });

    router.patch('/api/admin/users/:id', async (req, res) => {
        const admin = await sessions.requireAdmin(req, res);
        if (!admin) return;

        const userId = req.params.id;
        if (!isUuid(userId)) return sendError(res, 400, 'invalid_user');
        if (!hasExactKeys(req.body, ['isAdmin']) || typeof req.body.isAdmin !== 'boolean') return sendError(res, 400, 'invalid_payload');

        try {
            const result = await accounts.changeRole(admin.id, userId, req.body.isAdmin);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true });
        } catch (error) {
            console.error('user_update_failed', error);
            sendError(res, 500, 'update_failed');
        }
    });

    router.delete('/api/admin/users/:id', async (req, res) => {
        const admin = await sessions.requireAdmin(req, res);
        if (!admin) return;

        const userId = req.params.id;
        if (!isUuid(userId)) return sendError(res, 400, 'invalid_user');
        if (userId === admin.id) return sendError(res, 400, 'cannot_delete_self');

        try {
            const result = await accounts.delete(admin.id, userId);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true });
        } catch (error) {
            console.error('user_delete_failed', error);
            sendError(res, 500, 'delete_failed');
        }
    });

    return router;
}
