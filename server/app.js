import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readServerConfig } from './config.js';
import { createRateLimiter } from './lib/http.js';
import { createAdminRoutes } from './routes/admin.js';
import { createAuthRoutes } from './routes/auth.js';
import { createOidcRoutes } from './routes/oidc.js';
import { createSyncRoutes } from './routes/sync.js';
import { createAccountService } from './services/accounts.js';
import { createOidcSettings } from './services/oidcSettings.js';
import { createSessionService } from './services/sessions.js';
import { createSyncService } from './services/sync.js';

export function createApp({ database, config: serverConfig = readServerConfig(), distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist') }) {
    const accounts = createAccountService(database);
    const sync = createSyncService(database);
    const sessions = createSessionService(database, { cookieSecure: serverConfig.cookieSecure });
    const oidc = createOidcSettings(database, serverConfig);
    const enforceRateLimit = createRateLimiter();
    const context = { database, serverConfig, accounts, sync, sessions, oidc, enforceRateLimit };

    async function bootstrapAdmin() {
        const { getSql, runSql } = database;
        try {
            const installation = await getSql('SELECT initializationMode FROM installation WHERE singleton = 1');
            if (installation?.initializationMode === 'fixtures') return;
            if (serverConfig.adminUsername) {
                const target = await getSql('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [serverConfig.adminUsername]);
                if (target) {
                    await runSql('UPDATE users SET isAdmin = 1 WHERE id = ?', [target.id]);
                    return;
                }
            }

            const existingAdmin = await getSql('SELECT id FROM users WHERE isAdmin = 1 LIMIT 1');
            if (existingAdmin) return;

            const firstUser = await getSql('SELECT id FROM users ORDER BY id ASC LIMIT 1');
            if (firstUser) await runSql('UPDATE users SET isAdmin = 1 WHERE id = ?', [firstUser.id]);
        } catch {
            // best-effort bootstrap; ignore failures
        }
    }

    const app = express();

    // Behind a reverse proxy (the documented deployment), trust the first hop so
    // req.ip reflects the real client for rate limiting.
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '1mb' }));

    app.use(createAuthRoutes(context));
    app.use(createAdminRoutes(context));
    app.use(createOidcRoutes(context));
    app.use(createSyncRoutes(context));

    app.use(express.static(distDir));
    app.use((_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });

    return { app, bootstrapAdmin };
}
