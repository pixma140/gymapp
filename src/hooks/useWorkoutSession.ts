import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
export function useWorkoutSession(gymId: string) {
    const db = useDatabase();
    const workout = useLiveQuery(() => db.workouts.filter(row => row.endTime === null).first(), [db]);
    return {
        workout,
        startWorkout: () => applyOperation(db, 'workout.start', null, { gymId, startTime: Date.now() }),
        finishWorkout: () => workout ? applyOperation(db, 'workout.finish', workout.id, { endTime: Date.now() }) : Promise.resolve(),
        cancelWorkout: () => workout ? applyOperation(db, 'workout.delete', workout.id, {}) : Promise.resolve(),
    };
}
