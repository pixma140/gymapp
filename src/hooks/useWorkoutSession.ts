import { useState, useEffect } from 'react';
import { db } from '@/db/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useWorkoutSession(gymId?: number, existingWorkoutId?: number) {
    const [workoutId, setWorkoutId] = useState<number | null>(existingWorkoutId || null);
    const [activeExerciseId, setActiveExerciseId] = useState<number | null>(null);

    // Start workout on mount if not exists (or resume - simplified for now)
    useEffect(() => {
        const initSession = async () => {
            if (existingWorkoutId) {
                setWorkoutId(existingWorkoutId);
                return;
            }

            if (gymId && !workoutId) {
                const id = await db.workouts.add({
                    userId: 1, // Default user
                    gymId,
                    startTime: Date.now(),
                });
                setWorkoutId(id as number);
            }
        };
        initSession();
    }, [gymId, existingWorkoutId]);

    const workoutSets = useLiveQuery(
        () => workoutId ? db.workoutSets.where('workoutId').equals(workoutId).toArray() : [],
        [workoutId]
    );

    const addSet = async (exerciseId: number, type: 'warmup' | 'working', weight: number, reps: number) => {
        if (!workoutId) return;
        await db.workoutSets.add({
            workoutId,
            exerciseId,
            type,
            setNumber: (workoutSets?.filter(s => s.exerciseId === exerciseId).length || 0) + 1,
            weight,
            reps,
            timestamp: Date.now()
        });
    };

    const removeSet = async (setId: number) => {
        await db.workoutSets.delete(setId);
    };

    const finishWorkout = async () => {
        if (!workoutId) return;

        // Only update end time if it wasn't already set (i.e. strictly new workout)
        // For editing, we might want to update duration if we track it, but for now let's leave it simple.
        const workout = await db.workouts.get(workoutId);
        if (workout && !workout.endTime) {
            await db.workouts.update(workoutId, {
                endTime: Date.now(),
                duration: 0 // TODO: Calculate duration
            });
        }
    };

    return {
        workoutId,
        workoutSets,
        activeExerciseId,
        setActiveExerciseId,
        addSet,
        removeSet,
        finishWorkout
    };
}
