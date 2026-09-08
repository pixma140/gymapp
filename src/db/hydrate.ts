import type { Snapshot } from '@shared/commands';
import type { AccountDatabase } from './db';

export async function hydrateFromServer(db: AccountDatabase, snapshot: Snapshot): Promise<void> {
    if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) throw new Error('account_binding_mismatch');
    if (!snapshot.profile || snapshot.profile.id !== snapshot.accountId || !Array.isArray(snapshot.gyms)
        || !Array.isArray(snapshot.workouts) || !Array.isArray(snapshot.measurements)) throw new Error('invalid_snapshot');
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
        if (await db.outbox.count()) throw new Error('pending_work');
        await Promise.all([db.users.clear(), db.gyms.clear(), db.workouts.clear(), db.userMeasurements.clear()]);
        await db.users.put(snapshot.profile);
        await db.gyms.bulkPut(snapshot.gyms);
        await db.workouts.bulkPut(snapshot.workouts);
        await db.userMeasurements.bulkPut(snapshot.measurements);
        await db.syncMetadata.put({ key: 'state', ...db.binding, accountGeneration: snapshot.accountGeneration,
            catalogGeneration: snapshot.catalogGeneration, lastRefreshed: Date.now() });
    });
}
