/** Replacement protocol. Wired into HTTP/client operations in phases B–E. */
/** Canonical lowercase RFC 9562 UUID v7, checked at runtime by isUuid. */
export type UUID = string;
export type Revision = number;
export interface AccountBinding {
    accountId: UUID;
    installationId: UUID;
}
export interface ProfileFields {
    name: string;
    email: string | null;
    weight: number | null;
    height: number | null;
    bodyFat: number | null;
    age: number | null;
    gender: string | null;
    reminderFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
    language: 'en' | 'de';
    theme: 'light' | 'dark' | 'oled' | 'system';
    mainColor: string | null;
}
export interface Profile extends ProfileFields {
    id: UUID;
    revision: Revision;
}
export interface MeasurementFields {
    weight: number | null;
    bodyFat: number | null;
    timestamp: number;
}
export interface Measurement extends MeasurementFields {
    id: UUID;
    revision: Revision;
}
export interface Workout {
    id: UUID;
    gymId: UUID;
    startTime: number;
    endTime: number | null;
    revision: Revision;
}
export interface WorkoutExercise {
    id: UUID;
    workoutId: UUID;
    exerciseId: string;
    revision: Revision;
    sets: WorkoutSet[];
}
export interface WorkoutSet {
    id: UUID;
    weight: number;
    reps: number;
    type: 'warmup' | 'working';
}
export interface CustomExercise {
    id: UUID;
    name: string;
    muscleGroup: import('./exercises').MuscleGroup;
    revision: Revision;
}
export interface GymFields {
    name: string;
    location: string;
}
export interface Gym extends GymFields {
    id: UUID;
    archived: boolean;
    revision: Revision;
}
export interface CommandPayloads {
    'profile.update': Partial<ProfileFields>;
    'measurement.create': MeasurementFields;
    'measurement.update': Partial<MeasurementFields>;
    'measurement.delete': Record<string, never>;
    'workout.start': { gymId: UUID; startTime: number };
    'workout.finish': { endTime: number };
    'workout.update': { startTime: number; endTime?: number };
    'workout.delete': Record<string, never>;
    'workoutExercise.create': { workoutId: UUID; exerciseId: string };
    'workoutExercise.update': { sets: WorkoutSet[] };
    'workoutExercise.delete': Record<string, never>;
    'customExercise.create': { name: string; muscleGroup: import('./exercises').MuscleGroup };
    'gym.create': GymFields;
    'gym.update': Partial<GymFields>;
    'gym.archive': { archived: boolean };
}
export type Operation = keyof CommandPayloads;
/** Null revision means create; profile targetId is null (bound account). */
export type Command = {
    [K in Operation]: Readonly<AccountBinding & {
        mutationId: UUID;
        operation: K;
        targetId: K extends 'profile.update' ? null : UUID;
        expectedRevision: Revision | null;
        payload: Readonly<CommandPayloads[K]>;
    }>
}[Operation];
export interface Receipt extends AccountBinding {
    mutationId: UUID;
    revision: Revision;
    accountGeneration: number;
    catalogGeneration: number;
}
export interface Snapshot extends AccountBinding {
    accountGeneration: number;
    catalogGeneration: number;
    profile: Profile;
    gyms: Gym[];
    workouts: Workout[];
    workoutExercises: WorkoutExercise[];
    customExercises: CustomExercise[];
    measurements: Measurement[];
}

export const PROFILE_COLUMNS: readonly (keyof ProfileFields)[];
export const COMMAND_FIELDS: Readonly<Record<Operation, readonly string[]>>;
export function isUuid(value: unknown): value is UUID;
export function validateCommand(value: unknown): string | null;
