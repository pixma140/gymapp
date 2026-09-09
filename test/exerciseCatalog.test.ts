import { describe, expect, it } from 'vitest';
import { EXERCISES } from '@shared/exercises';
import { MUSCLE_GROUP_SECTIONS, rankExercises } from '@/lib/exerciseCatalog';
import type { WorkoutExercise } from '@shared/commands';

describe('exercise catalog', () => {
    it('covers requested grouped filters and includes custom cardio activities', () => {
        expect(MUSCLE_GROUP_SECTIONS.map(section => section.groups)).toEqual([
            ['chest', 'shoulders', 'traps', 'lats', 'middleBack', 'lowerBack', 'biceps', 'triceps', 'forearms', 'abs'],
            ['quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves'],
            ['cardio'],
        ]);
        expect(EXERCISES.filter(exercise => exercise.muscleGroup === 'cardio').map(exercise => exercise.name))
            .toEqual(expect.arrayContaining(['Walking pad', 'StairMaster', 'Jogging', 'Inline skating']));
    });

    it('sorts by historical use count and filters by normalized muscle group', () => {
        const chest = EXERCISES.filter(exercise => exercise.muscleGroup === 'chest').slice(0, 3);
        const use = (exerciseId: string, index: number): WorkoutExercise => ({
            id: `00000000-0000-7000-8000-${String(index).padStart(12, '0')}`,
            workoutId: '00000000-0000-7000-8000-000000000099', exerciseId, revision: 1,
        });
        const ranked = rankExercises([use(chest[1].id, 1), use(chest[1].id, 2), use(chest[0].id, 3)], 'chest');
        expect(ranked.slice(0, 2).map(exercise => exercise.id)).toEqual([chest[1].id, chest[0].id]);
        expect(ranked.every(exercise => exercise.muscleGroup === 'chest')).toBe(true);
    });
});
