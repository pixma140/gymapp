import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountDatabase, clearLegacyCacheOnce } from '@/db/db';
import { discardPendingChanges, hydrateFromServer, prepareAccountCache } from '@/db/hydrate';
import { applyOperation } from '@/db/operations';
import { flushPendingMutations } from '@/db/sqliteSync';
import type { Snapshot } from '@shared/commands';

const opened: AccountDatabase[] = [];
function fixture(accountId = 1, installationId = crypto.randomUUID()): { db: AccountDatabase; snapshot: Snapshot } {
    const db = new AccountDatabase({ accountId, installationId }); opened.push(db);
    return { db, snapshot: { accountId, installationId, accountGeneration: 0, catalogGeneration: 1,
        profile: { id: accountId, revision: 1, name: 'Test', email: null, weight: null, height: null, bodyFat: null, age: null, gender: null,
            reminderFrequency: 'never', language: 'en', theme: 'dark', mainColor: null },
        gyms: [{ id: crypto.randomUUID(), revision: 1, name: 'Shared', location: 'City', archived: false }], workouts: [], measurements: [] } };
}
afterEach(async () => {
    vi.unstubAllGlobals();
    for (const db of opened.splice(0)) await db.delete();
});

describe('account caches and transactional intent', () => {
    it('uses UUID-keyed, exercise-free stores isolated by account and installation', async () => {
        const first = fixture();
        const second = fixture(2, first.snapshot.installationId);
        const reset = fixture(1);
        await hydrateFromServer(first.db, first.snapshot);
        expect(await second.db.users.count()).toBe(0);
        expect(await reset.db.gyms.count()).toBe(0);
        expect(first.db.tables.map(table => table.name).sort()).toEqual(['gyms', 'outbox', 'syncMetadata', 'userMeasurements', 'users', 'workouts']);
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
        expect((await db.users.get(1))?.name).toBe('Offline edit');
        expect(await db.outbox.count()).toBe(1);
        await expect(hydrateFromServer(db, snapshot)).rejects.toThrow('pending_work');
        expect((await db.users.get(1))?.name).toBe('Offline edit');
    });
    it('atomically discards pending intent into a validated authoritative snapshot for only one account', async () => {
        const first = fixture();
        const second = fixture(2, first.snapshot.installationId);
        await hydrateFromServer(first.db, first.snapshot);
        await hydrateFromServer(second.db, second.snapshot);
        await applyOperation(first.db, 'profile.update', null, { name: 'Discard me' });
        await applyOperation(second.db, 'profile.update', null, { name: 'Keep me' });
        const authoritative = { ...first.snapshot, accountGeneration: 3,
            profile: { ...first.snapshot.profile, revision: 2, name: 'Server name' }, workouts: [{
                id: crypto.randomUUID(), revision: 1, gymId: first.snapshot.gyms[0].id, startTime: 10, endTime: 20,
            }] };
        const expected = (await first.db.outbox.toArray()).map(entry => entry.command.mutationId);
        await discardPendingChanges(first.db, authoritative, expected);
        expect(await first.db.outbox.count()).toBe(0);
        expect((await first.db.users.get(1))?.name).toBe('Server name');
        expect(await first.db.workouts.toArray()).toEqual(authoritative.workouts);
        expect(await first.db.syncMetadata.get('state')).toMatchObject({ accountGeneration: 3, catalogGeneration: 1 });
        expect((await second.db.users.get(2))?.name).toBe('Keep me');
        expect(await second.db.outbox.count()).toBe(1);
    });
    it('leaves optimistic rows and commands untouched when discard validation or replacement fails', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Keep local' });
        const before = await db.outbox.toArray();
        const expected = before.map(entry => entry.command.mutationId);
        await expect(discardPendingChanges(db, { ...snapshot, gyms: [{ ...snapshot.gyms[0], archived: 'false' }] } as unknown as Snapshot, expected))
            .rejects.toThrow('invalid_snapshot');
        await expect(discardPendingChanges(db, { ...snapshot, accountId: 2, profile: { ...snapshot.profile, id: 2 } }, expected))
            .rejects.toThrow('account_binding_mismatch');
        const put = vi.spyOn(db.users, 'put').mockRejectedValueOnce(new Error('replacement_failed'));
        await expect(discardPendingChanges(db, snapshot, expected)).rejects.toThrow('replacement_failed');
        put.mockRestore();
        expect((await db.users.get(1))?.name).toBe('Keep local');
        expect(await db.outbox.toArray()).toEqual(before);
    });
    it('aborts discard if another tab adds pending intent after confirmation', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Originally confirmed' });
        const expected = (await db.outbox.toArray()).map(entry => entry.command.mutationId);
        await applyOperation(db, 'profile.update', null, { weight: 80 });
        await expect(discardPendingChanges(db, snapshot, expected)).rejects.toThrow('pending_work_changed');
        expect((await db.users.get(1))?.name).toBe('Originally confirmed');
        expect((await db.users.get(1))?.weight).toBe(80);
        expect(await db.outbox.count()).toBe(2);
    });
    it('rolls back both local state and outgoing intent on transaction failure', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        await expect(db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox], async () => {
            await applyOperation(db, 'profile.update', null, { name: 'Must roll back' });
            throw new Error('abort');
        })).rejects.toThrow('abort');
        expect((await db.users.get(1))?.name).toBe('Test');
        expect(await db.outbox.count()).toBe(0);
    });
    it('clears only the known legacy cache once, preserving unrelated browser storage', async () => {
        await Dexie.delete('GymAppCacheControl');
        const legacy = new Dexie('GymAppDB'); legacy.version(1).stores({ old: 'id' });
        const unrelated = new Dexie('OtherApp'); unrelated.version(1).stores({ data: 'id' });
        try {
            await legacy.table('old').put({ id: 1 }); legacy.close();
            await unrelated.table('data').put({ id: 1 });
            await clearLegacyCacheOnce();
            expect(await Dexie.exists('GymAppDB')).toBe(false);
            expect(await unrelated.table('data').count()).toBe(1);
            await legacy.open(); await legacy.table('old').put({ id: 2 }); legacy.close();
            await clearLegacyCacheOnce();
            expect(await Dexie.exists('GymAppDB')).toBe(true);
        } finally { await legacy.delete(); await unrelated.delete(); await Dexie.delete('GymAppCacheControl'); }
    });
    it('retains an ambiguous command unchanged and propagates acknowledgement revisions to dependent edits', async () => {
        const { db, snapshot } = fixture();
        await hydrateFromServer(db, snapshot);
        const id = await applyOperation(db, 'workout.start', null, { gymId: snapshot.gyms[0].id, startTime: 10 });
        await applyOperation(db, 'workout.finish', id, { endTime: 20 });
        const before = await db.outbox.orderBy('sequence').first();
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
        await flushPendingMutations(db);
        expect((await db.outbox.orderBy('sequence').first())?.command).toEqual(before?.command);
        const delivered: Array<{ expectedRevision: number | null }> = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
            const command = JSON.parse(options.body); delivered.push(command);
            return { ok: true, json: async () => ({ ok: true, ...db.binding, mutationId: command.mutationId,
                revision: delivered.length, accountGeneration: delivered.length, catalogGeneration: 1 }) };
        }));
        await flushPendingMutations(db);
        expect(delivered.map(command => command.expectedRevision)).toEqual([null, 1]);
        expect(await db.outbox.count()).toBe(0);
        expect((await db.workouts.get(id!))?.revision).toBe(2);
    });
    it('distinguishes an empty account from malformed hydration without erasing cached data', async () => {
        const { db, snapshot } = fixture();
        expect(await prepareAccountCache(db, snapshot)).toEqual({ status: 'empty' });
        await applyOperation(db, 'profile.update', null, { name: 'Keep local intent' });
        const malformed = { ...snapshot, gyms: [{ ...snapshot.gyms[0], archived: 'false' }] };
        expect((await prepareAccountCache(db, malformed as unknown as Snapshot)).status).toBe('error');
        expect((await db.users.get(1))?.name).toBe('Keep local intent');
        expect(await db.outbox.count()).toBe(1);
        expect((await prepareAccountCache(db, snapshot)).status).toBe('success');
        expect((await db.users.get(1))?.name).toBe('Keep local intent');
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
        const next = fixture(2, snapshot.installationId);
        await hydrateFromServer(db, snapshot);
        await hydrateFromServer(next.db, next.snapshot);
        await applyOperation(db, 'profile.update', null, { name: 'Confirmed edit' });
        let active = true;
        let release!: () => void;
        const responseGate = new Promise<void>(resolve => { release = resolve; });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) =>
            (args.at(-1) as () => Promise<void>)() } });
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
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
        expect((await db.users.get(1))?.revision).toBe(2);
        expect((await db.syncMetadata.get('state'))?.accountGeneration).toBe(1);
        expect(await next.db.outbox.count()).toBe(0);
        expect(await next.db.users.get(2)).toEqual(next.snapshot.profile);
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
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error }), { status: Number(status) }));
        vi.stubGlobal('fetch', fetch);
        await flushPendingMutations(db);
        await flushPendingMutations(db);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect((await db.outbox.toArray())[0]).toMatchObject({ state, error, command: before });
        expect((await db.users.get(1))?.name).toBe('Keep rejected intent');
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
