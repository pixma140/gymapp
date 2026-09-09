import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { AccountDatabase } from '@/db/db';
import { discardPendingChanges, hydrateFromServer, prepareAccountCache, resolvePendingConflict } from '@/db/hydrate';
import { applyOperation, updateProfileWithMeasurement, createAndSelectExercise, editWorkoutSets, startOrResumeWorkout } from '@/db/operations';
import { flushPendingMutations } from '@/db/sqliteSync';
import type { Snapshot } from '@shared/commands';
import { isUuid } from '@shared/commands';

const opened: AccountDatabase[] = [];
const ACCOUNT_A = uuidv7();
const ACCOUNT_B = uuidv7();
function fixture(accountId = ACCOUNT_A, installationId = uuidv7()): { db: AccountDatabase; snapshot: Snapshot } {
    const db = new AccountDatabase({ accountId, installationId }); opened.push(db);
    return { db, snapshot: { accountId, installationId, accountGeneration: 0, catalogGeneration: 1,
        profile: { id: accountId, revision: 1, name: 'Test', email: null, weight: null, height: null, bodyFat: null, age: null, gender: null,
            reminderFrequency: 'never', language: 'en', theme: 'dark', mainColor: null },
        gyms: [{ id: uuidv7(), revision: 1, name: 'Shared', location: 'City', archived: false }], workouts: [], workoutExercises: [], customExercises: [], measurements: [] } };
}
afterEach(async () => {
    vi.unstubAllGlobals();
    for (const db of opened.splice(0)) await db.delete();
});

