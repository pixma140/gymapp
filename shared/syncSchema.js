// Single source of truth for the sync schema shared by the client (Vite/TS)
// and the server (plain Node ESM). The companion `syncSchema.d.ts` provides the
// TypeScript types; this file provides the runtime values.
//
// Keep this in lockstep with the Dexie schema in `src/db/db.ts` and the SQLite
// table definitions in `server/index.js`.

// Column whitelist per table. The server uses this to validate and project
// incoming/outgoing rows so clients can never write arbitrary columns.
export const TABLE_COLUMNS = {
    users: ['id', 'name', 'email', 'weight', 'height', 'bodyFat', 'age', 'gender', 'reminderFrequency', 'language', 'theme', 'mainColor'],
    userMeasurements: ['id', 'userId', 'weight', 'bodyFat', 'timestamp'],
    gyms: ['id', 'userId', 'name', 'location', 'lastVisited', 'visitCount'],
    exercises: ['id', 'userId', 'name', 'muscleGroup'],
    gymEquipments: ['id', 'userId', 'gymId', 'exerciseId', 'equipmentName', 'conversionFactor'],
    workouts: ['id', 'userId', 'gymId', 'startTime', 'endTime', 'duration'],
    workoutSets: ['id', 'userId', 'workoutId', 'exerciseId', 'gymEquipmentId', 'type', 'setNumber', 'weight', 'reps', 'rpe', 'timestamp']
};

// Tables the client pushes to the server as mutations, in FK-safe order
// (parents before children).
export const SYNC_TABLES = ['users', 'userMeasurements', 'gyms', 'exercises', 'gymEquipments', 'workouts', 'workoutSets'];

// User-scoped tables included in a snapshot/pull, in dependency-safe order.
// Excludes the singular `users` profile, which the snapshot returns separately.
export const SNAPSHOT_TABLES = ['userMeasurements', 'gyms', 'exercises', 'gymEquipments', 'workouts', 'workoutSets'];
