import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFixtureCredentials, readServerConfig, publicServerConfig } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { databasePath } from './databaseFiles.js';

describe('environment configuration', () => {
    it('resolves the same database path for startup and reset', () => {
        for (const value of [undefined, '', '   ', ' ./db ', '/tmp/gymapp-test']) {
            const config = readServerConfig({ DATA_DIR: value });
            expect(databasePath({ DATA_DIR: config.dataDir })).toBe(databasePath({ DATA_DIR: value }));
        }
    });
    it('validates booleans, ports, credential-free URLs, and fixture credentials without leaking values', () => {
        expect(readServerConfig({ OIDC_ENABLED: 'false' }).oidc.enabled).toBe(false);
        expect(readServerConfig().oidc).not.toHaveProperty('enabled');
        for (const env of [{ PORT: 'no' }, { PORT: '0' }, { COOKIE_SECURE: 'yes' }, { OIDC_ENABLED: '1' },
            { PUBLIC_URL: 'https://name:password@example.com' }, { OIDC_ISSUER: 'file:///tmp/idp' }, { VITE_API_TARGET: 'https://example.com?token=value' }]) {
            expect(() => readServerConfig(env)).toThrow('invalid_environment:');
        }
        expect(() => readFixtureCredentials({})).toThrow('SEED_ADMIN_USERNAME');
        const env = { SEED_ADMIN_USERNAME: randomUUID(), SEED_ADMIN_PASSWORD: randomUUID(), SEED_USER_USERNAME: randomUUID(), SEED_USER_PASSWORD: randomUUID() };
        expect(readFixtureCredentials(env).admin).toEqual({ username: env.SEED_ADMIN_USERNAME, password: env.SEED_ADMIN_PASSWORD });
        expect(() => readFixtureCredentials({ ...env, SEED_USER_PASSWORD: '' })).toThrow('SEED_USER_PASSWORD');
        expect(() => readFixtureCredentials({ ...env, SEED_USER_USERNAME: env.SEED_ADMIN_USERNAME.toUpperCase() })).toThrow('SEED_USER_USERNAME');
        const config = readServerConfig({ ...env, ADMIN_USERNAME: randomUUID(), OIDC_CLIENT_ID: randomUUID(), OIDC_CLIENT_SECRET: randomUUID(), UNRELATED_SECRET: randomUUID() });
        expect(Object.keys(publicServerConfig(config)).sort()).toEqual([
            'cookieSecure', 'dataDir', 'environmentManaged', 'nodeEnv', 'port', 'publicUrl', 'seedDevData', 'viteApiTarget',
        ]);
    });

    it('scopes configuration to admins, locks env fields, keeps credentials env-only, and uses them for OIDC login', async () => {
        const database = openDatabase(':memory:');
        const credentials = { admin: { username: randomUUID(), password: randomUUID() }, user: { username: randomUUID(), password: randomUUID() } };
        const clientId = randomUUID();
        const clientSecret = randomUUID();
        const config = readServerConfig({ PORT: '3000', PUBLIC_URL: 'https://gym.example', OIDC_ENABLED: 'false',
            OIDC_ISSUER: 'https://identity.example', OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: clientSecret });
        let server;
        try {
            await database.initDatabase({ seedDevData: true, fixtureCredentials: credentials });
            const { app } = createApp({ database, config });
            server = await new Promise(resolve => { const listener = app.listen(0, () => resolve(listener)); });
            const base = `http://127.0.0.1:${server.address().port}`;
            const request = (route, cookie, body) => fetch(`${base}${route}`, { method: body ? 'PUT' : 'GET',
                headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
            const cookies = {};
            for (const role of ['admin', 'user']) {
                const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials[role]) });
                expect(response.status).toBe(200);
                cookies[role] = response.headers.get('set-cookie').split(';')[0];
            }
            for (const route of ['/api/admin/config', '/api/admin/oidc']) {
                expect((await request(route)).status).toBe(401);
                expect((await request(route, cookies.user)).status).toBe(403);
                const response = await request(route, cookies.admin);
                expect(response.status).toBe(200);
                const text = await response.text();
                for (const value of [clientId, clientSecret, credentials.admin.username, credentials.admin.password, credentials.user.username, credentials.user.password]) expect(text).not.toContain(value);
            }
            const oidc = (await (await request('/api/admin/oidc', cookies.admin)).json());
            expect(oidc).toMatchObject({ redirectUri: 'https://gym.example/api/auth/oidc/callback', config: {
                enabled: false, issuer: 'https://identity.example', scopes: 'openid profile email', hasCredentials: true, environmentManaged: ['enabled', 'issuer'],
            } });
            const update = { enabled: false, issuer: config.oidc.issuer, scopes: 'openid email' };
            expect((await request('/api/admin/oidc', cookies.user, update)).status).toBe(403);
            for (const body of [{ ...update, enabled: true }, { ...update, issuer: 'https://other.example' }]) {
                expect(await (await request('/api/admin/oidc', cookies.admin, body)).json()).toMatchObject({ error: 'environment_managed' });
            }
            for (const body of [{ ...update, clientSecret }, { ...update, clientId }, { ...update, enabled: 'false' }]) {
                expect((await request('/api/admin/oidc', cookies.admin, body)).status).toBe(400);
            }
            expect((await request('/api/admin/oidc', cookies.admin, update)).status).toBe(200);
            expect(JSON.parse((await database.getSql("SELECT value FROM app_settings WHERE key = 'oidc.config'")).value)).toEqual({ scopes: 'openid email' });

            await new Promise(resolve => server.close(resolve));
            const enabledConfig = readServerConfig({ OIDC_ENABLED: 'true', OIDC_ISSUER: config.oidc.issuer, OIDC_SCOPES: 'openid profile', OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: clientSecret });
            const restarted = createApp({ database, config: enabledConfig });
            server = await new Promise(resolve => { const listener = restarted.app.listen(0, () => resolve(listener)); });
            const nextBase = `http://127.0.0.1:${server.address().port}`;
            expect((await (await fetch(`${nextBase}/api/admin/oidc`, { headers: { Cookie: cookies.admin } })).json()).config.scopes).toBe('openid profile');
            const nativeFetch = globalThis.fetch;
            vi.stubGlobal('fetch', vi.fn((input, options) => String(input).startsWith(config.oidc.issuer)
                ? Promise.resolve(new Response(JSON.stringify({ issuer: config.oidc.issuer, authorization_endpoint: `${config.oidc.issuer}/authorize`, token_endpoint: `${config.oidc.issuer}/token`, jwks_uri: `${config.oidc.issuer}/jwks` })))
                : nativeFetch(input, options)));
            const login = await fetch(`${nextBase}/api/auth/oidc/login`, { redirect: 'manual' });
            expect(login.status).toBe(302);
            const authorization = new URL(login.headers.get('location'));
            expect(authorization.searchParams.get('client_id')).toBe(clientId);
            expect(authorization.searchParams.get('scope')).toBe('openid profile');
            expect(login.headers.get('location')).not.toContain(clientSecret);
            const tokenExchange = vi.fn(async (_input, options) => {
                expect(options.headers.Authorization).toBe(`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`);
                const body = new URLSearchParams(options.body);
                expect(body.get('grant_type')).toBe('authorization_code');
                expect(body.get('code_verifier')).toBeTruthy();
                return new Response('{}', { status: 401 });
            });
            vi.stubGlobal('fetch', (input, options) => String(input) === `${config.oidc.issuer}/token` ? tokenExchange(input, options) : nativeFetch(input, options));
            const callback = await fetch(`${nextBase}/api/auth/oidc/callback?code=${randomUUID()}&state=${authorization.searchParams.get('state')}`, { redirect: 'manual' });
            expect(tokenExchange).toHaveBeenCalledTimes(1);
            expect(callback.headers.get('location')).toBe('/auth?oidc_error=oidc_token_failed');
        } finally {
            vi.unstubAllGlobals();
            if (server?.listening) await new Promise(resolve => server.close(resolve));
            await database.close();
        }
    });

    it('persists editable OIDC fields but cannot enable login without environment credentials', async () => {
        const database = openDatabase(':memory:');
        let server;
        try {
            await database.initDatabase();
            const { app } = createApp({ database });
            server = await new Promise(resolve => { const listener = app.listen(0, () => resolve(listener)); });
            const base = `http://127.0.0.1:${server.address().port}`;
            const setup = await fetch(`${base}/api/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: randomUUID(), password: randomUUID(), name: 'Test' }) });
            const headers = { 'Content-Type': 'application/json', Cookie: setup.headers.get('set-cookie').split(';')[0] };
            const input = { enabled: false, issuer: 'https://identity.example', scopes: 'openid' };
            const saved = await fetch(`${base}/api/admin/oidc`, { method: 'PUT', headers, body: JSON.stringify(input) });
            expect(saved.status).toBe(200);
            expect((await saved.json()).config).toEqual({ ...input, hasCredentials: false, environmentManaged: [] });
            const invalid = await fetch(`${base}/api/admin/oidc`, { method: 'PUT', headers, body: JSON.stringify({ ...input, enabled: true }) });
            expect(invalid.status).toBe(400);
            expect((await invalid.json()).error).toBe('missing_required_fields');
            expect((await (await fetch(`${base}/api/auth/oidc/status`)).json()).enabled).toBe(false);
            await new Promise(resolve => server.close(resolve));
            const configured = createApp({ database, config: readServerConfig({ OIDC_CLIENT_ID: randomUUID(), OIDC_CLIENT_SECRET: randomUUID() }) });
            server = await new Promise(resolve => { const listener = configured.app.listen(0, () => resolve(listener)); });
            const configuredBase = `http://127.0.0.1:${server.address().port}`;
            const nativeFetch = globalThis.fetch;
            const discovery = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({
                issuer: input.issuer, authorization_endpoint: `${input.issuer}/authorize`, token_endpoint: `${input.issuer}/token`, jwks_uri: `${input.issuer}/jwks`,
            })));
            vi.stubGlobal('fetch', (url, options) => String(url).startsWith(input.issuer) ? discovery() : nativeFetch(url, options));
            const enable = () => fetch(`${configuredBase}/api/admin/oidc`, { method: 'PUT', headers, body: JSON.stringify({ ...input, enabled: true }) });
            expect(await (await enable()).json()).toMatchObject({ error: 'discovery_failed' });
            expect((await (await fetch(`${configuredBase}/api/auth/oidc/status`)).json()).enabled).toBe(false);
            expect(await (await enable()).json()).toMatchObject({ config: { enabled: true, hasCredentials: true, environmentManaged: [] } });
            expect((await (await fetch(`${configuredBase}/api/auth/oidc/status`)).json()).enabled).toBe(true);
        } finally {
            vi.unstubAllGlobals();
            if (server) await new Promise(resolve => server.close(resolve));
            await database.close();
        }
    });
});
