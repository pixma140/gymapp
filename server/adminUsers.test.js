import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { createAccountService } from './services/accounts.js';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gymapp-test-'));
const database = openDatabase(path.join(DATA_DIR, 'gymapp.db'));
const { app } = createApp({ database });

let server;
let baseUrl;

function jsonHeaders(extra = {}) {
    return { 'Content-Type': 'application/json', ...extra };
}

// Minimal cookie-jar request helper that captures and replays Set-Cookie.
async function request(method, route, { body, cookie } = {}) {
    const headers = jsonHeaders(cookie ? { Cookie: cookie } : {});
    const res = await fetch(`${baseUrl}${route}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    let sessionCookie = cookie;
    if (setCookie) {
        sessionCookie = setCookie.split(';')[0];
    }
    let payload = null;
    try {
        payload = await res.json();
    } catch {
        payload = null;
    }
    return { status: res.status, body: payload, cookie: sessionCookie };
}

beforeAll(async () => {
    await database.initDatabase({ seedDevData: false });
    await new Promise((resolve, reject) => {
        server = app.listen(0, () => resolve());
        server.on('error', reject);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await database.close();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

describe('admin user management', () => {
    let adminCookie;
    let adminId;
    let bobCookie;
    let bobId;

    it('rejects malformed setup without creating an administrator', async () => {
        for (const body of [
            { username: ['admin'], password: 'adminpassword', name: 'Admin' },
            { username: 'admin', password: 'adminpassword', name: 'Admin', language: 'fr' },
            { username: 'admin', password: 'adminpassword', name: 'Admin', isAdmin: true },
        ]) {
            const result = await request('POST', '/api/setup', { body });
            expect(result.status).toBe(400);
            expect(result.body.error).toBe('invalid_payload');
        }
        expect(await database.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 0 });
    });

    it('bootstraps the first admin via setup', async () => {
        const res = await request('POST', '/api/setup', {
            body: { username: 'admin', password: 'adminpassword', name: 'Admin' },
        });
        expect(res.status).toBe(200);
        expect(res.body.user.isAdmin).toBe(true);
        adminCookie = res.cookie;
        adminId = res.body.user.id;
    });

    it('registers a second (non-admin) user', async () => {
        const res = await request('POST', '/api/auth/register', {
            body: { username: 'bob', password: 'bobpassword' },
        });
        expect(res.status).toBe(200);
        bobCookie = res.cookie;
        bobId = res.body.user.id;
        expect(bobId).not.toBe(adminId);
    });

    it('rejects listing users when unauthenticated', async () => {
        const res = await request('GET', '/api/admin/users');
        expect(res.status).toBe(401);
    });

    it('forbids a non-admin from listing users', async () => {
        const res = await request('GET', '/api/admin/users', { cookie: bobCookie });
        expect(res.status).toBe(403);
    });

    it('lets an admin list users with metadata', async () => {
        const res = await request('GET', '/api/admin/users', { cookie: adminCookie });
        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(2);

        const admin = res.body.users.find((u) => u.id === adminId);
        const bob = res.body.users.find((u) => u.id === bobId);

        expect(admin.isAdmin).toBe(true);
        expect(admin.isSelf).toBe(true);
        expect(admin.authType).toBe('password');
        // setup -> createSession should have recorded a login timestamp.
        expect(typeof admin.lastLoginAt).toBe('number');
        expect(typeof admin.createdAt).toBe('number');

        expect(bob.isAdmin).toBe(false);
        expect(bob.isSelf).toBe(false);
    });

    it('promotes and demotes a user', async () => {
        const promote = await request('PATCH', `/api/admin/users/${bobId}`, {
            cookie: adminCookie,
            body: { isAdmin: true },
        });
        expect(promote.status).toBe(200);

        let list = await request('GET', '/api/admin/users', { cookie: adminCookie });
        expect(list.body.users.find((u) => u.id === bobId).isAdmin).toBe(true);

        const demote = await request('PATCH', `/api/admin/users/${bobId}`, {
            cookie: adminCookie,
            body: { isAdmin: false },
        });
        expect(demote.status).toBe(200);

        list = await request('GET', '/api/admin/users', { cookie: adminCookie });
        expect(list.body.users.find((u) => u.id === bobId).isAdmin).toBe(false);
    });

    it('forbids a non-admin from promoting themselves', async () => {
        const res = await request('PATCH', `/api/admin/users/${bobId}`, {
            cookie: bobCookie,
            body: { isAdmin: true },
        });
        expect(res.status).toBe(403);
    });

    it('rejects a patch with a non-boolean isAdmin', async () => {
        const res = await request('PATCH', `/api/admin/users/${bobId}`, {
            cookie: adminCookie,
            body: { isAdmin: 'yes' },
        });
        expect(res.status).toBe(400);
    });

    it('rejects unexpected role and password properties without mutation', async () => {
        const role = await request('PATCH', `/api/admin/users/${bobId}`, {
            cookie: adminCookie, body: { isAdmin: true, unexpected: true },
        });
        expect(role.status).toBe(400);
        expect(await database.getSql('SELECT isAdmin FROM users WHERE id = ?', [bobId])).toEqual({ isAdmin: 0 });

        const password = await request('POST', `/api/admin/users/${bobId}/password`, {
            cookie: adminCookie, body: { password: ['longpassword'] },
        });
        expect(password.status).toBe(400);
        expect((await request('POST', '/api/auth/login', { body: { username: 'bob', password: 'bobpassword' } })).status).toBe(200);
    });

    it('prevents an admin from demoting themselves', async () => {
        const res = await request('PATCH', `/api/admin/users/${adminId}`, {
            cookie: adminCookie,
            body: { isAdmin: false },
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('cannot_demote_self');
    });

    it('creates a new user via the admin endpoint', async () => {
        const res = await request('POST', '/api/admin/users', {
            cookie: adminCookie,
            body: { username: 'carol', password: 'carolpassword', name: 'Carol', email: 'carol@example.com', isAdmin: false },
        });
        expect(res.status).toBe(200);
        expect(typeof res.body.id).toBe('number');

        const list = await request('GET', '/api/admin/users', { cookie: adminCookie });
        const carol = list.body.users.find((u) => u.username === 'carol');
        expect(carol).toBeTruthy();
        expect(carol.email).toBe('carol@example.com');
        expect(carol.isAdmin).toBe(false);
        expect(typeof carol.createdAt).toBe('number');
        // Never logged in yet.
        expect(carol.lastLoginAt).toBeNull();
    });

    it('rejects coerced administrator creation and leaves no account behind', async () => {
        for (const body of [
            { username: 'coerced-admin', password: 'longpassword', name: 'Coerced', isAdmin: 'false' },
            { username: 'extra-admin', password: 'longpassword', name: 'Extra', isAdmin: true, unexpected: true },
        ]) {
            const result = await request('POST', '/api/admin/users', { cookie: adminCookie, body });
            expect(result.status).toBe(400);
            expect(result.body.error).toBe('invalid_payload');
        }
        expect(await database.getSql("SELECT COUNT(*) AS count FROM users WHERE username IN ('coerced-admin', 'extra-admin')"))
            .toEqual({ count: 0 });
    });

    it('lets an admin-created user log in with their credentials', async () => {
        const res = await request('POST', '/api/auth/login', {
            body: { username: 'carol', password: 'carolpassword' },
        });
        expect(res.status).toBe(200);
        expect(res.body.user.username).toBe('carol');
    });

    it('rejects creating a user with a duplicate username', async () => {
        const res = await request('POST', '/api/admin/users', {
            cookie: adminCookie,
            body: { username: 'carol', password: 'anotherpassword', name: 'Carol 2', isAdmin: false },
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('username_taken');
    });

    it('rejects creating a user with invalid input', async () => {
        const res = await request('POST', '/api/admin/users', {
            cookie: adminCookie,
            body: { username: 'ab', password: 'short', name: '', isAdmin: false },
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_input');
    });

    it('forbids a non-admin from creating users', async () => {
        const res = await request('POST', '/api/admin/users', {
            cookie: bobCookie,
            body: { username: 'mallory', password: 'mallorypassword', name: 'Mallory', isAdmin: true },
        });
        expect(res.status).toBe(403);
    });

    it('resets a user password and invalidates their existing sessions', async () => {
        // Bob is logged in via bobCookie. After a reset, that session must die
        // and the old password must stop working.
        const res = await request('POST', `/api/admin/users/${bobId}/password`, {
            cookie: adminCookie,
            body: { password: 'bobnewpassword' },
        });
        expect(res.status).toBe(200);

        // Old session no longer authenticates.
        const me = await request('GET', '/api/auth/me', { cookie: bobCookie });
        expect(me.status).toBe(401);

        // Old password is rejected.
        const oldLogin = await request('POST', '/api/auth/login', {
            body: { username: 'bob', password: 'bobpassword' },
        });
        expect(oldLogin.status).toBe(401);

        // New password works.
        const newLogin = await request('POST', '/api/auth/login', {
            body: { username: 'bob', password: 'bobnewpassword' },
        });
        expect(newLogin.status).toBe(200);
        bobCookie = newLogin.cookie;
    });

    it('rolls back the password if session invalidation fails', async () => {
        const before = await database.getSql('SELECT passwordHash FROM users WHERE id = ?', [bobId]);
        await database.runSql("CREATE TRIGGER reject_session_delete BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'test session failure'); END");
        try {
            const result = await request('POST', `/api/admin/users/${bobId}/password`, {
                cookie: adminCookie, body: { password: 'rollbackpassword' },
            });
            expect(result.status).toBe(500);
            expect(await database.getSql('SELECT passwordHash FROM users WHERE id = ?', [bobId])).toEqual(before);
            expect((await request('GET', '/api/auth/me', { cookie: bobCookie })).status).toBe(200);
        } finally {
            await database.runSql('DROP TRIGGER reject_session_delete');
        }
    });

    it('uses current roles for existing sessions across every admin endpoint', async () => {
        await request('PATCH', `/api/admin/users/${bobId}`, { cookie: adminCookie, body: { isAdmin: true } });
        expect((await request('GET', '/api/admin/users', { cookie: bobCookie })).status).toBe(200);
        await request('PATCH', `/api/admin/users/${bobId}`, { cookie: adminCookie, body: { isAdmin: false } });
        const me = await request('GET', '/api/auth/me', { cookie: bobCookie });
        expect(me.body.user.isAdmin).toBe(false);
        for (const [method, route, body] of [
            ['GET', '/api/admin/users'],
            ['POST', '/api/admin/users', { username: 'denied', password: 'longpassword', name: 'Denied' }],
            ['PATCH', `/api/admin/users/${adminId}`, { isAdmin: false }],
            ['DELETE', `/api/admin/users/${adminId}`],
            ['POST', `/api/admin/users/${adminId}/password`, { password: 'longpassword' }],
            ['GET', '/api/admin/oidc'],
            ['PUT', '/api/admin/oidc', { enabled: false }],
        ]) {
            expect((await request(method, route, { cookie: bobCookie, body })).status).toBe(403);
        }
    });

    it('rejects registration privilege fields and serializes valid competing registrations', async () => {
        const privileged = await request('POST', '/api/auth/register', {
            body: { username: 'privileged', password: 'longpassword', isAdmin: true },
        });
        expect(privileged.status).toBe(400);
        expect(await database.getSql("SELECT COUNT(*) AS count FROM users WHERE username = 'privileged'"))
            .toEqual({ count: 0 });
        const results = await Promise.all(['Concurrent', 'concurrent'].map(username =>
            request('POST', '/api/auth/register', { body: { username, password: 'longpassword' } })));
        expect(results.map(result => result.status).sort()).toEqual([200, 409]);
        const created = results.find(result => result.status === 200);
        expect(created.body.user.isAdmin).toBe(false);
    });

    it('rejects malformed login and OIDC settings without changing security state', async () => {
        const login = await request('POST', '/api/auth/login', {
            body: { username: ['admin'], password: 'adminpassword' },
        });
        expect(login.status).toBe(400);
        expect(login.cookie).toBeUndefined();

        const oidc = await request('PUT', '/api/admin/oidc', {
            cookie: adminCookie,
            body: { enabled: 'false', issuer: 'https://issuer.example', clientId: 'client', clientSecret: 'secret', scopes: 'openid' },
        });
        expect(oidc.status).toBe(400);
        expect(oidc.body.error).toBe('invalid_payload');
        expect((await request('GET', '/api/auth/oidc/status')).body.enabled).toBe(false);
        expect(await database.getSql("SELECT value FROM app_settings WHERE key = 'oidc.config'")).toBeNull();
    });

    it('rejects a password reset that is too short', async () => {
        const res = await request('POST', `/api/admin/users/${bobId}/password`, {
            cookie: adminCookie,
            body: { password: 'short' },
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_password');
    });

    it('returns 404 when resetting a password for an unknown user', async () => {
        const res = await request('POST', '/api/admin/users/999999/password', {
            cookie: adminCookie,
            body: { password: 'whateverpassword' },
        });
        expect(res.status).toBe(404);
    });

    it('forbids a non-admin from deleting a user', async () => {
        const res = await request('DELETE', `/api/admin/users/${adminId}`, { cookie: bobCookie });
        expect(res.status).toBe(403);
    });

    it('prevents an admin from deleting their own account', async () => {
        const res = await request('DELETE', `/api/admin/users/${adminId}`, { cookie: adminCookie });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('cannot_delete_self');
    });

    it('converges concurrent verified OIDC identities without granting roles or password auth', async () => {
        const accounts = createAccountService(database);
        const profile = { issuer: 'https://issuer.example', subject: 'same-subject', name: 'OIDC User', email: null };
        const [first, second] = await Promise.all([accounts.resolveOidc(profile), accounts.resolveOidc(profile)]);
        expect(first.id).toBe(second.id);
        expect(await database.getSql('SELECT isAdmin, passwordHash FROM users WHERE id = ?', [first.id]))
            .toEqual({ isAdmin: 0, passwordHash: null });
        const reset = await request('POST', `/api/admin/users/${first.id}/password`, {
            cookie: adminCookie, body: { password: 'longpassword' },
        });
        expect(reset.status).toBe(400);
        expect(reset.body.error).toBe('no_password_auth');
        await accounts.delete(adminId, first.id);
    });

    it('rechecks a demoted actor inside account service transactions', async () => {
        const accounts = createAccountService(database);
        const forbidden = { status: 403, error: 'forbidden' };
        expect(await accounts.create({ username: 'service-denied', password: 'longpassword' }, bobId)).toEqual(forbidden);
        expect(await accounts.resetPassword(bobId, adminId, 'longpassword')).toEqual(forbidden);
        expect(await accounts.changeRole(bobId, bobId, true)).toEqual(forbidden);
        expect(await accounts.delete(bobId, adminId)).toEqual(forbidden);
    });

    it('rolls back account cleanup if any private-data deletion fails', async () => {
        await database.runSql("INSERT INTO userMeasurements (userId, id, weight, timestamp) VALUES (?, '00000000-0000-4000-8000-000000000099', 80, 1)", [bobId]);
        await database.runSql("CREATE TRIGGER reject_user_delete BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT, 'test cleanup failure'); END");
        try {
            const result = await request('DELETE', `/api/admin/users/${bobId}`, { cookie: adminCookie });
            expect(result.status).toBe(500);
            expect(await database.getSql("SELECT weight FROM userMeasurements WHERE userId = ? AND id = '00000000-0000-4000-8000-000000000099'", [bobId])).toEqual({ weight: 80 });
            expect((await request('GET', '/api/auth/me', { cookie: bobCookie })).status).toBe(200);
        } finally {
            await database.runSql('DROP TRIGGER reject_user_delete');
        }
    });

    it('deletes a user, private data, and sessions without touching another account', async () => {
        await database.runSql("INSERT INTO userMeasurements (userId, id, weight, timestamp) VALUES (?, '00000000-0000-4000-8000-000000000001', 80, 1), (?, '00000000-0000-4000-8000-000000000002', 90, 1)", [bobId, adminId]);
        await database.runSql("INSERT INTO gyms (id, name) VALUES ('00000000-0000-4000-8000-000000000003', 'Shared')");
        await database.runSql("INSERT INTO workouts (userId, id, gymId, startTime) VALUES (?, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 1)", [bobId]);
        await database.runSql("INSERT INTO mutation_receipts (userId, mutationId, command, result, createdAt) VALUES (?, '00000000-0000-4000-8000-000000000005', '{}', '{}', 1)", [bobId]);
        const res = await request('DELETE', `/api/admin/users/${bobId}`, { cookie: adminCookie });
        expect(res.status).toBe(200);

        const list = await request('GET', '/api/admin/users', { cookie: adminCookie });
        expect(list.body.users.find((u) => u.id === bobId)).toBeUndefined();

        expect(await database.allSql('SELECT * FROM userMeasurements WHERE userId = ?', [bobId])).toEqual([]);
        expect(await database.allSql('SELECT * FROM workouts WHERE userId = ?', [bobId])).toEqual([]);
        expect(await database.getSql('SELECT weight FROM userMeasurements WHERE userId = ?', [adminId])).toEqual({ weight: 90 });

        expect(await database.getSql('SELECT COUNT(*) AS count FROM gyms')).toEqual({ count: 1 });
        expect(await database.allSql('SELECT * FROM mutation_receipts WHERE userId = ?', [bobId])).toEqual([]);

        // Bob's active session is gone.
        const me = await request('GET', '/api/auth/me', { cookie: bobCookie });
        expect(me.status).toBe(401);
    });
});
