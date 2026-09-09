import Dexie, { type EntityTable } from 'dexie';
import { isUuid } from '@shared/commands';
import type { AccountBinding, Command, CommandPayloads, Operation, Profile, Gym, Workout, WorkoutExercise, Measurement } from '@shared/commands';

export type User = Profile;
export type { Gym, Workout, WorkoutExercise };
export type UserMeasurement = Measurement;
export type MutationIntent = {
    [K in Operation]: Readonly<{
        mutationId: string;
        operation: K;
        targetId: K extends 'profile.update' ? null : string;
        payload: Readonly<CommandPayloads[K]>;
    }>
}[Operation];
export interface PendingMutation {
    sequence: number;
    intent: MutationIntent;
    command: Command | null;
    dependency?: number;
    revisionDependency?: boolean;
    attempts: number;
    preflightAttempts?: number;
    state: 'pending' | 'sending' | 'failed' | 'conflict' | 'paused';
    error?: string;
    nextAttemptAt?: number;
}
export interface SyncMetadata extends AccountBinding {
    key: 'state';
    accountGeneration: number;
    catalogGeneration: number;
    lastRefreshed: number;
    lastSuccessfulSync: number;
}
export class AccountDatabase extends Dexie {
    readonly binding: Readonly<AccountBinding>;
    users!: EntityTable<User, 'id'>;
    gyms!: EntityTable<Gym, 'id'>;
    workouts!: EntityTable<Workout, 'id'>;
    workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
    userMeasurements!: EntityTable<UserMeasurement, 'id'>;
    outbox!: EntityTable<PendingMutation, 'sequence'>;
    syncMetadata!: EntityTable<SyncMetadata, 'key'>;

    constructor(binding: AccountBinding) {
        if (!isUuid(binding.installationId) || !isUuid(binding.accountId)) throw new Error('invalid_account_binding');
        super(`GymApp:${binding.installationId}:${binding.accountId}`);
        this.binding = Object.freeze({ ...binding });
        this.version(1).stores({
            users: 'id', gyms: 'id, name', workouts: 'id, gymId, startTime', workoutExercises: 'id, workoutId, exerciseId, &[workoutId+exerciseId]',
            userMeasurements: 'id, timestamp', outbox: '++sequence, state', syncMetadata: 'key',
        });
    }
}
