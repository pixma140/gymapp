import { useState, useEffect, useRef } from 'react';
import { db } from '@/db/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useWorkoutSession(gymId?: number, existingWorkoutId?: number) {
    const [workoutId, setWorkoutId] = useState<number | null>(existingWorkoutId || null);
    const [activeExerciseId, setActiveExerciseId] = useState<number | null>(null);

    const initializing = useRef(false);

    const resolveWorkoutId = async (): Promise<number | null> => {
        if (workoutId) return workoutId;

        if (existingWorkoutId) {
            setWorkoutId(existingWorkoutId);
            return existingWorkoutId;
        }

        if (!gymId) return null;

        const activeWorkouts = await db.workouts
            .where('userId').equals(1)
            .filter(w => !w.endTime)
            .toArray();

        if (activeWorkouts.length > 0) {
            const activeForGym = activeWorkouts.find(w => w.gymId === gymId);
            const fallbackActive = [...activeWorkouts].sort((a, b) => b.startTime - a.startTime)[0];
            const selectedWorkout = activeForGym || fallbackActive;
            setWorkoutId(selectedWorkout.id);
            return selectedWorkout.id;
        }

        const newWorkoutId = await db.workouts.add({
            userId: 1,
            gymId,
            startTime: Date.now(),
        });

        setWorkoutId(newWorkoutId as number);
        return newWorkoutId as number;
    };

    useEffect(() => {
        let mounted = true;

        const initSession = async () => {
            if (existingWorkoutId) {
                setWorkoutId(existingWorkoutId);
                return;
            }

            if (gymId && !workoutId && !initializing.current) {
                initializing.current = true;
                try {
                    const resolvedId = await resolveWorkoutId();
                    if (resolvedId && mounted) {
                        setWorkoutId(resolvedId);
                    }
                } finally {
                    initializing.current = false;
                }
            }
        };
        initSession();

        return () => {
             mounted = false;
        };
    }, [gymId, existingWorkoutId]);

    const workoutSets = useLiveQuery(
        () => workoutId ? db.workoutSets.where('workoutId').equals(workoutId).toArray() : [],
        [workoutId]
    );

    const addSet = async (exerciseId: number, type: 'warmup' | 'working', weight: number, reps: number) => {
        const targetWorkoutId = await resolveWorkoutId();
        if (!targetWorkoutId) return;

        await db.workoutSets.add({
            workoutId: targetWorkoutId,
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
        const targetWorkoutId = await resolveWorkoutId();
        if (!targetWorkoutId) return;

        // Only update end time if it wasn't already set (i.e. strictly new workout)
        // For editing, we might want to update duration if we track it, but for now let's leave it simple.
        const workout = await db.workouts.get(targetWorkoutId);
        if (workout && !workout.endTime) {
            const now = Date.now();
            const duration = Math.floor((now - workout.startTime) / 1000); // Seconds
            await db.workouts.update(targetWorkoutId, {
                endTime: now,
                duration
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
