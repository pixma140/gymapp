import { isUuid, PROFILE_COLUMNS, validateCommand } from '@shared/commands';
import { ApiError, isObject } from '@/lib/api';
import type { Snapshot } from '@shared/commands';
import type { AccountDatabase } from './db';

const revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 1;
const generation = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const validPayload = (operation: string, payload: unknown) => validateCommand({
    mutationId: '00000000-0000-4000-8000-000000000001', installationId: '00000000-0000-4000-8000-000000000001',
    accountId: 1, operation, targetId: operation === 'profile.update' ? null : '00000000-0000-4000-8000-000000000001',
    expectedRevision: operation === 'profile.update' ? 1 : null, payload,
}) === null;
export function isSnapshot(value: unknown): value is Snapshot {
    if (!isObject(value) || !isUuid(value.installationId) || !Number.isSafeInteger(value.accountId) || Number(value.accountId) <= 0
        || !generation(value.accountGeneration) || !generation(value.catalogGeneration)
        || !isObject(value.profile) || value.profile.id !== value.accountId || !revision(value.profile.revision)
        || !Array.isArray(value.gyms) || !Array.isArray(value.workouts) || !Array.isArray(value.measurements)) return false;
    const profile = value.profile;
    if (!PROFILE_COLUMNS.every(key => Object.hasOwn(profile, key))
        || !validPayload('profile.update', Object.fromEntries(PROFILE_COLUMNS.map(key => [key, profile[key]])))) return false;
    const unique = (rows: unknown[]) => new Set(rows.map(row => isObject(row) ? row.id : null)).size === rows.length;
    if (![value.gyms, value.workouts, value.measurements].every(unique)) return false;
    if (!value.gyms.every(row => isObject(row) && isUuid(row.id) && revision(row.revision) && typeof row.archived === 'boolean'
        && validPayload('gym.create', { name: row.name, location: row.location }))) return false;
    const gyms = new Set(value.gyms.map(row => row.id));
    if (!value.workouts.every(row => isObject(row) && isUuid(row.id) && revision(row.revision) && gyms.has(row.gymId)
        && validPayload('workout.start', { gymId: row.gymId, startTime: row.startTime })
        && (row.endTime === null || (Number.isSafeInteger(row.endTime) && Number(row.endTime) >= Number(row.startTime))))) return false;
    return value.measurements.every(row => isObject(row) && isUuid(row.id) && revision(row.revision)
        && validPayload('measurement.create', { weight: row.weight, bodyFat: row.bodyFat, timestamp: row.timestamp }));
}

export type HydrationResult = { status: 'success' | 'empty' } | { status: 'error'; error: Error };
export async function prepareAccountCache(db: AccountDatabase, snapshot: Snapshot): Promise<HydrationResult> {
    try {
        if (!isSnapshot(snapshot)) throw new ApiError('malformed', 'invalid_snapshot');
        if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
        const pending = await db.outbox.orderBy('sequence').first();
        if (!pending) return await hydrateFromServer(db, snapshot);
        const metadata = await db.syncMetadata.get('state');
        if (!metadata || metadata.accountGeneration !== snapshot.accountGeneration || metadata.catalogGeneration !== snapshot.catalogGeneration) {
            await db.outbox.update(pending.sequence, { state: 'conflict', error: 'generation_conflict' });
        } else if (pending.state === 'paused') {
            await db.outbox.update(pending.sequence, { state: 'pending', error: undefined });
        }
        if (!await db.users.get(db.binding.accountId)) throw new Error('missing_cached_profile');
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error : new Error('cache_failed') };
    }
}

export async function hydrateFromServer(db: AccountDatabase, snapshot: Snapshot): Promise<{ status: 'success' | 'empty' }> {
    if (!isSnapshot(snapshot)) throw new ApiError('malformed', 'invalid_snapshot');
    if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
        if (await db.outbox.count()) throw new Error('pending_work');
        await replaceAccountData(db, snapshot);
    });
    return { status: snapshot.workouts.length || snapshot.measurements.length ? 'success' : 'empty' };
}

async function replaceAccountData(db: AccountDatabase, snapshot: Snapshot): Promise<void> {
    await Promise.all([db.users.clear(), db.gyms.clear(), db.workouts.clear(), db.userMeasurements.clear(), db.syncMetadata.clear()]);
    await db.users.put(snapshot.profile);
    await db.gyms.bulkPut(snapshot.gyms);
    await db.workouts.bulkPut(snapshot.workouts);
    await db.userMeasurements.bulkPut(snapshot.measurements);
    await db.syncMetadata.put({ key: 'state', ...db.binding, accountGeneration: snapshot.accountGeneration,
        catalogGeneration: snapshot.catalogGeneration, lastRefreshed: Date.now() });
}

export async function discardPendingChanges(db: AccountDatabase, snapshot: Snapshot, expectedMutationIds: string[]): Promise<void> {
    if (!isSnapshot(snapshot)) throw new ApiError('malformed', 'invalid_snapshot');
    if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
        const mutationIds = (await db.outbox.orderBy('sequence').toArray()).map(entry => entry.command.mutationId);
        if (mutationIds.length !== expectedMutationIds.length || mutationIds.some((id, index) => id !== expectedMutationIds[index])) {
            throw new Error('pending_work_changed');
        }
        await db.outbox.clear();
        await replaceAccountData(db, snapshot);
    });
}