describe('account caches and transactional intent', () => {
    it('updates workout times atomically and validates active and completed sessions', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const id = (await applyOperation(db, 'workout.start', null, { gymId: snapshot.gyms[0].id, startTime: 100 }))!;
        await applyOperation(db, 'workout.update', id, { startTime: 50 });
        await expect(applyOperation(db, 'workout.update', id, { startTime: 50, endTime: 200 })).rejects.toThrow('invalid_workout_times');
        await applyOperation(db, 'workout.finish', id, { endTime: 200 });
        await applyOperation(db, 'workout.update', id, { startTime: 75, endTime: 300 });
        const pending = await db.outbox.toArray();
        await expect(applyOperation(db, 'workout.update', id, { startTime: 400 })).rejects.toThrow('invalid_workout_times');
        await expect(applyOperation(db, 'workout.update', id, { startTime: 100, endTime: 90 })).rejects.toThrow('invalid_workout_times');
        await expect(applyOperation(db, 'workout.update', id, { startTime: NaN })).rejects.toThrow('invalid_payload');
        expect(await db.workouts.get(id)).toMatchObject({ startTime: 75, endTime: 300 });
        expect(await db.outbox.toArray()).toEqual(pending);
        expect(pending[3].dependency).toBe(pending[2].sequence);
    });
    it('starts only once for concurrent gym selections and resumes the existing workout', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const gymId = snapshot.gyms[0].id;
        expect(await Promise.all([startOrResumeWorkout(db, gymId), startOrResumeWorkout(db, gymId)])).toEqual([gymId, gymId]);
        expect(await db.workouts.count()).toBe(1);
        expect(await db.outbox.count()).toBe(1);
        expect(await startOrResumeWorkout(db, uuidv7())).toBe(gymId);
        expect(await db.outbox.count()).toBe(1);
    });
    it('does not queue a workout when selecting an unavailable gym', async () => {
        const { db, snapshot } = fixture();
        snapshot.gyms[0].archived = true;
        await hydrateFromServer(db, snapshot);
        await expect(startOrResumeWorkout(db, snapshot.gyms[0].id)).rejects.toThrow('gym_unavailable');
        await expect(startOrResumeWorkout(db, uuidv7())).rejects.toThrow('gym_unavailable');
        expect(await db.workouts.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });
    it('persists custom exercises and concurrent set additions, then cascades workout deletion', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const workoutId = (await applyOperation(db, 'workout.start', null, { gymId: snapshot.gyms[0].id, startTime: 10 }))!;
        await createAndSelectExercise(db, workoutId, { name: 'Custom press', muscleGroup: 'chest' });
        const exercise = (await db.workoutExercises.toArray())[0];
        const first = { id: uuidv7(), weight: 20, reps: 12, type: 'warmup' as const };
        const second = { id: uuidv7(), weight: 80, reps: 8, type: 'working' as const };
        await Promise.all([
            editWorkoutSets(db, exercise.id, sets => [...sets, first]),
            editWorkoutSets(db, exercise.id, sets => [...sets, second]),
        ]);
        db.close(); await db.open();
        expect((await db.workoutExercises.get(exercise.id))?.sets).toEqual([first, second]);
        const entries = await db.outbox.orderBy('sequence').toArray();
        expect(entries.map(entry => entry.intent.operation)).toEqual(['workout.start', 'customExercise.create', 'workoutExercise.create', 'workoutExercise.update', 'workoutExercise.update']);
        expect(entries[3].dependency).toBe(entries[2].sequence);
        expect(entries[4].dependency).toBe(entries[3].sequence);
        await expect(editWorkoutSets(db, exercise.id, sets => [...sets, { ...first, id: uuidv7(), reps: 0 }])).rejects.toThrow('invalid_payload');
        expect(await db.outbox.count()).toBe(5);
        await applyOperation(db, 'workout.delete', workoutId, {});
        expect(await db.workoutExercises.count()).toBe(0);
        expect(await db.customExercises.count()).toBe(1);
    });
    it('rolls back custom catalog creation when selecting it fails', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await expect(createAndSelectExercise(db, uuidv7(), { name: 'Orphan', muscleGroup: 'chest' })).rejects.toThrow('workout_unavailable');
        expect(await db.customExercises.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });
    it('hydrates custom exercises and sets and rejects malformed or dangling set data', async () => {
        const { db, snapshot } = fixture();
        const workoutId = uuidv7(), exerciseId = uuidv7();
        snapshot.workouts = [{ id: workoutId, gymId: snapshot.gyms[0].id, startTime: 10, endTime: 20, revision: 1 }];
        snapshot.customExercises = [{ id: exerciseId, name: 'Custom press', muscleGroup: 'chest', revision: 1 }];
        snapshot.workoutExercises = [{ id: uuidv7(), workoutId, exerciseId, revision: 1, sets: [{ id: uuidv7(), weight: 20, reps: 12, type: 'warmup' }] }];
        await hydrateFromServer(db, snapshot);
        expect(await db.workoutExercises.toArray()).toEqual(snapshot.workoutExercises);
        await expect(hydrateFromServer(db, { ...snapshot, customExercises: [] })).rejects.toThrow('invalid_snapshot');
        snapshot.workoutExercises[0].sets[0].reps = 0;
        await expect(hydrateFromServer(db, snapshot)).rejects.toThrow('invalid_snapshot');
        expect((await db.workoutExercises.toArray())[0].sets[0].reps).toBe(12);
    });
    it('creates time-ordered UUID v7 domain and mutation IDs and renews them on reapplication', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const start = Date.now();
        const ids: string[] = [];
        for (let index = 0; index < 32; index++) {
            const id = await applyOperation(db, 'measurement.create', null, { weight: 80, bodyFat: null, timestamp: index });
            ids.push(id!);
        }
        const pending = await db.outbox.orderBy('sequence').toArray();
        const generated = pending.flatMap(entry => [entry.intent.targetId!, entry.intent.mutationId]);
        const end = Date.now();
        expect(new Set(generated).size).toBe(64);
        expect(generated).toEqual([...generated].sort());
        for (const id of generated) {
            expect(isUuid(id)).toBe(true);
            const timestamp = Number.parseInt(id.slice(0, 13).replace('-', ''), 16);
            expect(timestamp).toBeGreaterThanOrEqual(start);
            expect(timestamp).toBeLessThanOrEqual(end);
        }
        expect((await db.userMeasurements.toArray()).map(row => row.id)).toEqual(ids);
        await db.outbox.update(pending[0].sequence, { state: 'conflict' });
        await resolvePendingConflict(db, snapshot, pending.map(entry => entry.intent.mutationId), 'reapply');
        const reapplied = await db.outbox.orderBy('sequence').toArray();
        expect(reapplied.map(entry => entry.intent.targetId)).toEqual(ids);
        for (const entry of reapplied) {
            expect(isUuid(entry.intent.mutationId)).toBe(true);
            expect(generated).not.toContain(entry.intent.mutationId);
        }
    });
    it('rejects non-v7 account bindings and snapshot record IDs', async () => {
        const { db, snapshot } = fixture();
        const invalidIds = [crypto.randomUUID(), '00000000-0000-7000-c000-000000000001',
            '00000000-0000-7000-8000-00000000000G', '00000000000070008000000000000001'];
        for (const id of invalidIds) {
            expect(() => new AccountDatabase({ accountId: ACCOUNT_A, installationId: id })).toThrow('invalid_account_binding');
            expect(() => new AccountDatabase({ accountId: id, installationId: snapshot.installationId })).toThrow('invalid_account_binding');
            await expect(hydrateFromServer(db, { ...snapshot, gyms: [{ ...snapshot.gyms[0], id }] })).rejects.toThrow('invalid_snapshot');
        }
        expect(await db.gyms.count()).toBe(0);
    });
    it('uses UUID-keyed account stores isolated by account and installation', async () => {
        const first = fixture();
        const second = fixture(ACCOUNT_B, first.snapshot.installationId);
        const reset = fixture(ACCOUNT_A);
        await hydrateFromServer(first.db, first.snapshot);
        expect(await second.db.users.count()).toBe(0);
        expect(await reset.db.gyms.count()).toBe(0);
        expect(first.db.tables.map(table => table.name).sort()).toEqual(['customExercises', 'gyms', 'outbox', 'syncMetadata', 'userMeasurements', 'users', 'workoutExercises', 'workouts']);
        expect(first.db.verno).toBe(1);
        expect(first.db.gyms.schema.primKey.auto).toBeFalsy();
        expect(first.db.outbox.schema.primKey.auto).toBe(true);
        await expect(hydrateFromServer(second.db, first.snapshot)).rejects.toThrow('account_binding_mismatch');
    });
    it('preserves pending local work over reload and blocks snapshot replacement', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Offline edit' });
        db.close(); await db.open();
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Offline edit');
        expect(await db.outbox.count()).toBe(1);
        await expect(hydrateFromServer(db, snapshot)).rejects.toThrow('pending_work');
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Offline edit');
    });
    it('delivers persisted offline intent once after reopening the account cache', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Persisted edit' });
        const queued = (await db.outbox.toArray())[0].intent;
        const previousSuccessfulSync = (await db.syncMetadata.get('state'))!.lastSuccessfulSync;
        db.close();
        await db.open();
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) =>
            (args.at(-1) as () => Promise<void>)() } });
        const delivery = vi.fn(async (_url: unknown, options?: RequestInit) => {
            const sent = JSON.parse(String(options?.body));
            expect(sent).toMatchObject({ ...queued, ...db.binding, expectedRevision: 1 });
            return new Response(JSON.stringify({ ok: true, ...db.binding, mutationId: sent.mutationId,
                revision: 2, accountGeneration: 1, catalogGeneration: 1 }));
        });
        vi.stubGlobal('fetch', vi.fn((url: unknown, options?: RequestInit) => String(url).endsWith('/snapshot')
            ? Promise.resolve(new Response(JSON.stringify({ ok: true, ...snapshot })))
            : delivery(url, options)));
        vi.spyOn(Date, 'now').mockReturnValue(previousSuccessfulSync + 1);
        await flushPendingMutations(db);
        await flushPendingMutations(db);
        expect(delivery).toHaveBeenCalledTimes(1);
        expect(await db.outbox.count()).toBe(0);
        expect(await db.users.get(ACCOUNT_A)).toMatchObject({ name: 'Persisted edit', revision: 2 });
        expect((await db.syncMetadata.get('state'))?.lastSuccessfulSync).toBe(previousSuccessfulSync + 1);
    });
    it('atomically discards pending intent into a validated authoritative snapshot for only one account', async () => {
        const first = fixture();
        const second = fixture(ACCOUNT_B, first.snapshot.installationId);
        await hydrateFromServer(first.db, first.snapshot);
        await hydrateFromServer(second.db, second.snapshot);
        await applyOperation(first.db, 'profile.update', null, { name: 'Discard me' });
        await applyOperation(second.db, 'profile.update', null, { name: 'Keep me' });
        const authoritative = { ...first.snapshot, accountGeneration: 3,
            profile: { ...first.snapshot.profile, revision: 2, name: 'Server name' }, workouts: [{
                id: uuidv7(), revision: 1, gymId: first.snapshot.gyms[0].id, startTime: 10, endTime: 20,
            }] };
        const expected = (await first.db.outbox.toArray()).map(entry => entry.intent.mutationId);
        await discardPendingChanges(first.db, authoritative, expected);
        expect(await first.db.outbox.count()).toBe(0);
        expect((await first.db.users.get(ACCOUNT_A))?.name).toBe('Server name');
        expect(await first.db.workouts.toArray()).toEqual(authoritative.workouts);
        expect(await first.db.syncMetadata.get('state')).toMatchObject({ accountGeneration: 3, catalogGeneration: 1 });
        expect((await second.db.users.get(ACCOUNT_B))?.name).toBe('Keep me');
        expect(await second.db.outbox.count()).toBe(1);
    });
    it('leaves optimistic rows and commands untouched when discard validation or replacement fails', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Keep local' });
        const before = await db.outbox.toArray();
        const expected = before.map(entry => entry.intent.mutationId);
        await expect(discardPendingChanges(db, { ...snapshot, gyms: [{ ...snapshot.gyms[0], archived: 'false' }] } as unknown as Snapshot, expected))
            .rejects.toThrow('invalid_snapshot');
        await expect(discardPendingChanges(db, { ...snapshot, accountId: ACCOUNT_B, profile: { ...snapshot.profile, id: ACCOUNT_B } }, expected))
            .rejects.toThrow('account_binding_mismatch');
        const put = vi.spyOn(db.users, 'put').mockRejectedValueOnce(new Error('replacement_failed'));
        await expect(discardPendingChanges(db, snapshot, expected)).rejects.toThrow('replacement_failed');
        put.mockRestore();
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Keep local');
        expect(await db.outbox.toArray()).toEqual(before);
    });
    it('aborts discard if another tab adds pending intent after confirmation', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Originally confirmed' });
        const expected = (await db.outbox.toArray()).map(entry => entry.intent.mutationId);
        await applyOperation(db, 'profile.update', null, { weight: 80 });
        await expect(discardPendingChanges(db, snapshot, expected)).rejects.toThrow('pending_work_changed');
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Originally confirmed');
        expect((await db.users.get(ACCOUNT_A))?.weight).toBe(80);
        expect(await db.outbox.count()).toBe(2);
    });
    it('rolls back both local state and outgoing intent on transaction failure', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await expect(db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.customExercises, db.userMeasurements, db.outbox], async () => {
            await applyOperation(db, 'profile.update', null, { name: 'Must roll back' });
            throw new Error('abort');
        })).rejects.toThrow('abort');
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Test');
        expect(await db.outbox.count()).toBe(0);
    });
    it('records profile measurements and both intents in one transaction', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await updateProfileWithMeasurement(db, { name: 'Measured', weight: 80, bodyFat: 20 }, 10);
        expect(await db.users.get(ACCOUNT_A)).toMatchObject({ name: 'Measured', weight: 80, bodyFat: 20 });
        expect(await db.userMeasurements.toArray()).toEqual([
            expect.objectContaining({ weight: 80, bodyFat: 20, timestamp: 10, revision: 0 }),
        ]);
        const intents = await db.outbox.orderBy('sequence').toArray();
        expect(intents.map(entry => entry.intent.operation)).toEqual(['profile.update', 'measurement.create']);
        expect(intents[1].dependency).toBe(intents[0].sequence);
    });
    it('rolls back a profile edit when its measurement intent is invalid', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await expect(updateProfileWithMeasurement(db, { name: 'Must roll back', weight: 80 }, Number.NaN))
            .rejects.toThrow('invalid_payload');
        expect(await db.users.get(ACCOUNT_A)).toEqual(snapshot.profile);
        expect(await db.userMeasurements.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });
    it('discards the measurement intent with its rejected profile edit', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await updateProfileWithMeasurement(db, { weight: 80 }, 10);
        const pending = await db.outbox.orderBy('sequence').toArray();
        await db.outbox.update(pending[0].sequence, { state: 'conflict', error: 'revision_conflict' });
        await resolvePendingConflict(db, snapshot, pending.map(entry => entry.intent.mutationId), 'discard');
        expect(await db.users.get(ACCOUNT_A)).toEqual(snapshot.profile);
        expect(await db.userMeasurements.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });
    it('preserves the profile-to-measurement dependency when reapplying', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await updateProfileWithMeasurement(db, { weight: 80 }, 10);
        const pending = await db.outbox.orderBy('sequence').toArray();
        await db.outbox.update(pending[0].sequence, { state: 'conflict', error: 'revision_conflict' });
        await resolvePendingConflict(db, snapshot, pending.map(entry => entry.intent.mutationId), 'reapply');
        const reapplied = await db.outbox.orderBy('sequence').toArray();
        expect(reapplied.map(entry => entry.intent.operation)).toEqual(['profile.update', 'measurement.create']);
        expect(reapplied[1].dependency).toBe(reapplied[0].sequence);
    });
    it('retains an ambiguous command unchanged and propagates acknowledgement revisions to dependent edits', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const id = await applyOperation(db, 'workout.start', null, { gymId: snapshot.gyms[0].id, startTime: 10 });
        await applyOperation(db, 'workout.finish', id, { endTime: 20 });
        const before = await db.outbox.orderBy('sequence').first();
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn(async url => {
            if (String(url).endsWith('/snapshot')) return new Response(JSON.stringify({ ok: true, ...snapshot }));
            throw new Error('network');
        }));
        await flushPendingMutations(db);
        expect((await db.outbox.orderBy('sequence').first())?.command).toEqual(before?.command);
        await db.outbox.update(before!.sequence, { nextAttemptAt: Date.now() - 1 });
        const delivered: Array<{ expectedRevision: number | null }> = [];
        vi.stubGlobal('fetch', vi.fn(async (url, options) => {
            if (String(url).endsWith('/snapshot')) return new Response(JSON.stringify({ ok: true, ...snapshot,
                accountGeneration: delivered.length }));
            const command = JSON.parse(options.body); delivered.push(command);
            return { ok: true, json: async () => ({ ok: true, ...db.binding, mutationId: command.mutationId,
                revision: delivered.length, accountGeneration: delivered.length, catalogGeneration: 1 }) };
        }));
        await flushPendingMutations(db);
        expect(delivered.map(command => command.expectedRevision)).toEqual([null, 1]);
        expect(await db.outbox.count()).toBe(0);
        expect((await db.workouts.get(id!))?.revision).toBe(2);
    });
    it('keeps dependent intent unprepared until the acknowledged server revision is known', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'First' });
        await applyOperation(db, 'profile.update', null, { weight: 80 });
        const entries = await db.outbox.orderBy('sequence').toArray();
        expect(entries[0].command).toMatchObject({ expectedRevision: 1, payload: { name: 'First' } });
        expect(entries[1]).toMatchObject({ dependency: entries[0].sequence, command: null, attempts: 0 });
        expect(entries[1].intent.payload).toEqual({ weight: 80 });
    });
    it('backs transient failures off durably and honors Retry-After', async () => {
        const now = Date.now();
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Retry later' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        const fetch = vi.fn(async (url: string) => String(url).endsWith('/snapshot')
            ? new Response(JSON.stringify({ ok: true, ...snapshot }))
            : new Response(JSON.stringify({ ok: false, error: 'too_many_requests' }), { status: 429, headers: { 'Retry-After': '7' } }));
        vi.stubGlobal('fetch', fetch);
        await flushPendingMutations(db);
        const entry = (await db.outbox.toArray())[0];
        expect(entry).toMatchObject({ state: 'pending', attempts: 1, preflightAttempts: 0 });
        expect(entry.nextAttemptAt).toBeGreaterThanOrEqual(now + 7000);
        await flushPendingMutations(db);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it('backs generation preflight failures off before retrying', async () => {
        const now = Date.now();
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Preflight later' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'too_many_requests' }), {
            status: 429, headers: { 'Retry-After': '7' },
        }));
        vi.stubGlobal('fetch', fetch);
        await flushPendingMutations(db);
        expect((await db.outbox.toArray())[0]).toMatchObject({ state: 'pending', attempts: 0, preflightAttempts: 1 });
        expect((await db.outbox.toArray())[0].nextAttemptAt).toBeGreaterThanOrEqual(now + 7000);
        await flushPendingMutations(db);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('blocks a clean unsent queue when the server generation changed', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Stale local edit' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        const changed = { ...snapshot, accountGeneration: 1,
            profile: { ...snapshot.profile, revision: 2, name: 'Other device' } };
        const fetch = vi.fn(async (url: string) => String(url).endsWith('/snapshot')
            ? new Response(JSON.stringify({ ok: true, ...changed }))
            : new Response(JSON.stringify({ ok: true })));
        vi.stubGlobal('fetch', fetch);
        await flushPendingMutations(db);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect((await db.outbox.toArray())[0]).toMatchObject({ state: 'conflict', attempts: 0, error: 'generation_conflict' });
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Stale local edit');
    });
    it('marks the affected domain intent when a mixed queue has one stale generation', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Private edit' });
        await applyOperation(db, 'gym.update', snapshot.gyms[0].id, { name: 'Catalog edit' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, ...snapshot, catalogGeneration: 2,
            gyms: [{ ...snapshot.gyms[0], revision: 2, name: 'Remote catalog' }] }))));
        await flushPendingMutations(db);
        const entries = await db.outbox.orderBy('sequence').toArray();
        expect(entries[0].state).toBe('pending');
        expect(entries[1]).toMatchObject({ state: 'conflict', error: 'generation_conflict' });
    });
    it('marks every stale domain intent and discards them without rebasing unrelated work', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Private edit' });
        const measurementId = await applyOperation(db, 'measurement.create', null, { weight: 80, bodyFat: null, timestamp: 10 });
        await applyOperation(db, 'gym.update', snapshot.gyms[0].id, { name: 'Catalog edit' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        const changed = { ...snapshot, accountGeneration: 2,
            profile: { ...snapshot.profile, revision: 2, name: 'Remote profile' } };
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, ...changed }))));
        await flushPendingMutations(db);
        const conflicted = await db.outbox.orderBy('sequence').toArray();
        expect(conflicted.map(entry => entry.state)).toEqual(['conflict', 'conflict', 'pending']);
        await resolvePendingConflict(db, changed, conflicted.map(entry => entry.intent.mutationId), 'discard');
        const remaining = await db.outbox.toArray();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].intent.operation).toBe('gym.update');
        expect(await db.userMeasurements.get(measurementId!)).toBeUndefined();
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Remote profile');
        expect((await db.gyms.get(snapshot.gyms[0].id))?.name).toBe('Catalog edit');
    });
    it('does not advance the unrelated generation after an acknowledgement', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Private edit' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn(async (url, options) => {
            if (String(url).endsWith('/snapshot')) return new Response(JSON.stringify({ ok: true, ...snapshot }));
            const command = JSON.parse(String(options?.body));
            return new Response(JSON.stringify({ ok: true, ...db.binding, mutationId: command.mutationId,
                revision: 2, accountGeneration: 1, catalogGeneration: 5 }));
        }));
        await flushPendingMutations(db);
        expect(await db.syncMetadata.get('state')).toMatchObject({ accountGeneration: 1, catalogGeneration: 1 });
    });
    it('retains an unchanged envelope after a malformed acknowledgement', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Ambiguous edit' });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).endsWith('/snapshot')
            ? new Response(JSON.stringify({ ok: true, ...snapshot })) : new Response('{"ok":true}')));
        await flushPendingMutations(db);
        const entry = (await db.outbox.toArray())[0];
        expect(entry).toMatchObject({ state: 'pending', attempts: 1, error: 'invalid_response' });
        expect(entry.command?.mutationId).toBe(entry.intent.mutationId);
    });
    it.each(['discard', 'reapply'] as const)('resolves a conflict by %s with an atomic authoritative replacement', async resolution => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Reviewed' });
        await applyOperation(db, 'profile.update', null, { weight: 80 });
        const before = await db.outbox.orderBy('sequence').toArray();
        await db.outbox.update(before[0].sequence, { state: 'conflict', error: 'revision_conflict' });
        const authoritative = { ...snapshot, accountGeneration: 4,
            profile: { ...snapshot.profile, revision: 3, name: 'Server' } };
        await resolvePendingConflict(db, authoritative, before.map(entry => entry.intent.mutationId), resolution);
        const after = await db.outbox.orderBy('sequence').toArray();
        if (resolution === 'discard') {
            expect(after).toHaveLength(0);
            expect(await db.users.get(ACCOUNT_A)).toMatchObject({ name: 'Server', weight: null, revision: 3 });
        } else {
            expect(after).toHaveLength(2);
            expect(after.map(entry => entry.intent.mutationId)).not.toEqual(before.map(entry => entry.intent.mutationId));
            expect(after[0].command).toMatchObject({ expectedRevision: 3, payload: { name: 'Reviewed' } });
            expect(after[1]).toMatchObject({ dependency: after[0].sequence, command: null });
            expect(await db.users.get(ACCOUNT_A)).toMatchObject({ name: 'Reviewed', weight: 80, revision: 3 });
        }
    });
    it('discards a workout that depends on a rejected offline gym create', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const gymId = await applyOperation(db, 'gym.create', null, { name: 'Offline gym', location: 'Local' });
        await applyOperation(db, 'workout.start', null, { gymId: gymId!, startTime: 10 });
        const entries = await db.outbox.orderBy('sequence').toArray();
        expect(entries[1]).toMatchObject({ dependency: entries[0].sequence, revisionDependency: false });
        expect(entries[1].command).toMatchObject({ operation: 'workout.start', expectedRevision: null });
        await db.outbox.update(entries[0].sequence, { state: 'conflict', error: 'record_exists' });
        await resolvePendingConflict(db, snapshot, entries.map(entry => entry.intent.mutationId), 'discard');
        expect(await db.outbox.count()).toBe(0);
        expect(await db.gyms.get(gymId!)).toBeUndefined();
        expect(await db.workouts.count()).toBe(0);
    });
    it('distinguishes an empty account from malformed hydration without erasing cached data', async () => {
        const { db, snapshot } = fixture();
        expect(await prepareAccountCache(db, snapshot)).toEqual({ status: 'empty' });
        await applyOperation(db, 'profile.update', null, { name: 'Keep local intent' });
        const malformed = { ...snapshot, gyms: [{ ...snapshot.gyms[0], archived: 'false' }] };
        expect((await prepareAccountCache(db, malformed as unknown as Snapshot)).status).toBe('error');
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Keep local intent');
        expect(await db.outbox.count()).toBe(1);
        expect((await prepareAccountCache(db, snapshot)).status).toBe('success');
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Keep local intent');
    });
    it('does not send when a lifecycle change happens while waiting for a lock', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Paused edit' });
        let active = true;
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => {
            active = false;
            return (args.at(-1) as () => Promise<void>)();
        } } });
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        await flushPendingMutations(db, () => active);
        expect(fetch).not.toHaveBeenCalled();
        expect((await db.outbox.toArray())[0].attempts).toBe(0);
    });
    it('applies a confirmed acknowledgement to the detached account cache', async () => {
        const { db, snapshot } = fixture();
        const next = fixture(ACCOUNT_B, snapshot.installationId);
        await hydrateFromServer(db, snapshot);
        await hydrateFromServer(next.db, next.snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Confirmed edit' });
        let active = true;
        let release!: () => void;
        const responseGate = new Promise<void>(resolve => { release = resolve; });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) =>
            (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn(async (url, options) => {
            if (String(url).endsWith('/snapshot')) return new Response(JSON.stringify({ ok: true, ...snapshot }));
            const sent = JSON.parse(String(options?.body));
            active = false;
            await responseGate;
            return new Response(JSON.stringify({ ok: true, ...db.binding, mutationId: sent.mutationId,
                revision: 2, accountGeneration: 1, catalogGeneration: 1 }));
        }));
        const sending = flushPendingMutations(db, () => active);
        await vi.waitFor(() => expect(active).toBe(false));
        release();
        await sending;
        expect(await db.outbox.count()).toBe(0);
        expect((await db.users.get(ACCOUNT_A))?.revision).toBe(2);
        expect((await db.syncMetadata.get('state'))?.accountGeneration).toBe(1);
        expect(await next.db.outbox.count()).toBe(0);
        expect(await next.db.users.get(ACCOUNT_B)).toEqual(next.snapshot.profile);
    });
    it.each([
        [401, 'unauthorized', 'paused'], [403, 'forbidden', 'failed'],
        [409, 'account_binding_mismatch', 'paused'], [409, 'revision_conflict', 'conflict'],
        [400, 'invalid_payload', 'failed'],
    ])('retains and stops rejected intent for HTTP %s / %s', async (status, error, state) => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Keep rejected intent' });
        const before = (await db.outbox.toArray())[0].command;
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) =>
            (args.at(-1) as () => Promise<void>)() } });
        const fetch = vi.fn(async (url: string) => String(url).endsWith('/snapshot')
            ? new Response(JSON.stringify({ ok: true, ...snapshot }))
            : new Response(JSON.stringify({ ok: false, error }), { status: Number(status) }));
        vi.stubGlobal('fetch', fetch);
        await flushPendingMutations(db);
        await flushPendingMutations(db);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect((await db.outbox.toArray())[0]).toMatchObject({ state, error, command: before });
        expect((await db.users.get(ACCOUNT_A))?.name).toBe('Keep rejected intent');
    });
    it('prevents concurrent local starts and leaves rejected validation out of the queue', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const results = await Promise.allSettled(Array.from({ length: 2 }, () => applyOperation(db, 'workout.start', null, { gymId: snapshot.gyms[0].id, startTime: 10 })));
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(await db.workouts.count()).toBe(1);
        expect(await db.outbox.count()).toBe(1);
        await expect(applyOperation(db, 'profile.update', null, { weight: NaN })).rejects.toThrow('invalid_payload');
        expect(await db.outbox.count()).toBe(1);
    });
});
