export type SyncTableName =
    | 'users'
    | 'userMeasurements'
    | 'gyms'
    | 'exercises'
    | 'gymEquipments'
    | 'workouts'
    | 'workoutSets';

export type SnapshotTableName = Exclude<SyncTableName, 'users'>;

export declare const TABLE_COLUMNS: Record<SyncTableName, string[]>;
export declare const SYNC_TABLES: readonly SyncTableName[];
export declare const SNAPSHOT_TABLES: readonly SnapshotTableName[];
