import { db } from '@/db/db';
import type {
    Exercise,
    Gym,
    GymEquipment,
    User,
    UserMeasurement,
    Workout,
    WorkoutSet
} from '@/db/db';
import { setHydrating } from '@/db/sqliteSync';

interface SnapshotResponse {
    ok: boolean;
    user?: User | null;
    tables?: {
        userMeasurements?: UserMeasurement[];
        gyms?: Gym[];
        exercises?: Exercise[];
        gymEquipments?: GymEquipment[];
        workouts?: Workout[];
        workoutSets?: WorkoutSet[];
    };
    error?: string;
}

/**
 * Pulls the authenticated user's full dataset from the server and replaces the
 * local IndexedDB contents with it. Used on a fresh device or whenever the
 * locally cached user no longer matches the active session.
 *
 * Returns true when a user profile was hydrated (i.e. the account already has
 * server-side data and onboarding can be skipped).
 */
export async function hydrateFromServer(): Promise<boolean> {
    let payload: SnapshotResponse;

    try {
        const response = await fetch('/api/sync/snapshot', { credentials: 'include' });
        payload = (await response.json()) as SnapshotResponse;
        if (!response.ok || !payload.ok) {
            return false;
        }
    } catch {
        return false;
    }

    const tables = payload.tables ?? {};

    setHydrating(true);
    try {
        await db.transaction(
            'rw',
            [
                db.users,
                db.userMeasurements,
                db.gyms,
                db.exercises,
                db.gymEquipments,
                db.workouts,
                db.workoutSets
            ],
            async () => {
                await Promise.all([
                    db.users.clear(),
                    db.userMeasurements.clear(),
                    db.gyms.clear(),
                    db.exercises.clear(),
                    db.gymEquipments.clear(),
                    db.workouts.clear(),
                    db.workoutSets.clear()
                ]);

                if (payload.user) {
                    await db.users.put(payload.user);
                }

                await db.userMeasurements.bulkPut(tables.userMeasurements ?? []);
                await db.gyms.bulkPut(tables.gyms ?? []);
                await db.exercises.bulkPut(tables.exercises ?? []);
                await db.gymEquipments.bulkPut(tables.gymEquipments ?? []);
                await db.workouts.bulkPut(tables.workouts ?? []);
                await db.workoutSets.bulkPut(tables.workoutSets ?? []);
            }
        );
    } finally {
        setHydrating(false);
    }

    return Boolean(payload.user);
}
