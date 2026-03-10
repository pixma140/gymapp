import type Dexie from 'dexie';

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

const SYNC_TABLES = [
    'users',
    'userMeasurements',
    'gyms',
    'exercises',
    'gymEquipments',
    'workouts',
    'workoutSets'
] as const;

let isSQLiteSyncInitialized = false;

function postMutation(payload: MutationPayload): void {
    void fetch('/api/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        keepalive: true
    }).catch(() => {
        // Best-effort sync: app stays local-first even if API is unavailable.
    });
}

export function setupSQLiteSync(db: Dexie): void {
    if (isSQLiteSyncInitialized) {
        return;
    }

    isSQLiteSyncInitialized = true;

    for (const tableName of SYNC_TABLES) {
        const table = db.table(tableName);

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
}
