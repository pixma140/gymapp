import type { Receipt } from '@shared/commands';
import type { AccountDatabase } from './db';

// One sender across tabs for this account. Unsupported browsers retain their queue.
export async function flushPendingMutations(db: AccountDatabase, active: () => boolean = () => true): Promise<void> {
    if (!navigator.locks) return;
    await navigator.locks.request(`sync:${db.name}`, async () => {
        while (active()) {
            const entry = await db.outbox.orderBy('sequence').first();
            if (!entry || ['failed', 'conflict', 'paused'].includes(entry.state)) return;
            await db.outbox.update(entry.sequence, { state: 'sending', attempts: entry.attempts + 1 });
            let response: Response;
            try {
                response = await fetch('/api/sync', { method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry.command) });
            } catch {
                // Sending state keeps the immutable envelope for ambiguous retries.
                return;
            }
            if (!response.ok) {
                if (response.status >= 500 || response.status === 429) return;
                const state = response.status === 401 ? 'paused' : response.status === 409 ? 'conflict' : 'failed';
                await db.outbox.update(entry.sequence, { state, error: `http_${response.status}` });
                return;
            }
            let receipt: Receipt;
            try { receipt = await response.json(); } catch { return; }
            if (receipt.mutationId !== entry.command.mutationId || receipt.accountId !== db.binding.accountId
                || receipt.installationId !== db.binding.installationId || !Number.isSafeInteger(receipt.revision)) return;
            await db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
                const domain = entry.command.operation.split('.')[0];
                const table = domain === 'profile' ? db.users : domain === 'gym' ? db.gyms : domain === 'workout' ? db.workouts : db.userMeasurements;
                await db.table(table.name).update(entry.command.targetId ?? db.binding.accountId, { revision: receipt.revision });
                const dependents = await db.outbox.filter(candidate => candidate.dependency === entry.sequence).toArray();
                for (const next of dependents) {
                    if (next.attempts !== 0) throw new Error('dependency_already_sent');
                    await db.outbox.update(next.sequence, { dependency: undefined, command: { ...next.command, expectedRevision: receipt.revision } });
                }
                await db.syncMetadata.update('state', { accountGeneration: receipt.accountGeneration, catalogGeneration: receipt.catalogGeneration });
                await db.outbox.delete(entry.sequence);
            });
        }
    });
}
