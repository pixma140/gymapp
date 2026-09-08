import Dexie, { type EntityTable } from 'dexie';

export interface User {
    id: number;
    name: string;
    email?: string;
    weight?: number; // kg
    height?: number; // cm
    bodyFat?: number; // percentage
    age?: number;
    gender?: 'male' | 'female' | 'other';
    reminderFrequency?: 'daily' | 'weekly' | 'monthly' | 'never';
    language?: 'en' | 'de';
    theme?: 'light' | 'dark' | 'oled' | 'system';
    mainColor?: string; // hex code
}

export interface Gym {
    id: number;
    userId?: number; // Assigned server-side; present on hydrated rows
    name: string;
    location?: string;
    lastVisited: number; // Timestamp
    visitCount: number;
}

export interface Exercise {
    id: number;
    userId?: number; // Assigned server-side; present on hydrated rows
    name: string;
    muscleGroup?: string;
}

export interface GymEquipment {
    id: number;
    userId?: number; // Assigned server-side; present on hydrated rows
    gymId: number;
    exerciseId: number;
    equipmentName: string; // e.g., "Technogym Chest Press"
    conversionFactor: number; // Default 1.0
}

export interface Workout {
    id: number;
    userId: number; // For future sync, can be static 1 for local
    gymId: number;
    startTime: number;
    endTime?: number;
    duration?: number; // Seconds
}

export interface WorkoutSet {
    id: number;
    userId?: number; // Assigned server-side; present on hydrated rows
    workoutId: number;
    exerciseId: number;
    gymEquipmentId?: number; // Optional linking to specific equipment
    type: 'warmup' | 'working';
    setNumber: number;
    weight: number;
    reps: number;
    rpe?: number;
    timestamp: number;
}

export interface UserMeasurement {
    id: number;
    userId: number;
    weight?: number;
    bodyFat?: number;
    timestamp: number;
}

// Local-only outbox row. Buffers mutations that failed to reach the server
// (e.g. while offline) so they can be retried later. Never synced itself.
export interface PendingMutation {
    id: number;
    payload: unknown;
    createdAt: number;
}

export const db = new Dexie('GymAppDB') as Dexie & {
    users: EntityTable<User, 'id'>;
    userMeasurements: EntityTable<UserMeasurement, 'id'>;
    gyms: EntityTable<Gym, 'id'>;
    exercises: EntityTable<Exercise, 'id'>;
    gymEquipments: EntityTable<GymEquipment, 'id'>;
    workouts: EntityTable<Workout, 'id'>;
    workoutSets: EntityTable<WorkoutSet, 'id'>;
    pendingSync: EntityTable<PendingMutation, 'id'>;
};

// Schema definition
db.version(1).stores({
    users: '++id, name, email', // No need to index new fields yet unless searching by them
    userMeasurements: '++id, userId, timestamp',
    gyms: '++id, name, lastVisited, visitCount',
    exercises: '++id, name, muscleGroup',
    gymEquipments: '++id, gymId, exerciseId, equipmentName',
    workouts: '++id, userId, gymId, startTime',
    workoutSets: '++id, workoutId, exerciseId, gymEquipmentId, timestamp',
    pendingSync: '++id, createdAt'
});

// Seed default exercises on first DB creation
db.on('populate', (tx) => {
    tx.table('exercises').bulkAdd([
        { name: 'exercise.name.alternatingDumbbellHammerCurls', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.barbellBenchPress', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.barbellDragCurl', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.barbellPreacherCurl', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.barbellRomanianDeadlift', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.barbellSquat', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.bentOverRearDeltoidRaise', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.butterflyMachine', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.cableBicepCurl', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.cableCrossover', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.cableFrontRaises', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.cableHammerCurl', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.cablePreacherCurl', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.cableRopeTricepsPushdown', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.cableSeatedCrunch', muscleGroup: 'addExercise.muscle.core' },
        { name: 'exercise.name.cableTricepPushdownRope', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.cableTricepsPushdown', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.chestPressMachine', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.chickenWing', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.closeGripBarbellBenchPress', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.closeGripLatPulldown', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.declineBarbellBenchPress', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.declineChestPressMachine', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.declineCrunch', muscleGroup: 'addExercise.muscle.core' },
        { name: 'exercise.name.declineObliqueCrunch', muscleGroup: 'addExercise.muscle.core' },
        { name: 'exercise.name.dumbbellBenchPress', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.ezBarDeclineTricepsExtension', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.flatBenchLegRaises', muscleGroup: 'addExercise.muscle.core' },
        { name: 'exercise.name.hackSquatMachine', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.hangingKneeRaise', muscleGroup: 'addExercise.muscle.core' },
        { name: 'exercise.name.hangingLegRaise', muscleGroup: 'addExercise.muscle.core' },
        { name: 'exercise.name.hyperextensions', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.inclineBarbellBenchPress', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.inclineDumbbellBicepCurls', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.inclineDumbbellFly', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.inlineSkating', muscleGroup: 'addExercise.muscle.cardio' },
        { name: 'exercise.name.cablePullFromBelow', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.kingKong', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.legExtensions', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.legPress', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.legPressLaying', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.lyingLegCurl', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.overheadCableTricepsExtension', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.pendulumSquatMachine', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.reverseButterflyStanding', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.reverseFlyMachine', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.seatedBarbellCalfRaise', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.seatedCableRows', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.seatedCalfRaiseMachine', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.seatedLegCurl', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.seatedRowMachine', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.seatedShoulderPressMachine', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.singleLegExtensions', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.smithMachineBenchPress', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.smithMachineInclineBenchPress', muscleGroup: 'addExercise.muscle.chest' },
        { name: 'exercise.name.smithMachineSquats', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.stairmaster', muscleGroup: 'addExercise.muscle.cardio' },
        { name: 'exercise.name.standingCableReverseFly', muscleGroup: 'addExercise.muscle.shoulders' },
        { name: 'exercise.name.standingCalfRaiseMachine', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.swimming', muscleGroup: 'addExercise.muscle.cardio' },
        { name: 'exercise.name.thighAbductor', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.thighAdductor', muscleGroup: 'addExercise.muscle.legs' },
        { name: 'exercise.name.tricepsDips', muscleGroup: 'addExercise.muscle.arms' },
        { name: 'exercise.name.vBarPulldown', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.wideGripLatPullDown', muscleGroup: 'addExercise.muscle.back' },
        { name: 'exercise.name.wideVBarPulldown', muscleGroup: 'addExercise.muscle.back' },
    ]);
});
