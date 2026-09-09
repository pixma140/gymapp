import { v7 as uuidv7 } from 'uuid';
import type { Command, CommandPayloads, Operation, ProfileFields, WorkoutSet } from '@shared/commands';
import { validateCommand } from '@shared/commands';
import { EXERCISE_IDS } from '@shared/exercises';
import type { AccountDatabase, MutationIntent } from './db';

export async function applyOperation<K extends Operation>(db: AccountDatabase, operation: K, targetId: string | null, payload: CommandPayloads[K]): Promise<string | null> {
    const domain = operation.split('.')[0];
    const id = domain === 'profile' ? null : targetId ?? uuidv7();
    const intent = Object.freeze({ mutationId: uuidv7(), operation, targetId: id, payload: Object.freeze({ ...payload }) }) as MutationIntent;
    return applyIntent(db, intent);
}

export async function updateProfileWithMeasurement(db: AccountDatabase, payload: Partial<ProfileFields>, measuredAt = Date.now()): Promise<void> {
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.customExercises, db.userMeasurements, db.outbox], async () => {
        await applyOperation(db, 'profile.update', null, payload);
        const profileIntent = await db.outbox.filter(entry => entry.intent.operation === 'profile.update').last();
        if (!profileIntent) throw new Error('missing_profile_intent');
        if ((payload.weight !== null && payload.weight !== undefined)
            || (payload.bodyFat !== null && payload.bodyFat !== undefined)) {
            const measurementId = await applyOperation(db, 'measurement.create', null, {
                weight: payload.weight ?? null,
                bodyFat: payload.bodyFat ?? null,
                timestamp: measuredAt,
            });
            const measurementIntent = await db.outbox.filter(entry => entry.intent.targetId === measurementId).last();
            if (!measurementIntent) throw new Error('missing_measurement_intent');
            await db.outbox.update(measurementIntent.sequence, { dependency: profileIntent.sequence });
        }
    });
}

export async function applyIntent(db: AccountDatabase, intent: MutationIntent): Promise<string | null> {
    const { operation, targetId, payload } = intent;
    const [domain, action] = operation.split('.');
    const table = domain === 'profile' ? db.users : domain === 'gym' ? db.gyms : domain === 'workout' ? db.workouts
        : domain === 'workoutExercise' ? db.workoutExercises : domain === 'customExercise' ? db.customExercises : db.userMeasurements;
    const create = action === 'create' || action === 'start';
    if (domain !== 'profile' && targetId === null) throw new Error('invalid_target');
    const id = domain === 'profile' ? db.binding.accountId : targetId as string;
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.customExercises, db.userMeasurements, db.outbox], async () => {
        const current = await db.table(table.name).get(id);
        if (!create && !current) throw new Error('record_not_found');
        if (create && current) throw new Error('record_exists');
        if (operation === 'workout.update') {
            const times = payload as CommandPayloads['workout.update'];
            if (current.endTime === null ? times.endTime !== undefined : (times.endTime ?? current.endTime) < times.startTime) {
                throw new Error('invalid_workout_times');
            }
        }
        if (operation === 'workout.start') {
            if (await db.workouts.filter(workout => workout.endTime === null).count()) throw new Error('active_workout_exists');
            const start = payload as CommandPayloads['workout.start'];
            const gym = await db.gyms.get(start.gymId);
            if (!gym || gym.archived) throw new Error('gym_unavailable');
        }
        if (operation === 'workoutExercise.create') {
            const use = payload as CommandPayloads['workoutExercise.create'];
            const workout = await db.workouts.get(use.workoutId);
            if (!workout) throw new Error('workout_unavailable');
            if (!EXERCISE_IDS.has(use.exerciseId) && !await db.customExercises.get(use.exerciseId)) throw new Error('exercise_unavailable');
            if (await db.workoutExercises.where('[workoutId+exerciseId]').equals([use.workoutId, use.exerciseId]).count()) {
                throw new Error('exercise_already_selected');
            }
        }
        const previous = await db.outbox.filter(entry => entry.intent.operation.split('.')[0] === domain
            && entry.intent.targetId === (domain === 'profile' ? null : id)).last();
        const referencedGym = operation === 'workout.start'
            ? await db.outbox.filter(entry => entry.intent.operation === 'gym.create'
                && entry.intent.targetId === (payload as CommandPayloads['workout.start']).gymId).last()
            : undefined;
        const referencedWorkout = operation === 'workoutExercise.create'
            ? await db.outbox.filter(entry => entry.intent.operation === 'workout.start'
                && entry.intent.targetId === (payload as CommandPayloads['workoutExercise.create']).workoutId).last()
            : undefined;
        const referencedExercise = operation === 'workoutExercise.create'
            ? await db.outbox.filter(entry => entry.intent.operation === 'customExercise.create'
                && entry.intent.targetId === (payload as CommandPayloads['workoutExercise.create']).exerciseId).last()
            : undefined;
        const candidate = Object.freeze({ ...db.binding, ...intent,
            expectedRevision: create ? null : previous ? 1 : current.revision }) as Command;
        const invalid = validateCommand(candidate);
        if (invalid) throw new Error(invalid);
        const command = previous ? null : candidate;
        if (action === 'delete') {
            if (domain === 'workout') await db.workoutExercises.where('workoutId').equals(id).delete();
            await db.table(table.name).delete(id);
        }
        else await db.table(table.name).put({ ...(create ? { id, revision: 0,
            ...(domain === 'workout' ? { endTime: null } : {}), ...(domain === 'workoutExercise' ? { sets: [] } : {}),
            ...(domain === 'gym' ? { archived: false } : {}) } : current), ...payload });
        await db.outbox.add({ intent, command, dependency: previous?.sequence ?? referencedGym?.sequence ?? referencedWorkout?.sequence ?? referencedExercise?.sequence,
            revisionDependency: Boolean(previous), attempts: 0, state: 'pending' });
    });
    return targetId;
}

export async function createAndSelectExercise(db: AccountDatabase, workoutId: string, fields: CommandPayloads['customExercise.create']) {
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.customExercises, db.userMeasurements, db.outbox], async () => {
        const exerciseId = await applyOperation(db, 'customExercise.create', null, fields);
        await applyOperation(db, 'workoutExercise.create', null, { workoutId, exerciseId: exerciseId! });
    });
}

export async function startOrResumeWorkout(db: AccountDatabase, gymId: string): Promise<string> {
    return db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.customExercises, db.userMeasurements, db.outbox], async () => {
        const active = await db.workouts.filter(workout => workout.endTime === null).first();
        if (active) return active.gymId;
        await applyOperation(db, 'workout.start', null, { gymId, startTime: Date.now() });
        return gymId;
    });
}

// Read-modify-write inside the transaction avoids losing a set added from another tab.
export async function editWorkoutSets(db: AccountDatabase, id: string, edit: (sets: WorkoutSet[]) => WorkoutSet[]) {
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.workoutExercises, db.customExercises, db.userMeasurements, db.outbox], async () => {
        const exercise = await db.workoutExercises.get(id);
        if (!exercise) throw new Error('record_not_found');
        await applyOperation(db, 'workoutExercise.update', id, { sets: edit(exercise.sets) });
    });
}
