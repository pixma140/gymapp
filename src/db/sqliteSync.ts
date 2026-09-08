import { readSession } from '@/auth/tabs';
import { ApiError, AUTHORIZATION_FAILURE, isObject, jsonBody, requestJson } from '@/lib/api';
import type { Receipt } from '@shared/commands';
import type { AccountDatabase } from './db';

// One sender across tabs for this account. Unsupported browsers retain their queue.
export async function flushPendingMutations(db: AccountDatabase, active: () => boolean = () => true): Promise<void> {
    if (!navigator.locks) return;
    await readSession(() => navigator.locks.request(`sync:${db.name}`, async () => {
        while (active()) {
            const entry = await db.outbox.orderBy('sequence').first();
            if (!active() || !entry || ['failed', 'conflict', 'paused'].includes(entry.state)) return;
            await db.outbox.update(entry.sequence, { state: 'sending', attempts: entry.attempts + 1 });
            if (!active()) return;
            let receipt: Receipt;
            try {
                receipt = await requestJson('/api/sync', (value): value is Receipt =>
                    isObject(value) && value.mutationId === entry.command.mutationId && value.accountId === db.binding.accountId
                    && value.installationId === db.binding.installationId && Number.isSafeInteger(value.revision) && Number(value.revision) > 0
                    && Number.isSafeInteger(value.accountGeneration) && Number(value.accountGeneration) >= 0
                    && Number.isSafeInteger(value.catalogGeneration) && Number(value.catalogGeneration) >= 0,
                jsonBody(entry.command));
            } catch (error) {
                if (!(error instanceof ApiError) || ['network', 'server', 'rateLimited', 'malformed'].includes(error.kind)) return;
                const bindingChanged = error.message === 'account_binding_mismatch';
                const state = error.kind === 'unauthenticated' || bindingChanged ? 'paused' : error.kind === 'conflict' ? 'conflict' : 'failed';
                await db.outbox.update(entry.sequence, { state, error: error.message });
                if (bindingChanged && typeof window !== 'undefined') window.dispatchEvent(new Event(AUTHORIZATION_FAILURE));
                return;
            }
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
    }));
}
