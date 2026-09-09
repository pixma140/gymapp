import { v7 as uuidv7 } from 'uuid';
import { isUuid, PROFILE_COLUMNS, validateCommand } from '@shared/commands';
import { ApiError, isObject } from '@/lib/api';
import { EXERCISE_IDS } from '@shared/exercises';
import type { Snapshot } from '@shared/commands';
import type { AccountDatabase, MutationIntent, PendingMutation } from './db';
import { applyIntent } from './operations';

const revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 1;
const generation = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const validPayload = (operation: string, payload: unknown) => validateCommand({
    mutationId: '00000000-0000-7000-8000-000000000001', installationId: '00000000-0000-7000-8000-000000000001',
    accountId: '00000000-0000-7000-8000-000000000001', operation, targetId: operation === 'profile.update' ? null : '00000000-0000-7000-8000-000000000001',
    expectedRevision: operation === 'profile.update' ? 1 : null, payload,
}) === null;
export function isSnapshot(value: unknown): value is Snapshot {
    if (!isObject(value) || !isUuid(value.installationId) || !isUuid(value.accountId)
        || !generation(value.accountGeneration) || !generation(value.catalogGeneration)
        || !isObject(value.profile) || value.profile.id !== value.accountId || !revision(value.profile.revision)
        || !Array.isArray(value.gyms) || !Array.isArray(value.workouts) || !Array.isArray(value.workoutExercises)
        || !Array.isArray(value.measurements)) return false;
    const profile = value.profile;
    if (!PROFILE_COLUMNS.every(key => Object.hasOwn(profile, key))
        || !validPayload('profile.update', Object.fromEntries(PROFILE_COLUMNS.map(key => [key, profile[key]])))) return false;
    const unique = (rows: unknown[]) => new Set(rows.map(row => isObject(row) ? row.id : null)).size === rows.length;
    if (![value.gyms, value.workouts, value.workoutExercises, value.measurements].every(unique)) return false;
    if (!value.gyms.every(row => isObject(row) && isUuid(row.id) && revision(row.revision) && typeof row.archived === 'boolean'
        && validPayload('gym.create', { name: row.name, location: row.location }))) return false;
    const gyms = new Set(value.gyms.map(row => row.id));
    if (!value.workouts.every(row => isObject(row) && isUuid(row.id) && revision(row.revision) && gyms.has(row.gymId)
        && validPayload('workout.start', { gymId: row.gymId, startTime: row.startTime })
        && (row.endTime === null || (Number.isSafeInteger(row.endTime) && Number(row.endTime) >= Number(row.startTime))))) return false;
    const workouts = new Set(value.workouts.map(row => row.id));
    const uses = new Set<string>();
    if (!value.workoutExercises.every(row => {
        if (!isObject(row) || !isUuid(row.id) || !revision(row.revision) || !workouts.has(row.workoutId)
            || typeof row.exerciseId !== 'string' || !EXERCISE_IDS.has(row.exerciseId)) return false;
        const key = `${row.workoutId}:${row.exerciseId}`;
        if (uses.has(key)) return false;
        uses.add(key);
        return true;
    })) return false;
    return value.measurements.every(row => isObject(row) && isUuid(row.id) && revision(row.revision)
        && validPayload('measurement.create', { weight: row.weight, bodyFat: row.bodyFat, timestamp: row.timestamp }));
}

export type HydrationResult = { status: 'success' | 'empty' } | { status: 'error'; error: Error };
export function generationConflictSequences(entries: PendingMutation[], metadata: { accountGeneration: number; catalogGeneration: number } | undefined,
    snapshot: Pick<Snapshot, 'accountGeneration' | 'catalogGeneration'>): number[] {
    if (!metadata) return entries.map(entry => entry.sequence);
    const accountChanged = metadata.accountGeneration !== snapshot.accountGeneration;
    const catalogChanged = metadata.catalogGeneration !== snapshot.catalogGeneration;
    return entries.filter(entry => entry.intent.operation.startsWith('gym.') ? catalogChanged : accountChanged)
        .map(entry => entry.sequence);
}
export async function prepareAccountCache(db: AccountDatabase, snapshot: Snapshot): Promise<HydrationResult> {
    try {
        if (!isSnapshot(snapshot)) throw new ApiError('malformed', 'invalid_snapshot');
        if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
        const pending = await db.outbox.orderBy('sequence').toArray();
        if (!pending.length) return await hydrateFromServer(db, snapshot);
        const metadata = await db.syncMetadata.get('state');
        const head = pending[0];
        const conflictSequences = head.attempts === 0 ? generationConflictSequences(pending, metadata, snapshot) : [];
        if (conflictSequences.length) {
            await db.outbox.where('sequence').anyOf(conflictSequences).modify({ state: 'conflict', error: 'generation_conflict' });
        } else if (head.state === 'paused') {
            await db.outbox.update(head.sequence, { state: 'pending', error: undefined, nextAttemptAt: undefined });
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
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
        if (await db.outbox.count()) throw new Error('pending_work');
        await replaceAccountData(db, snapshot);
    });
    return { status: snapshot.workouts.length || snapshot.measurements.length ? 'success' : 'empty' };
}

