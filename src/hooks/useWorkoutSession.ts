import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/db/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useWorkoutSession(gymId?: number, existingWorkoutId?: number) {
    const [workoutId, setWorkoutId] = useState<number | null>(existingWorkoutId || null);
    const [activeExerciseId, setActiveExerciseId] = useState<number | null>(null);

    const initializing = useRef(false);
    const suppressAutoCreate = useRef(false);

    const findActiveWorkoutId = useCallback(async (allowFallback = true): Promise<number | null> => {
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
            const fallbackActive = allowFallback
                ? [...activeWorkouts].sort((a, b) => b.startTime - a.startTime)[0]
                : null;
            const selectedWorkout = activeForGym || fallbackActive;

            if (selectedWorkout) {
                setWorkoutId(selectedWorkout.id);
                return selectedWorkout.id;
            }
        }

        return null;
    }, [workoutId, existingWorkoutId, gymId]);

    const resolveWorkoutId = useCallback(async (): Promise<number | null> => {
        const existingActive = await findActiveWorkoutId(true);
        if (existingActive) return existingActive;

        if (!gymId) return null;

        const newWorkoutId = await db.workouts.add({
            userId: 1,
            gymId,
            startTime: Date.now(),
        });

        setWorkoutId(newWorkoutId as number);
        return newWorkoutId as number;
    }, [findActiveWorkoutId, gymId]);

    useEffect(() => {
        let mounted = true;

        const initSession = async () => {
            if (existingWorkoutId) {
                setWorkoutId(existingWorkoutId);
                return;
            }

            if (gymId && !workoutId && !initializing.current && !suppressAutoCreate.current) {
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
    }, [gymId, existingWorkoutId, resolveWorkoutId, workoutId]);

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
        const targetWorkoutId = await findActiveWorkoutId(false);
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

    const cancelWorkout = async () => {
        const targetWorkoutId = await findActiveWorkoutId(false);
        if (!targetWorkoutId) return;

        await db.transaction('rw', db.workouts, db.workoutSets, async () => {
            await db.workoutSets.where('workoutId').equals(targetWorkoutId).delete();
            await db.workouts.delete(targetWorkoutId);
        });

        suppressAutoCreate.current = true;
        setWorkoutId(null);
    };

    return {
        workoutId,
        workoutSets,
        activeExerciseId,
        setActiveExerciseId,
        addSet,
        removeSet,
        finishWorkout,
        cancelWorkout
    };
}
