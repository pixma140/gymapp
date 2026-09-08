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

describe('sync authorization and scoping', () => {
    let adminCookie;
    let userCookie;
    let adminId;
    let userId;

    it('bootstraps the first admin via setup', async () => {
        const results = await Promise.all(['admin', 'otheradmin'].map(username => request('POST', '/api/setup', {
            body: { username, password: 'adminpassword', name: 'Admin' },
        })));
        expect(results.map(result => result.status).sort()).toEqual([200, 409]);
        expect(results.find(result => result.status === 409).body.error).toBe('already_setup');
        expect(await database.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 1 });
        const res = results.find(result => result.status === 200);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        adminCookie = res.cookie;
        adminId = res.body.user.id;
        expect(adminCookie).toBeTruthy();
    });

    it('registers and logs in a second user', async () => {
        const reg = await request('POST', '/api/auth/register', {
            body: { username: 'bob', password: 'bobpassword' },
        });
        expect(reg.status).toBe(200);
        userCookie = reg.cookie;
        userId = reg.body.user.id;
        expect(userId).not.toBe(adminId);
    });

    it('rejects unauthenticated sync mutations', async () => {
        const res = await request('POST', '/api/sync', {
            body: { table: 'gyms', operation: 'upsert', data: { id: 1, name: 'X', lastVisited: 0, visitCount: 0 } },
        });
        expect(res.status).toBe(401);
    });

    it('rejects unknown tables', async () => {
        const res = await request('POST', '/api/sync', {
            cookie: adminCookie,
            body: { table: 'sessions', operation: 'upsert', data: { id: 1 } },
        });
        expect(res.status).toBe(400);
    });

    it('scopes upserts to the authenticated user even if a foreign userId is sent', async () => {
        // Bob tries to write a gym claiming it belongs to the admin.
        const res = await request('POST', '/api/sync', {
            cookie: userCookie,
            body: {
                table: 'gyms',
                operation: 'upsert',
                data: { id: 1, userId: adminId, name: "Bob's Gym", lastVisited: 1, visitCount: 1 },
            },
        });
        expect(res.status).toBe(200);

        // The admin's snapshot must not contain Bob's row.
        const adminSnap = await request('GET', '/api/sync/snapshot', { cookie: adminCookie });
        expect(adminSnap.body.tables.gyms).toHaveLength(0);

        // Bob's snapshot owns it, attributed to Bob (not the admin).
        const bobSnap = await request('GET', '/api/sync/snapshot', { cookie: userCookie });
        expect(bobSnap.body.tables.gyms).toHaveLength(1);
        expect(bobSnap.body.tables.gyms[0].userId).toBe(userId);
        expect(bobSnap.body.tables.gyms[0].name).toBe("Bob's Gym");
    });

    it('allows the same id for different users without collision', async () => {
        const res = await request('POST', '/api/sync', {
            cookie: adminCookie,
            body: {
                table: 'gyms',
                operation: 'upsert',
                data: { id: 1, name: "Admin's Gym", lastVisited: 2, visitCount: 2 },
            },
        });
        expect(res.status).toBe(200);

        const adminSnap = await request('GET', '/api/sync/snapshot', { cookie: adminCookie });
        expect(adminSnap.body.tables.gyms).toHaveLength(1);
        expect(adminSnap.body.tables.gyms[0].name).toBe("Admin's Gym");

        const bobSnap = await request('GET', '/api/sync/snapshot', { cookie: userCookie });
        expect(bobSnap.body.tables.gyms[0].name).toBe("Bob's Gym");
    });

    it('does not let a user delete another user\'s row', async () => {
        // Bob deletes gym id=1; must only affect Bob's own copy.
        const del = await request('POST', '/api/sync', {
            cookie: userCookie,
            body: { table: 'gyms', operation: 'delete', id: 1 },
        });
        expect(del.status).toBe(200);

        const bobSnap = await request('GET', '/api/sync/snapshot', { cookie: userCookie });
        expect(bobSnap.body.tables.gyms).toHaveLength(0);

        // Admin's row survives.
        const adminSnap = await request('GET', '/api/sync/snapshot', { cookie: adminCookie });
        expect(adminSnap.body.tables.gyms).toHaveLength(1);
    });

    it('forbids workoutSets that reference a workout the user does not own', async () => {
        // Admin creates a workout (id=1).
        await request('POST', '/api/sync', {
            cookie: adminCookie,
            body: {
                table: 'workouts',
                operation: 'upsert',
                data: { id: 1, gymId: 1, startTime: 1, endTime: 2, duration: 1 },
            },
        });

        // Bob tries to attach a set to the admin's workout id=1.
        const res = await request('POST', '/api/sync', {
            cookie: userCookie,
            body: {
                table: 'workoutSets',
                operation: 'upsert',
                data: {
                    id: 1,
                    workoutId: 1,
                    exerciseId: 1,
                    type: 'working',
                    setNumber: 1,
                    weight: 100,
                    reps: 5,
                    timestamp: 1,
                },
            },
        });
        expect(res.status).toBe(403);
    });

    it('blocks a user from updating another user\'s profile', async () => {
        const res = await request('POST', '/api/sync', {
            cookie: userCookie,
            body: { table: 'users', operation: 'update', id: adminId, changes: { name: 'Hacked' } },
        });
        expect(res.status).toBe(403);
    });

    it('rejects profile-sync deletion for both roles without deleting either account', async () => {
        for (const [cookie, id] of [[adminCookie, adminId], [userCookie, userId]]) {
            const result = await request('POST', '/api/sync', {
                cookie, body: { table: 'users', operation: 'delete', id },
            });
            expect(result.status).toBe(403);
            expect(result.body.error).toBe('account_delete_requires_admin');
            expect((await request('GET', '/api/auth/me', { cookie })).status).toBe(200);
        }
    });

    it('rejects inherited table names before dispatch', async () => {
        for (const table of ['constructor', '__proto__', 'toString']) {
            const result = await request('POST', '/api/sync', {
                cookie: adminCookie, body: { table, operation: 'delete', id: adminId },
            });
            expect(result.status).toBe(400);
            expect(result.body.error).toBe('unsupported_table');
        }
    });
});
