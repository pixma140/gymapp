import { EXERCISES, EXERCISE_TAXONOMY } from '@shared/exercises';
import type { CatalogExercise, ExerciseLocale, ExerciseSource, MuscleGroup } from '@shared/exercises';
import type { CustomExercise, WorkoutExercise } from '@shared/commands';

export interface DisplayExercise {
    id: string;
    source: ExerciseSource;
    name: string;
    names: Readonly<Record<ExerciseLocale, string>>;
    equipment: string;
    muscleGroup: MuscleGroup;
    catalog?: Readonly<CatalogExercise>;
}

export const MUSCLE_GROUP_SECTIONS: readonly Readonly<{
    label: 'exercise.group.upperBody' | 'exercise.group.lowerBody' | 'exercise.group.cardio';
    groups: readonly MuscleGroup[];
}>[] = [
    { label: 'exercise.group.upperBody', groups: ['chest', 'shoulders', 'traps', 'lats', 'middleBack', 'lowerBack', 'biceps', 'triceps', 'forearms', 'abs'] },
    { label: 'exercise.group.lowerBody', groups: ['quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves'] },
    { label: 'exercise.group.cardio', groups: ['cardio'] },
];

export function localizeExercise(exercise: Readonly<CatalogExercise>, locale: ExerciseLocale): DisplayExercise {
    return {
        id: exercise.id,
        source: exercise.source,
        name: exercise.names[locale],
        names: exercise.names,
        equipment: EXERCISE_TAXONOMY.equipment[exercise.equipment][locale],
        muscleGroup: exercise.muscleGroup,
        catalog: exercise,
    };
}

export function localizeCustomExercise(exercise: CustomExercise): DisplayExercise {
    return {
        id: exercise.id,
        source: { type: 'user' },
        name: exercise.name,
        names: { en: exercise.name, de: exercise.name },
        equipment: '',
        muscleGroup: exercise.muscleGroup,
    };
}

export function getExerciseCatalog(locale: ExerciseLocale, custom: readonly CustomExercise[] = []): DisplayExercise[] {
    return [...EXERCISES.map(exercise => localizeExercise(exercise, locale)), ...custom.map(localizeCustomExercise)];
}

function searchText(exercise: DisplayExercise): string {
    const catalog = exercise.catalog;
    if (!catalog) return exercise.name;
    const taxonomy = [
        EXERCISE_TAXONOMY.categories[catalog.category], EXERCISE_TAXONOMY.bodyParts[catalog.bodyPart],
        EXERCISE_TAXONOMY.equipment[catalog.equipment], EXERCISE_TAXONOMY.muscles[catalog.target],
        EXERCISE_TAXONOMY.muscles[catalog.synergistMuscle], EXERCISE_TAXONOMY.muscleGroups[catalog.muscleGroup],
        ...catalog.secondaryMuscles.map(key => EXERCISE_TAXONOMY.muscles[key]),
    ];
    return [exercise.names.en, exercise.names.de, ...catalog.aliases.en, ...catalog.aliases.de,
        ...taxonomy.flatMap(labels => [labels.en, labels.de])].join(' ');
}

export function rankExercises(uses: readonly WorkoutExercise[], locale: ExerciseLocale, muscleGroup?: MuscleGroup,
    custom: readonly CustomExercise[] = [], search = ''): DisplayExercise[] {
    const counts = new Map<string, number>();
    for (const use of uses) counts.set(use.exerciseId, (counts.get(use.exerciseId) ?? 0) + 1);
    const query = search.trim().toLocaleLowerCase(locale);
    return getExerciseCatalog(locale, custom).filter(exercise => (!muscleGroup || exercise.muscleGroup === muscleGroup)
        && (!query || searchText(exercise).toLocaleLowerCase(locale).includes(query)))
        .sort((left, right) => (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0)
            || left.name.localeCompare(right.name, locale));
}
