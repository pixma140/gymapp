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

function normalizeSearch(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
        .toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function canonicalToken(token: string): string {
    return token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token;
}

function editDistance(left: string, right: string): number {
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
            current[rightIndex] = Math.min(current[rightIndex - 1] + 1, previous[rightIndex] + 1,
                previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[right.length];
}

function searchScore(exercise: DisplayExercise, search: string): number {
    const query = normalizeSearch(search);
    if (!query) return 1;
    const text = normalizeSearch(searchText(exercise));
    if (text.includes(query)) return 4;
    const queryTokens = query.split(' ').map(canonicalToken);
    const textTokens = [...new Set(text.split(' ').map(canonicalToken))];
    if (queryTokens.every(queryToken => textTokens.includes(queryToken))) return 3;
    if (queryTokens.every(queryToken => queryToken.length >= 3
        && textTokens.some(token => token.startsWith(queryToken)))) return 2;
    const fuzzy = queryTokens.every(queryToken => {
        if (queryToken.length < 4) return textTokens.includes(queryToken);
        const maximumDistance = queryToken.length >= 7 ? 2 : 1;
        return textTokens.some(token => Math.abs(token.length - queryToken.length) <= maximumDistance
            && editDistance(queryToken, token) <= maximumDistance);
    });
    return fuzzy ? 1 : 0;
}

function nameDistance(exercise: DisplayExercise, search: string): number {
    const queryLength = normalizeSearch(search).split(' ').filter(Boolean).length;
    if (!queryLength) return 0;
    const names = [exercise.names.en, exercise.names.de,
        ...(exercise.catalog?.aliases.en ?? []), ...(exercise.catalog?.aliases.de ?? [])];
    return Math.min(...names.map(name => Math.abs(normalizeSearch(name).split(' ').filter(Boolean).length - queryLength)));
}

export function rankExercises(uses: readonly WorkoutExercise[], locale: ExerciseLocale, muscleGroup?: MuscleGroup,
    custom: readonly CustomExercise[] = [], search = ''): DisplayExercise[] {
    const counts = new Map<string, number>();
    for (const use of uses) counts.set(use.exerciseId, (counts.get(use.exerciseId) ?? 0) + 1);
    const scored = getExerciseCatalog(locale, custom).map(exercise => ({
        exercise, score: searchScore(exercise, search), distance: nameDistance(exercise, search),
    }));
    return scored.filter(({ exercise, score }) => score > 0 && (!muscleGroup || exercise.muscleGroup === muscleGroup))
        .sort((left, right) => right.score - left.score
            || (counts.get(right.exercise.id) ?? 0) - (counts.get(left.exercise.id) ?? 0)
            || left.distance - right.distance
            || left.exercise.name.localeCompare(right.exercise.name, locale))
        .map(({ exercise }) => exercise);
}
