import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useSession } from '@/context/SessionContext';

export function useActiveWorkout() {
    const { userId } = useSession();

    return useLiveQuery(async () => {
        if (!userId) return null;

        const activeWorkouts = await db.workouts
            .where('userId').equals(userId)
            .filter(w => !w.endTime)
            .toArray();

        if (activeWorkouts.length === 0) return null;

        const activeWorkout = activeWorkouts.sort((a, b) => b.startTime - a.startTime)[0];


        const gym = await db.gyms.get(activeWorkout.gymId);
        return { ...activeWorkout, gymName: gym?.name };
    }, [userId]);
}
