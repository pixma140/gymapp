import type { AccountDatabase } from '@/db/db';

export async function getRankedGyms(db: AccountDatabase) {
    return db.transaction('r', db.gyms, db.workouts, async () => {
        const [gyms, workouts] = await Promise.all([
            db.gyms.filter(gym => !gym.archived).toArray(),
            db.workouts.filter(workout => workout.endTime !== null).toArray(),
        ]);
        // Workouts in this cache belong only to the signed-in account.
        const visits = new Map<string, number>();
        for (const workout of workouts) {
            visits.set(workout.gymId, (visits.get(workout.gymId) ?? 0) + 1);
        }
        return gyms.map(gym => ({ ...gym, visitCount: visits.get(gym.id) ?? 0 }))
            .sort((left, right) => right.visitCount - left.visitCount
                || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    });
}
