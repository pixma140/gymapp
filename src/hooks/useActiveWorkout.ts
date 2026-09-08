import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase } from '@/context/SessionContext';
export function useActiveWorkout() {
    const db = useDatabase();
    return useLiveQuery(async () => {
        const workout = await db.workouts.filter(row => row.endTime === null).first();
        if (!workout) return null;
        const gym = await db.gyms.get(workout.gymId);
        return { ...workout, gymName: gym?.name };
    }, [db]);
}
