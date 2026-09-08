import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createApp } from './app.js';
import { openDatabase } from './db.js';

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
    await database.initDatabase();
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

    it('deletes a user and their sessions', async () => {
        const res = await request('DELETE', `/api/admin/users/${bobId}`, { cookie: adminCookie });
        expect(res.status).toBe(200);

        const list = await request('GET', '/api/admin/users', { cookie: adminCookie });
        expect(list.body.users.find((u) => u.id === bobId)).toBeUndefined();

        // Bob's active session is gone.
        const me = await request('GET', '/api/auth/me', { cookie: bobCookie });
        expect(me.status).toBe(401);
    });
});
