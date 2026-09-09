import { EXERCISES } from '@shared/exercises';
import type { CatalogExercise, MuscleGroup } from '@shared/exercises';
import type { WorkoutExercise } from '@shared/commands';

export const MUSCLE_GROUP_SECTIONS: readonly Readonly<{
    label: 'exercise.group.upperBody' | 'exercise.group.lowerBody' | 'exercise.group.cardio';
    groups: readonly MuscleGroup[];
}>[] = [
    { label: 'exercise.group.upperBody', groups: ['chest', 'shoulders', 'traps', 'lats', 'middleBack', 'lowerBack', 'biceps', 'triceps', 'forearms', 'abs'] },
    { label: 'exercise.group.lowerBody', groups: ['quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves'] },
    { label: 'exercise.group.cardio', groups: ['cardio'] },
];

export function rankExercises(uses: readonly WorkoutExercise[], muscleGroup?: MuscleGroup, custom: readonly CatalogExercise[] = [], search = ''): CatalogExercise[] {
    const counts = new Map<string, number>();
    for (const use of uses) counts.set(use.exerciseId, (counts.get(use.exerciseId) ?? 0) + 1);
    return [...EXERCISES, ...custom].filter(exercise => (!muscleGroup || exercise.muscleGroup === muscleGroup)
        && exercise.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
        .slice()
        .sort((left, right) => (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0)
            || left.name.localeCompare(right.name));
}
