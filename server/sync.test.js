import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const database = openDatabase(':memory:');
const { app } = createApp({ database });
let server, baseUrl, adminCookie, userCookie, adminId, userId, installationId;
async function request(method, route, { body, cookie } = {}) {
    const res = await fetch(`${baseUrl}${route}`, {
        method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] ?? cookie };
}
const command = (operation, payload, options = {}) => ({
    accountId: userId, installationId, mutationId: randomUUID(), operation,
    targetId: operation === 'profile.update' ? null : randomUUID(), expectedRevision: null, payload, ...options,
});
const send = (body, cookie = userCookie) => request('POST', '/api/sync', { body, cookie });
const snapshot = cookie => request('GET', '/api/sync/snapshot', { cookie });

beforeAll(async () => {
    await database.initDatabase({ seedDevData: false });
    ({ id: installationId } = await database.getSql('SELECT id FROM installation'));
    await new Promise((resolve, reject) => { server = app.listen(0, resolve); server.once('error', reject); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    await database.close();
});

describe('replacement sync contract', () => {
    let gymId, workoutId;
    it('bootstraps an empty installation without fabricating a session', async () => {
        const result = await request('GET', '/api/bootstrap');
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ ok: true, status: 'setup', installationId });
    });
    it('serializes concurrent first-admin setup', async () => {
        const results = await Promise.all(['admin', 'otheradmin'].map(username => request('POST', '/api/setup', {
            body: { username, password: 'adminpassword', name: 'Admin' },
        })));
        expect(results.map(result => result.status).sort()).toEqual([200, 409]);
        expect(await database.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 1 });
        const result = results.find(result => result.status === 200);
        adminCookie = result.cookie; adminId = result.body.user.id;
        const user = await request('POST', '/api/auth/register', { body: { username: 'regular', password: 'userpassword' } });
        userCookie = user.cookie; userId = user.body.user.id;
    });
    it('bootstraps scoped account data and current capabilities in one response', async () => {
        expect((await request('GET', '/api/bootstrap')).body).toEqual({ ok: true, status: 'signedOut', installationId });
        for (const [cookie, id, admin] of [[adminCookie, adminId, true], [userCookie, userId, false]]) {
            const { body } = await request('GET', '/api/bootstrap', { cookie });
            expect(body.status).toBe('authenticated');
            expect(body.installationId).toBe(installationId);
            expect(body.user.id).toBe(id);
            expect(body.capabilities).toEqual({ manageUsers: admin, manageOidc: admin, manageGyms: admin });
            expect(body.snapshot.accountId).toBe(id);
            expect(body.snapshot.profile.id).toBe(id);
            expect(body.snapshot.installationId).toBe(installationId);
        }
        expect((await request('GET', '/api/bootstrap', { cookie: 'gymapp_session=expired' })).body.status).toBe('signedOut');
    });
    it('authenticates before dispatch and rejects legacy/inherited commands', async () => {
        expect((await request('POST', '/api/sync', { body: {} })).status).toBe(401);
        for (const body of [{ table: 'users', operation: 'delete', id: userId }, { operation: { toString: 'invalid' } }, { operation: 'constructor' }, { operation: '__proto__' }, { operation: 'exercise.create' }]) {
            expect((await send(body)).status).toBe(400);
        }
        expect((await request('GET', '/api/auth/me', { cookie: userCookie })).status).toBe(200);
    });
    it('binds delivery to both the installation and authenticated account', async () => {
        for (const options of [{ accountId: adminId }, { installationId: randomUUID() }]) {
            const result = await send(command('profile.update', { name: 'Wrong' }, { expectedRevision: 1, ...options }));
            expect(result.body.error).toBe('account_binding_mismatch');
        }
    });
    it('restricts shared gym writes to current administrators', async () => {
        const create = command('gym.create', { name: 'Shared Gym', location: 'City' });
        expect((await send(create)).status).toBe(403);
        const result = await send({ ...create, accountId: adminId }, adminCookie);
        expect(result.status).toBe(200); gymId = create.targetId;
        const [admin, user] = await Promise.all([snapshot(adminCookie), snapshot(userCookie)]);
        expect(user.body.gyms).toEqual(admin.body.gyms);
        expect(user.body.gyms[0].id).toBe(gymId);
        expect(user.body).not.toHaveProperty('exercises');
        for (const [operation, payload] of [['gym.update', { name: 'Hacked' }], ['gym.archive', { archived: true }]]) {
            expect((await send(command(operation, payload, { targetId: gymId, expectedRevision: 1 }))).status).toBe(403);
        }
    });
    it('applies private commands once, detects revision conflicts, and isolates snapshots', async () => {
        const start = command('workout.start', { gymId, startTime: 10 }); workoutId = start.targetId;
        const result = await send(start);
        expect(result.status).toBe(200); expect(result.body.revision).toBe(1);
        expect((await send(start)).body).toEqual(result.body);
        expect((await send({ ...start, payload: { gymId, startTime: 11 } })).body.error).toBe('mutation_id_reused');
        const measurement = command('measurement.create', { weight: 80, bodyFat: 20, timestamp: 10 });
        expect((await send(measurement)).status).toBe(200);
        expect((await snapshot(adminCookie)).body.workouts).toEqual([]);
        expect((await snapshot(adminCookie)).body.measurements).toEqual([]);
        expect((await snapshot(userCookie)).body.workouts).toHaveLength(1);
        const foreign = command('workout.finish', { endTime: 20 }, { targetId: workoutId, expectedRevision: 1, accountId: adminId });
        expect((await send(foreign, adminCookie)).status).toBe(404);
        const profile = command('profile.update', { name: 'New name' }, { expectedRevision: 1 });
        expect((await send(profile)).body.revision).toBe(2);
        expect((await send({ ...profile, mutationId: randomUUID() })).body.error).toBe('revision_conflict');
        expect((await snapshot(userCookie)).body.accountGeneration).toBe(3);
    });
    it('rejects concurrent active sessions and allows finishing at an archived gym', async () => {
        expect((await send(command('workout.start', { gymId, startTime: 11 }))).body.error).toBe('active_workout_exists');
        const archive = command('gym.archive', { archived: true }, { targetId: gymId, expectedRevision: 1, accountId: adminId });
        expect((await send(archive, adminCookie)).status).toBe(200);
        expect((await send(command('workout.finish', { endTime: 9 }, { targetId: workoutId, expectedRevision: 1 }))).status).toBe(409);
        expect((await send(command('workout.finish', { endTime: 20 }, { targetId: workoutId, expectedRevision: 1 }))).body.revision).toBe(2);
        expect((await send(command('workout.start', { gymId, startTime: 30 }))).body.error).toBe('gym_unavailable');
    });
    it('replays deletes and never recreates deleted records through update', async () => {
        const deletion = command('workout.delete', {}, { targetId: workoutId, expectedRevision: 2 });
        const result = await send(deletion);
        expect(result.status).toBe(200);
        expect((await send(deletion)).body).toEqual(result.body);
        expect((await send(command('workout.finish', { endTime: 40 }, { targetId: workoutId, expectedRevision: 2 }))).status).toBe(404);
    });
    it('rejects invalid values and privilege changes without advancing generations', async () => {
        const before = (await snapshot(userCookie)).body.accountGeneration;
        for (const payload of [{ weight: -1 }, { bodyFat: 101 }, { language: 'xx' }, { theme: 'unknown' }, { name: '' }, { isAdmin: true }, { passwordHash: 'hacked' }]) {
            expect((await send(command('profile.update', payload, { expectedRevision: 2 }))).status).toBe(400);
        }
        expect((await snapshot(userCookie)).body.accountGeneration).toBe(before);
    });
});
