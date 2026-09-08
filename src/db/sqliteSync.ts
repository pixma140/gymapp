import type Dexie from 'dexie';
import { db } from '@/db/db';
import { SYNC_TABLES } from '@shared/syncSchema';

type MutationPayload =
    | {
          table: string;
          operation: 'upsert';
          data: Record<string, unknown>;
      }
    | {
          table: string;
          operation: 'update';
          id: number;
          changes: Record<string, unknown>;
      }
    | {
          table: string;
          operation: 'delete';
          id: number;
      };

let isSQLiteSyncInitialized = false;
let isHydrating = false;
let isFlushing = false;

/**
 * Suppresses outbound sync while the local database is being populated from a
 * server snapshot. Without this, hydrating would echo every imported row back
 * to the server as a fresh mutation.
 */
export function setHydrating(active: boolean): void {
    isHydrating = active;
}

async function sendMutation(payload: MutationPayload): Promise<boolean> {
    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            keepalive: true
        });

        // 4xx responses are terminal (bad/forbidden payload); don't retry them
        // forever. Only network errors and 5xx are considered retryable.
        if (response.ok || (response.status >= 400 && response.status < 500)) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

async function enqueueMutation(payload: MutationPayload): Promise<void> {
    try {
        await db.pendingSync.add({ payload, createdAt: Date.now() });
    } catch {
        // If even the outbox write fails there is nothing more we can do.
    }
}

/**
 * Attempts to deliver any buffered mutations in order. Stops at the first
 * failure so ordering is preserved and retries happen on the next trigger.
 */
export async function flushPendingMutations(): Promise<void> {
    if (isFlushing || isHydrating) {
        return;
    }

    isFlushing = true;
    try {
        const pending = await db.pendingSync.orderBy('createdAt').toArray();
        for (const entry of pending) {
            const delivered = await sendMutation(entry.payload as MutationPayload);
            if (!delivered) {
                break;
            }
            await db.pendingSync.delete(entry.id);
        }
    } catch {
        // Best-effort; will retry on the next trigger.
    } finally {
        isFlushing = false;
    }
}

function postMutation(payload: MutationPayload): void {
    if (isHydrating) {
        return;
    }

    void (async () => {
        // Drain anything already queued first to keep ordering, then send this one.
        await flushPendingMutations();
        const delivered = await sendMutation(payload);
        if (!delivered) {
            await enqueueMutation(payload);
        }
    })();
}

export function setupSQLiteSync(database: Dexie): void {
    if (isSQLiteSyncInitialized) {
        return;
    }

    isSQLiteSyncInitialized = true;

    for (const tableName of SYNC_TABLES) {
        const table = database.table(tableName);

        table.hook('creating', function (_primKey, obj) {
            this.onsuccess = (createdKey: unknown) => {
                const syncedRow: Record<string, unknown> = { ...obj };

                if (syncedRow.id === undefined && typeof createdKey === 'number') {
                    syncedRow.id = createdKey;
                }

                queueMicrotask(() => {
                    postMutation({
                        table: tableName,
                        operation: 'upsert',
                        data: syncedRow
                    });
                });
            };
        });

        table.hook('updating', function (modifications, primaryKey) {
            if (typeof primaryKey !== 'number') {
                return;
            }

            queueMicrotask(() => {
                postMutation({
                    table: tableName,
                    operation: 'update',
                    id: primaryKey,
                    changes: modifications as Record<string, unknown>
                });
            });
        });

        table.hook('deleting', function (primaryKey) {
            if (typeof primaryKey !== 'number') {
                return;
            }

            queueMicrotask(() => {
                postMutation({
                    table: tableName,
                    operation: 'delete',
                    id: primaryKey
                });
            });
        });
    }

    // Retry buffered mutations when connectivity returns and on a slow interval.
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => void flushPendingMutations());
        window.setInterval(() => void flushPendingMutations(), 30_000);
        void flushPendingMutations();
    }
}