async function replaceAccountData(db: AccountDatabase, snapshot: Snapshot): Promise<void> {
    await Promise.all([db.users.clear(), db.gyms.clear(), db.workouts.clear(), db.workoutExercises.clear(), db.userMeasurements.clear(), db.syncMetadata.clear()]);
    await db.users.put(snapshot.profile);
    await db.gyms.bulkPut(snapshot.gyms);
    await db.workouts.bulkPut(snapshot.workouts);
    await db.workoutExercises.bulkPut(snapshot.workoutExercises);
    await db.userMeasurements.bulkPut(snapshot.measurements);
    const refreshedAt = Date.now();
    await db.syncMetadata.put({ key: 'state', ...db.binding, accountGeneration: snapshot.accountGeneration,
        catalogGeneration: snapshot.catalogGeneration, lastRefreshed: refreshedAt, lastSuccessfulSync: refreshedAt });
}

function assertPendingUnchanged(entries: PendingMutation[], expectedMutationIds: string[]): void {
    const mutationIds = entries.map(entry => entry.intent.mutationId);
    if (mutationIds.length !== expectedMutationIds.length || mutationIds.some((id, index) => id !== expectedMutationIds[index])) {
        throw new Error('pending_work_changed');
    }
}

export async function discardPendingChanges(db: AccountDatabase, snapshot: Snapshot, expectedMutationIds: string[]): Promise<void> {
    if (!isSnapshot(snapshot)) throw new ApiError('malformed', 'invalid_snapshot');
    if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
        assertPendingUnchanged(await db.outbox.orderBy('sequence').toArray(), expectedMutationIds);
        await db.outbox.clear();
        await replaceAccountData(db, snapshot);
    });
}

export async function resolvePendingConflict(db: AccountDatabase, snapshot: Snapshot, expectedMutationIds: string[],
    resolution: 'discard' | 'reapply'): Promise<void> {
    if (!isSnapshot(snapshot)) throw new ApiError('malformed', 'invalid_snapshot');
    if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
        const entries = await db.outbox.orderBy('sequence').toArray();
        assertPendingUnchanged(entries, expectedMutationIds);
        const rejected = entries.filter(entry => entry.state === 'conflict');
        if (!rejected.length) throw new Error('conflict_not_found');
        const discarded = new Set<number>(rejected.map(entry => entry.sequence));
        for (const entry of entries) {
            if (entry.dependency !== undefined && discarded.has(entry.dependency)) discarded.add(entry.sequence);
        }
        const reviewed = resolution === 'reapply' ? entries : entries.filter(entry => !discarded.has(entry.sequence));
        await db.outbox.clear();
        await replaceAccountData(db, snapshot);
        const reappliedSequences = new Map<number, number>();
        for (const entry of reviewed) {
            const intent = Object.freeze({ ...entry.intent, mutationId: uuidv7(),
                payload: Object.freeze({ ...entry.intent.payload }) }) as MutationIntent;
            await applyIntent(db, intent);
            const reapplied = await db.outbox.filter(candidate => candidate.intent.mutationId === intent.mutationId).first();
            if (!reapplied) throw new Error('missing_reapplied_intent');
            reappliedSequences.set(entry.sequence, reapplied.sequence);
            if (entry.dependency !== undefined) {
                const dependency = reappliedSequences.get(entry.dependency);
                if (dependency === undefined) throw new Error('missing_reapplied_dependency');
                await db.outbox.update(reapplied.sequence, { dependency });
            }
        }
    });
}
