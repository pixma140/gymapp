export type MuscleGroup = 'chest' | 'shoulders' | 'traps' | 'lats' | 'middleBack' | 'lowerBack'
    | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'quadriceps' | 'hamstrings' | 'glutes'
    | 'abductors' | 'adductors' | 'calves' | 'cardio';
export interface CatalogExercise {
    readonly id: string;
    readonly name: string;
    readonly equipment: string;
    readonly muscleGroup: MuscleGroup;
}
export const EXERCISE_SOURCE: Readonly<{ repository: string; revision: string }>;
export const EXERCISES: readonly Readonly<CatalogExercise>[];
export const EXERCISE_IDS: ReadonlySet<string>;
