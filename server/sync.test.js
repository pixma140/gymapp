import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { EXERCISES } from '../shared/exercises.js';

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
    accountId: userId, installationId, mutationId: uuidv7(), operation,
    targetId: operation === 'profile.update' ? null : uuidv7(), expectedRevision: null, payload, ...options,
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
            body: { username, password: randomUUID(), name: 'Admin' },
        })));
        expect(results.map(result => result.status).sort()).toEqual([200, 409]);
        expect(await database.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 1 });
        const result = results.find(result => result.status === 200);
        adminCookie = result.cookie; adminId = result.body.user.id;
        const user = await request('POST', '/api/auth/register', { body: { username: 'regular', password: randomUUID() } });
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
    it('authenticates before dispatch and rejects malformed or unknown commands', async () => {
        expect((await request('POST', '/api/sync', { body: {} })).status).toBe(401);
        for (const body of [{ table: 'users', operation: 'delete', id: userId }, { operation: { toString: 'invalid' } }, { operation: 'constructor' }, { operation: '__proto__' }, { operation: 'exercise.create' }]) {
            expect((await send(body)).status).toBe(400);
        }
        expect((await request('GET', '/api/auth/me', { cookie: userCookie })).status).toBe(200);
    });
    it('binds delivery to both the installation and authenticated account', async () => {
        for (const options of [{ accountId: adminId }, { installationId: uuidv7() }]) {
            const result = await send(command('profile.update', { name: 'Wrong' }, { expectedRevision: 1, ...options }));
            expect(result.body.error).toBe('account_binding_mismatch');
        }
    });
    it('rejects non-v7 command IDs before mutation', async () => {
        expect((await send({ ...command('profile.update', { name: 'Invalid' }, { expectedRevision: 1 }), accountId: 1 })).body.error).toBe('invalid_binding');
        const invalidIds = [randomUUID(), '00000000-0000-7000-c000-000000000001'];
        for (const id of invalidIds) {
            const measurement = command('measurement.create', { weight: 80, bodyFat: null, timestamp: 1 });
            for (const field of ['accountId', 'installationId', 'mutationId', 'targetId']) {
                const result = await send({ ...measurement, [field]: id });
                expect(result.status).toBe(400);
                expect(result.body.error).toBe(field === 'targetId' ? 'invalid_target' : 'invalid_binding');
            }
            const workout = await send(command('workout.start', { gymId: id, startTime: 1 }));
            expect(workout.status).toBe(400);
            expect(workout.body.error).toBe('invalid_payload');
        }
        expect((await snapshot(userCookie)).body.measurements).toEqual([]);
    });
    it('restricts shared gym writes to current administrators', async () => {
        const create = command('gym.create', { name: 'Shared Gym', location: 'City' });
        expect((await send(create)).status).toBe(403);
        const result = await send({ ...create, accountId: adminId }, adminCookie);
        expect(result.status).toBe(200); gymId = create.targetId;
        const [admin, user] = await Promise.all([snapshot(adminCookie), snapshot(userCookie)]);
        expect(user.body.gyms).toEqual(admin.body.gyms);
        expect(user.body.gyms[0].id).toBe(gymId);
        expect(user.body.workoutExercises).toEqual([]);
        for (const [operation, payload] of [['gym.update', { name: 'Hacked' }], ['gym.archive', { archived: true }]]) {
            expect((await send(command(operation, payload, { targetId: gymId, expectedRevision: 1 }))).status).toBe(403);
        }
    });
    it('exposes administrator catalog renames on the next user snapshot', async () => {
        const before = (await snapshot(userCookie)).body;
        const rename = command('gym.update', { name: 'Renamed Shared Gym' }, {
            targetId: gymId, expectedRevision: 1, accountId: adminId,
        });
        expect((await send(rename, adminCookie)).status).toBe(200);
        const after = (await snapshot(userCookie)).body;
        expect(after.gyms).toEqual((await snapshot(adminCookie)).body.gyms);
        expect(after.gyms[0]).toMatchObject({ id: gymId, name: 'Renamed Shared Gym', revision: 2 });
        expect(after.catalogGeneration).toBe(before.catalogGeneration + 1);
        expect(after.accountGeneration).toBe(before.accountGeneration);
    });
    it('applies private commands once, detects revision conflicts, and isolates snapshots', async () => {
        const starts = [10, 11].map(startTime => command('workout.start', { gymId, startTime }));
        const results = await Promise.all(starts.map(start => send(start)));
        expect(results.map(result => result.status).sort()).toEqual([200, 409]);
        const winner = results.findIndex(result => result.status === 200);
        const result = results[winner];
        const start = starts[winner];
        workoutId = start.targetId;
        expect(result.status).toBe(200); expect(result.body.revision).toBe(1);
        expect(results[1 - winner].body).toEqual({ ok: false, error: 'active_workout_exists' });
        expect(await database.getSql('SELECT COUNT(*) AS count FROM workouts WHERE userId = ? AND endTime IS NULL', [userId]))
            .toEqual({ count: 1 });
        expect((await database.getSql('SELECT id FROM workouts WHERE userId = ? AND endTime IS NULL', [userId])).id).toBe(workoutId);
        expect((await send(start)).body).toEqual(result.body);
        expect((await send({ ...start, payload: { gymId, startTime: start.payload.startTime + 1 } })).body.error).toBe('mutation_id_reused');
        const measurement = command('measurement.create', { weight: 80, bodyFat: 20, timestamp: 10 });
        expect((await send(measurement)).status).toBe(200);
        const beforeForeignDelete = (await snapshot(userCookie)).body;
        expect((await send(command('measurement.delete', {}, {
            targetId: measurement.targetId, expectedRevision: 1, accountId: adminId,
        }), adminCookie)).status).toBe(404);
        expect((await snapshot(userCookie)).body).toEqual(beforeForeignDelete);
        expect((await snapshot(adminCookie)).body.workouts).toEqual([]);
        expect((await snapshot(adminCookie)).body.measurements).toEqual([]);
        expect((await snapshot(userCookie)).body.workouts).toHaveLength(1);
        const foreign = command('workout.finish', { endTime: 20 }, { targetId: workoutId, expectedRevision: 1, accountId: adminId });
        expect((await send(foreign, adminCookie)).status).toBe(404);
        const profile = command('profile.update', { name: 'New name' }, { expectedRevision: 1 });
        expect((await send(profile)).body.revision).toBe(2);
        expect((await send({ ...profile, mutationId: uuidv7() })).body.error).toBe('revision_conflict');
        expect((await snapshot(userCookie)).body.accountGeneration).toBe(3);
    });
    it('records catalog exercise uses for only the active workout owner', async () => {
        const use = command('workoutExercise.create', { workoutId, exerciseId: EXERCISES[0].id });
        expect((await send({ ...use, payload: { workoutId, exerciseId: 'missing' } })).body.error).toBe('exercise_unavailable');
        expect((await send({ ...use, accountId: adminId }, adminCookie)).body.error).toBe('workout_unavailable');
        expect((await send(use)).status).toBe(200);
        expect((await send(command('workoutExercise.create', use.payload))).body.error).toBe('exercise_already_selected');
        expect((await snapshot(userCookie)).body.workoutExercises).toEqual([expect.objectContaining(use.payload)]);
        expect((await snapshot(adminCookie)).body.workoutExercises).toEqual([]);
    });
    it('rejects another active session and allows finishing at an archived gym', async () => {
        expect((await send(command('workout.start', { gymId, startTime: 11 }))).body.error).toBe('active_workout_exists');
        const archive = command('gym.archive', { archived: true }, { targetId: gymId, expectedRevision: 2, accountId: adminId });
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
        expect((await snapshot(userCookie)).body.workoutExercises).toEqual([]);
    });
    it('creates private custom exercises and validates revisioned sets in completed workouts', async () => {
        const custom = command('customExercise.create', { name: 'My press', muscleGroup: 'chest' });
        expect((await send(command('customExercise.create', { name: 'Bad', muscleGroup: 'unknown' }))).body.error).toBe('invalid_payload');
        expect((await send(custom)).status).toBe(200);
        expect((await snapshot(adminCookie)).body.customExercises).toEqual([]);
        const gym = command('gym.create', { name: 'Set test gym', location: '' }, { accountId: adminId });
        await send(gym, adminCookie);
        const start = command('workout.start', { gymId: gym.targetId, startTime: 100 });
        expect((await send(start)).status).toBe(200);
        await send(command('workout.finish', { endTime: 200 }, { targetId: start.targetId, expectedRevision: 1 }));
        const use = command('workoutExercise.create', { workoutId: start.targetId, exerciseId: custom.targetId });
        expect((await send(use)).status).toBe(200);
        const sets = [{ id: uuidv7(), weight: 20, reps: 12, type: 'warmup' }, { id: uuidv7(), weight: 80, reps: 8, type: 'working' }];
        const update = command('workoutExercise.update', { sets }, { targetId: use.targetId, expectedRevision: 1 });
        expect((await send({ ...update, accountId: adminId }, adminCookie)).status).toBe(404);
        for (const invalid of [{ ...sets[0], weight: -1 }, { ...sets[0], reps: 0 }, { ...sets[0], reps: 1.5 }, { ...sets[0], type: 'invalid' }, { ...sets[0], id: randomUUID() }]) {
            expect((await send({ ...update, payload: { sets: [invalid] } })).body.error).toBe('invalid_payload');
        }
        expect((await send({ ...update, payload: { sets: [sets[0], sets[0]] } })).body.error).toBe('invalid_payload');
        const result = await send(update);
        expect(result.body.revision).toBe(2);
        expect((await send(update)).body).toEqual(result.body);
        expect((await send({ ...update, mutationId: uuidv7() })).body.error).toBe('revision_conflict');
        expect((await snapshot(userCookie)).body.workoutExercises).toEqual([expect.objectContaining({ sets })]);
        const adminStart = command('workout.start', { gymId: gym.targetId, startTime: 100 }, { accountId: adminId });
        await send(adminStart, adminCookie);
        expect((await send(command('workoutExercise.create', { workoutId: adminStart.targetId, exerciseId: custom.targetId }, { accountId: adminId }), adminCookie)).body.error).toBe('exercise_unavailable');
        expect((await send(command('workoutExercise.delete', {}, { targetId: use.targetId, expectedRevision: 2 }))).status).toBe(200);
        expect((await snapshot(userCookie)).body.workoutExercises).toEqual([]);
    });
    it('rejects invalid values and privilege changes without advancing generations', async () => {
        const before = (await snapshot(userCookie)).body.accountGeneration;
        for (const payload of [{ weight: -1 }, { bodyFat: 101 }, { language: 'xx' }, { timeFormat: '25h' }, { timeFormat: null }, { timeFormat: 24 }, { theme: 'unknown' }, { name: '' }, { isAdmin: true }, { passwordHash: 'hacked' }]) {
            expect((await send(command('profile.update', payload, { expectedRevision: 2 }))).status).toBe(400);
        }
        expect((await snapshot(userCookie)).body.accountGeneration).toBe(before);
    });
    it('edits workout timestamps with ownership, revision, and chronology guards', async () => {
        const gym = command('gym.create', { name: 'Times gym', location: '' }, { accountId: adminId });
        await send(gym, adminCookie);
        const start = command('workout.start', { gymId: gym.targetId, startTime: 1000 });
        await send(start);
        const update = command('workout.update', { startTime: 900 }, { targetId: start.targetId, expectedRevision: 1 });
        expect((await send({ ...update, accountId: adminId }, adminCookie)).status).toBe(404);
        expect((await send({ ...update, payload: { startTime: 900, endTime: 1100 } })).body.error).toBe('invalid_workout_times');
        for (const payload of [{ endTime: 1100 }, { startTime: -1 }, { startTime: 1000, endTime: 900 }, { startTime: 900, endTime: null }]) {
            expect((await send({ ...update, payload })).body.error).toBe('invalid_payload');
        }
        expect((await send(update)).body.revision).toBe(2);
        await send(command('workout.finish', { endTime: 1500 }, { targetId: start.targetId, expectedRevision: 2 }));
        const edit = command('workout.update', { startTime: 800, endTime: 2000 }, { targetId: start.targetId, expectedRevision: 3 });
        const result = await send(edit);
        expect(result.body.revision).toBe(4);
        expect((await send(edit)).body).toEqual(result.body);
        expect((await send({ ...edit, mutationId: uuidv7() })).body.error).toBe('revision_conflict');
        expect((await send(command('workout.update', { startTime: 2500 }, { targetId: start.targetId, expectedRevision: 4 }))).body.error).toBe('invalid_workout_times');
        expect((await snapshot(userCookie)).body.workouts).toContainEqual(expect.objectContaining({ id: start.targetId, startTime: 800, endTime: 2000 }));
    });
    it('syncs each clock preference independently of language and isolates accounts', async () => {
        const adminBefore = (await snapshot(adminCookie)).body;
        expect((await snapshot(userCookie)).body.profile.timeFormat).toBe('system');
        for (const timeFormat of ['24h', '12h', 'system']) {
            const before = (await snapshot(userCookie)).body;
            const update = command('profile.update', { timeFormat }, { expectedRevision: before.profile.revision });
            expect((await send(update)).status).toBe(200);
            const after = (await snapshot(userCookie)).body;
            expect(after.profile).toEqual({ ...before.profile, timeFormat, revision: before.profile.revision + 1 });
            expect(after.accountGeneration).toBe(before.accountGeneration + 1);
            expect((await request('GET', '/api/bootstrap', { cookie: userCookie })).body.snapshot.profile.timeFormat).toBe(timeFormat);
        }
        expect((await snapshot(adminCookie)).body).toEqual(adminBefore);
    });
});
