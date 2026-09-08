import { readSession } from '@/auth/tabs';
import { ApiError, AUTHORIZATION_FAILURE, isObject, jsonBody, requestJson } from '@/lib/api';
import { validateCommand } from '@shared/commands';
import type { Command, Receipt } from '@shared/commands';
import type { AccountDatabase, PendingMutation } from './db';
import { generationConflictSequences, isSnapshot } from './hydrate';

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 60_000;
const retryDelay = (attempts: number) => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)));
const prepareCommand = (db: AccountDatabase, entry: PendingMutation, revision?: number): Command => {
    if (entry.command) return entry.command;
    if (revision === undefined) throw new Error('missing_dependency_revision');
    const command = Object.freeze({ ...db.binding, ...entry.intent, expectedRevision: revision }) as Command;
    const invalid = validateCommand(command);
    if (invalid) throw new Error(invalid);
    return command;
};

async function detectGenerationConflict(db: AccountDatabase): Promise<boolean> {
    const [entries, metadata] = await Promise.all([db.outbox.orderBy('sequence').toArray(), db.syncMetadata.get('state')]);
    if (!entries.length || entries[0].attempts > 0) return false;
    const snapshot = await requestJson('/api/sync/snapshot', isSnapshot, undefined, false);
    if (snapshot.accountId !== db.binding.accountId || snapshot.installationId !== db.binding.installationId) {
        throw new ApiError('conflict', 'account_binding_mismatch', 409);
    }
    const conflictSequences = generationConflictSequences(entries, metadata, snapshot);
    if (!conflictSequences.length) return false;
    await db.outbox.where('sequence').anyOf(conflictSequences)
        .modify({ state: 'conflict', error: 'generation_conflict', nextAttemptAt: undefined });
    return true;
}

async function retainPreflightFailure(db: AccountDatabase, entry: PendingMutation, error: ApiError): Promise<void> {
    if (['network', 'server', 'rateLimited'].includes(error.kind)) {
        const attempts = (entry.preflightAttempts ?? 0) + 1;
        const delay = error.kind === 'rateLimited' ? error.retryAfterMs ?? retryDelay(attempts) : retryDelay(attempts);
        await db.outbox.update(entry.sequence, { state: 'pending', preflightAttempts: attempts,
            nextAttemptAt: Date.now() + delay, error: error.message });
        return;
    }
    const bindingChanged = error.message === 'account_binding_mismatch';
    const state = error.kind === 'unauthenticated' || bindingChanged ? 'paused' : 'failed';
    await db.outbox.update(entry.sequence, { state, error: error.message, nextAttemptAt: undefined });
    if ((error.kind === 'unauthenticated' || bindingChanged) && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTHORIZATION_FAILURE));
    }
}

// One sender across tabs for this account. Unsupported browsers retain their queue.
export async function flushPendingMutations(db: AccountDatabase, active: () => boolean = () => true): Promise<void> {
    if (!navigator.locks) return;
    await readSession(() => navigator.locks.request(`sync:${db.name}`, async () => {
        if (!active()) return;
        while (active()) {
            const entry = await db.outbox.orderBy('sequence').first();
            if (!active() || !entry || ['failed', 'conflict', 'paused'].includes(entry.state)) return;
            if (entry.dependency !== undefined || (entry.nextAttemptAt ?? 0) > Date.now()) return;
            try { if (await detectGenerationConflict(db)) return; }
            catch (error) {
                if (!(error instanceof ApiError)) throw error;
                await retainPreflightFailure(db, entry, error);
                return;
            }
            const command = prepareCommand(db, entry);
            const attempts = entry.attempts + 1;
            await db.outbox.update(entry.sequence, { command, state: 'sending', attempts,
                preflightAttempts: 0, nextAttemptAt: undefined, error: undefined });
            if (!active()) return;
            let receipt: Receipt;
            try {
                receipt = await requestJson('/api/sync', (value): value is Receipt =>
                    isObject(value) && value.mutationId === command.mutationId && value.accountId === db.binding.accountId
                    && value.installationId === db.binding.installationId && Number.isSafeInteger(value.revision) && Number(value.revision) > 0
                    && Number.isSafeInteger(value.accountGeneration) && Number(value.accountGeneration) >= 0
                    && Number.isSafeInteger(value.catalogGeneration) && Number(value.catalogGeneration) >= 0,
                jsonBody(command));
            } catch (error) {
                if (!(error instanceof ApiError)) throw error;
                if (['network', 'server', 'rateLimited', 'malformed'].includes(error.kind)) {
                    const delay = error.kind === 'rateLimited' ? error.retryAfterMs ?? retryDelay(attempts) : retryDelay(attempts);
                    await db.outbox.update(entry.sequence, { state: 'pending', error: error.message, nextAttemptAt: Date.now() + delay });
                    return;
                }
                const bindingChanged = error.message === 'account_binding_mismatch';
                const state = error.kind === 'unauthenticated' || bindingChanged ? 'paused' : error.kind === 'conflict' ? 'conflict' : 'failed';
                await db.outbox.update(entry.sequence, { state, error: error.message, nextAttemptAt: undefined });
                if (bindingChanged && typeof window !== 'undefined') window.dispatchEvent(new Event(AUTHORIZATION_FAILURE));
                return;
            }
            await db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox, db.syncMetadata], async () => {
                const domain = command.operation.split('.')[0];
                const table = domain === 'profile' ? db.users : domain === 'gym' ? db.gyms : domain === 'workout' ? db.workouts : db.userMeasurements;
                await db.table(table.name).update(command.targetId ?? db.binding.accountId, { revision: receipt.revision });
                const dependents = await db.outbox.filter(candidate => candidate.dependency === entry.sequence).toArray();
                for (const next of dependents) {
                    if (next.attempts !== 0) throw new Error('dependency_already_sent');
                    await db.outbox.update(next.sequence, { dependency: undefined, revisionDependency: undefined,
                        command: next.revisionDependency ? prepareCommand(db, next, receipt.revision) : next.command });
                }
                await db.syncMetadata.update('state', domain === 'gym'
                    ? { catalogGeneration: receipt.catalogGeneration }
                    : { accountGeneration: receipt.accountGeneration });
                await db.outbox.delete(entry.sequence);
            });
        }
    }));
}
