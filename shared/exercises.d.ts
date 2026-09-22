export type ExerciseLocale = 'en' | 'de';
export type MuscleGroup = 'chest' | 'shoulders' | 'traps' | 'lats' | 'middleBack' | 'lowerBack'
    | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'quadriceps' | 'hamstrings' | 'glutes'
    | 'abductors' | 'adductors' | 'calves' | 'cardio';
export type Equipment = 'barbell' | 'body-weight' | 'cable' | 'cardio-machine' | 'dumbbell'
    | 'ez-barbell' | 'leverage-machine' | 'none' | 'sled-machine' | 'smith-machine';
export type ExerciseSource = Readonly<{ type: 'github'; id: string }>
    | Readonly<{ type: 'cardio'; id: string }>
    | Readonly<{ type: 'user' }>;
export type LocalizedText = Readonly<Record<ExerciseLocale, string>>;
export interface CatalogExercise {
    readonly id: string;
    readonly source: Exclude<ExerciseSource, Readonly<{ type: 'user' }>>;
    readonly names: LocalizedText;
    readonly aliases: Readonly<Record<ExerciseLocale, readonly string[]>>;
    readonly category: string;
    readonly bodyPart: string;
    readonly equipment: Equipment;
    readonly target: string;
    readonly muscleGroup: MuscleGroup;
    readonly synergistMuscle: string;
    readonly secondaryMuscles: readonly string[];
    readonly instructions: Readonly<Record<ExerciseLocale, readonly string[]>>;
    readonly media: Readonly<{ thumbnail: string | null; gif: string | null }>;
}
export interface ExerciseCatalog {
    readonly schemaVersion: 1;
    readonly locales: readonly ExerciseLocale[];
    readonly source: Readonly<{
        repository: string;
        metadataRevision: string;
        germanTranslation: Readonly<{ pullRequest: string; revision: string }>;
        mediaAttribution: Readonly<{ label: string; url: string }>;
    }>;
    readonly taxonomy: Readonly<Record<'categories' | 'bodyParts' | 'equipment' | 'muscles' | 'muscleGroups', Readonly<Record<string, LocalizedText>>>>;
    readonly exercises: readonly Readonly<CatalogExercise>[];
}
export const EXERCISE_CATALOG: Readonly<ExerciseCatalog>;
export const EXERCISE_SOURCE: ExerciseCatalog['source'];
export const EXERCISE_TAXONOMY: ExerciseCatalog['taxonomy'];
export const EXERCISES: readonly Readonly<CatalogExercise>[];
export const EXERCISE_IDS: ReadonlySet<string>;
