import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountDatabase, clearLegacyCacheOnce } from '@/db/db';
import { hydrateFromServer } from '@/db/hydrate';
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
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, callback: () => Promise<void>) => callback() } });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
        await flushPendingMutations(db);
        expect((await db.outbox.orderBy('sequence').first())?.command).toEqual(before?.command);
        const delivered: Array<{ expectedRevision: number | null }> = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
            const command = JSON.parse(options.body); delivered.push(command);
            return { ok: true, json: async () => ({ ...db.binding, mutationId: command.mutationId,
                revision: delivered.length, accountGeneration: delivered.length, catalogGeneration: 1 }) };
        }));
        await flushPendingMutations(db);
        expect(delivered.map(command => command.expectedRevision)).toEqual([null, 1]);
        expect(await db.outbox.count()).toBe(0);
        expect((await db.workouts.get(id!))?.revision).toBe(2);
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
