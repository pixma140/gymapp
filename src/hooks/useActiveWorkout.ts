import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

export function useActiveWorkout() {
    return useLiveQuery(async () => {
        const user = await db.users.orderBy('id').first();
        if (!user) return null;

        const activeWorkouts = await db.workouts
            .where('userId').equals(user.id)
            .filter(w => !w.endTime)
            .toArray();

        if (activeWorkouts.length === 0) return null;

        const activeWorkout = activeWorkouts.sort((a, b) => b.startTime - a.startTime)[0];


        const gym = await db.gyms.get(activeWorkout.gymId);
        return { ...activeWorkout, gymName: gym?.name };
    }, []);
}
