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
    name: string;
    location?: string;
    lastVisited: number; // Timestamp
    visitCount: number;
}

export interface Exercise {
    id: number;
    name: string;
    muscleGroup?: string;
}

export interface GymEquipment {
    id: number;
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

export const db = new Dexie('GymAppDB') as Dexie & {
    users: EntityTable<User, 'id'>;
    userMeasurements: EntityTable<UserMeasurement, 'id'>;
    gyms: EntityTable<Gym, 'id'>;
    exercises: EntityTable<Exercise, 'id'>;
    gymEquipments: EntityTable<GymEquipment, 'id'>;
    workouts: EntityTable<Workout, 'id'>;
    workoutSets: EntityTable<WorkoutSet, 'id'>;
};

// Schema definition
db.version(2).stores({
    users: '++id, name, email', // No need to index new fields yet unless searching by them
    gyms: '++id, name, lastVisited, visitCount',
    exercises: '++id, name, muscleGroup',
    gymEquipments: '++id, gymId, exerciseId, equipmentName',
    workouts: '++id, userId, gymId, startTime',
    workoutSets: '++id, workoutId, exerciseId, gymEquipmentId, timestamp'
});

db.version(3).stores({
    userMeasurements: '++id, userId, timestamp'
});
