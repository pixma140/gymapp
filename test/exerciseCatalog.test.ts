import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { validate as uuidValidate, v7 as uuidv7, version as uuidVersion } from 'uuid';
import { EXERCISES } from '@shared/exercises';
import { getExerciseCatalog, MUSCLE_GROUP_SECTIONS, rankExercises } from '@/lib/exerciseCatalog';
import { AccountDatabase } from '@/db/db';
import { applyOperation } from '@/db/operations';
import type { WorkoutExercise } from '@shared/commands';

const opened: AccountDatabase[] = [];
afterEach(async () => {
    for (const db of opened.splice(0)) await db.delete();
});

describe('exercise catalog', () => {
    it('covers requested grouped filters and includes custom cardio activities', () => {
        const catalog = getExerciseCatalog('en');
        expect(MUSCLE_GROUP_SECTIONS.map(section => section.groups)).toEqual([
            ['chest', 'shoulders', 'traps', 'lats', 'middleBack', 'lowerBack', 'biceps', 'triceps', 'forearms', 'abs'],
            ['quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves'],
            ['cardio'],
        ]);
        expect(EXERCISES).toHaveLength(80);
        expect(new Set(EXERCISES.map(exercise => exercise.id)).size).toBe(80);
        expect(EXERCISES.every(exercise => uuidValidate(exercise.id) && uuidVersion(exercise.id) === 7)).toBe(true);
        expect(EXERCISES.filter(exercise => exercise.source.type === 'github')).toHaveLength(75);
        expect(EXERCISES.filter(exercise => exercise.source.type === 'cardio')).toHaveLength(5);
        expect(catalog.filter(exercise => exercise.muscleGroup === 'cardio').map(exercise => exercise.name))
            .toEqual(expect.arrayContaining(['Walking pad', 'StairMaster', 'Jogging', 'Inline skating', 'Swimming']));
        expect(EXERCISES.every(exercise => exercise.names.en && exercise.names.de
            && exercise.instructions.en.length && exercise.instructions.de.length)).toBe(true);
    });

    it('sorts by historical use count and filters by normalized muscle group', () => {
        const chest = getExerciseCatalog('en').filter(exercise => exercise.muscleGroup === 'chest').slice(0, 3);
        const use = (exerciseId: string, index: number): WorkoutExercise => ({
            id: `00000000-0000-7000-8000-${String(index).padStart(12, '0')}`,
            workoutId: '00000000-0000-7000-8000-000000000099', exerciseId, revision: 1, sets: [],
        });
        const ranked = rankExercises([use(chest[1].id, 1), use(chest[1].id, 2), use(chest[0].id, 3)], 'en', 'chest');
        expect(ranked.slice(0, 2).map(exercise => exercise.id)).toEqual([chest[1].id, chest[0].id]);
        expect(ranked.every(exercise => exercise.muscleGroup === 'chest')).toBe(true);
    });
    it('searches custom exercises alongside the bundled catalog without losing usage order', () => {
        const custom = { id: uuidv7(), name: 'My Bench Press', muscleGroup: 'chest' as const, revision: 1 };
        const ranked = rankExercises([{ id: uuidv7(), workoutId: uuidv7(), exerciseId: custom.id, revision: 1, sets: [] }], 'en', 'chest', [custom], ' BENCH ');
        expect(ranked[0]).toMatchObject({ id: custom.id, name: custom.name, source: { type: 'user' } });
        expect(ranked.every(exercise => exercise.name.toLowerCase().includes('bench'))).toBe(true);
        expect(rankExercises([], 'en', 'calves', [custom], 'My Bench')).toEqual([]);
    });

    it('displays the active language while searching both languages', () => {
        const german = rankExercises([], 'de', undefined, [], 'Barbell Bench Press');
        expect(german.find(exercise => exercise.names.en === 'Barbell Bench Press')?.name).toBe('Langhantel-Bankdrücken');
        expect(rankExercises([], 'en', undefined, [], 'Langhantel-Bankdrücken')
            .find(exercise => exercise.names.en === 'Barbell Bench Press')?.name).toBe('Barbell Bench Press');
    });

    it('matches reordered words and conservative spelling mistakes', () => {
        expect(rankExercises([], 'en', undefined, [], 'cable row seated')[0].name).toBe('Seated Cable Rows');
        expect(rankExercises([], 'en', undefined, [], 'seeted cable row')[0].name).toBe('Seated Cable Rows');
        expect(rankExercises([], 'de', undefined, [], 'kabelzug rudern sitzend')[0].names.en).toBe('Seated Cable Rows');
        expect(rankExercises([], 'en', undefined, [], 'cable bicycle seated')).toEqual([]);
    });

    it('uses personal history across all groups, within chest, and while searching, updating after deletion', async () => {
        const installationId = uuidv7();
        const first = new AccountDatabase({ installationId, accountId: uuidv7() });
        const second = new AccountDatabase({ installationId, accountId: uuidv7() });
        opened.push(first, second);
        const catalog = getExerciseCatalog('en');
        const chest = catalog.filter(exercise => exercise.muscleGroup === 'chest' && exercise.name.toLowerCase().includes('press')).slice(0, 2);
        const cardio = catalog.find(exercise => exercise.muscleGroup === 'cardio')!;
        const gymId = uuidv7();
        for (const db of [first, second]) {
            await db.gyms.add({ id: gymId, name: 'Shared', location: '', archived: false, revision: 1 });
        }
        const record = async (db: AccountDatabase, exerciseIds: string[]) => {
            const workoutId = (await applyOperation(db, 'workout.start', null, { gymId, startTime: 10 }))!;
            for (const exerciseId of exerciseIds) {
                await applyOperation(db, 'workoutExercise.create', null, { workoutId, exerciseId });
            }
            await applyOperation(db, 'workout.finish', workoutId, { endTime: 20 });
            return workoutId;
        };
        await record(first, [chest[0].id, chest[1].id, cardio.id]);
        const extra = await record(first, [chest[1].id, cardio.id]);
        await record(first, [cardio.id]);
        await record(second, [chest[0].id]);
        const uses = await first.workoutExercises.toArray();
        expect(rankExercises(uses, 'en').slice(0, 3).map(exercise => exercise.id)).toEqual([cardio.id, chest[1].id, chest[0].id]);
        expect(rankExercises(uses, 'en', 'chest').slice(0, 2).map(exercise => exercise.id)).toEqual([chest[1].id, chest[0].id]);
        expect(rankExercises(uses, 'en', undefined, [], ' PRESS ')[0].id).toBe(chest[1].id);
        expect(rankExercises(uses, 'en', 'chest', [], ' PRESS ')[0].id).toBe(chest[1].id);
        expect(rankExercises(await second.workoutExercises.toArray(), 'en')[0].id).toBe(chest[0].id);
        await applyOperation(first, 'workout.delete', extra, {});
        const tied = [...chest].sort((left, right) => left.name.localeCompare(right.name));
        expect(rankExercises(await first.workoutExercises.toArray(), 'en', 'chest').slice(0, 2)).toEqual(tied);
    });
});
