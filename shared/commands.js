export const PROFILE_COLUMNS = ['name', 'email', 'weight', 'height', 'bodyFat', 'age', 'gender', 'reminderFrequency', 'language', 'timeFormat', 'theme', 'mainColor'];
export const COMMAND_FIELDS = Object.freeze({
    'profile.update': PROFILE_COLUMNS,
    'measurement.create': ['weight', 'bodyFat', 'timestamp'],
    'measurement.update': ['weight', 'bodyFat', 'timestamp'],
    'measurement.delete': [],
    'workout.start': ['gymId', 'startTime'],
    'workout.finish': ['endTime'],
    'workout.update': ['startTime', 'endTime'],
    'workout.delete': [],
    'workoutExercise.create': ['workoutId', 'exerciseId'],
    'workoutExercise.update': ['sets', 'cardio'],
    'workoutExercise.delete': [],
    'customExercise.create': ['name', 'muscleGroup'],
    'gym.create': ['name', 'location'],
    'gym.update': ['name', 'location'],
    'gym.archive': ['archived'],
});
export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const timestamp = value => Number.isSafeInteger(value) && value >= 0;

export function validateCommand(command) {
    if (!object(command) || typeof command.operation !== 'string' || !Object.hasOwn(COMMAND_FIELDS, command.operation)) return 'unsupported_operation';
    const keys = ['mutationId', 'accountId', 'installationId', 'operation', 'targetId', 'expectedRevision', 'payload'];
    if (Object.keys(command).length !== keys.length || keys.some(key => !Object.hasOwn(command, key))) return 'invalid_command';
    if (!isUuid(command.mutationId) || !isUuid(command.installationId) || !isUuid(command.accountId)) return 'invalid_binding';
    if (command.operation === 'profile.update' ? command.targetId !== null : !isUuid(command.targetId)) return 'invalid_target';
    const create = ['measurement.create', 'workout.start', 'workoutExercise.create', 'customExercise.create', 'gym.create'].includes(command.operation);
    if (create ? command.expectedRevision !== null : !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 1) return 'invalid_revision';
    const payload = command.payload;
    if (!object(payload) || Object.keys(payload).some(key => !COMMAND_FIELDS[command.operation].includes(key))) return 'invalid_payload';
    if (!command.operation.endsWith('.delete') && Object.keys(payload).length === 0) return 'invalid_payload';
    const required = create || ['workout.finish', 'gym.archive'].includes(command.operation) ? COMMAND_FIELDS[command.operation] : [];
    if (required.some(key => !Object.hasOwn(payload, key))) return 'invalid_payload';
    if (command.operation === 'workoutExercise.update' && Object.keys(payload).length !== 1) return 'invalid_payload';
    if (command.operation === 'workout.update' && (!Object.hasOwn(payload, 'startTime')
        || (Object.hasOwn(payload, 'endTime') && payload.endTime < payload.startTime))) return 'invalid_payload';
    for (const [key, value] of Object.entries(payload)) {
        if (key === 'muscleGroup' && !['chest', 'shoulders', 'traps', 'lats', 'middleBack', 'lowerBack', 'biceps', 'triceps', 'forearms', 'abs', 'quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves', 'cardio'].includes(value)) return 'invalid_payload';
        if (key === 'sets' && (!Array.isArray(value) || value.length > 200 || new Set(value.map(set => set?.id)).size !== value.length
            || !value.every(set => object(set) && Object.keys(set).sort().join(',') === 'id,reps,type,weight' && isUuid(set.id)
                && typeof set.weight === 'number' && Number.isFinite(set.weight) && set.weight >= 0 && set.weight <= 10000
                 && Number.isSafeInteger(set.reps) && set.reps > 0 && set.reps <= 10000 && ['warmup', 'working'].includes(set.type)))) return 'invalid_payload';
        if (key === 'cardio' && !validCardio(value)) return 'invalid_payload';
        if (['weight', 'height'].includes(key) && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return 'invalid_payload';
        if (key === 'bodyFat' && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) return 'invalid_payload';
        if (key === 'age' && value !== null && (!Number.isSafeInteger(value) || value <= 0)) return 'invalid_payload';
        if (['timestamp', 'startTime', 'endTime'].includes(key) && !timestamp(value)) return 'invalid_payload';
        if (key === 'name' && (typeof value !== 'string' || !value.trim() || value.length > 200)) return 'invalid_payload';
        if (key === 'location' && (typeof value !== 'string' || value.length > 500)) return 'invalid_payload';
        if (key === 'email' && value !== null && (typeof value !== 'string' || value.length > 320)) return 'invalid_payload';
        if (key === 'mainColor' && value !== null && (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) return 'invalid_payload';
        if (key === 'gender' && value !== null && !['male', 'female', 'other'].includes(value)) return 'invalid_payload';
        if (key === 'reminderFrequency' && !['daily', 'weekly', 'monthly', 'never'].includes(value)) return 'invalid_payload';
        if (key === 'language' && !['en', 'de'].includes(value)) return 'invalid_payload';
        if (key === 'timeFormat' && !['system', '24h', '12h'].includes(value)) return 'invalid_payload';
        if (key === 'theme' && !['light', 'dark', 'oled', 'system'].includes(value)) return 'invalid_payload';
        if (key === 'gymId' && !isUuid(value)) return 'invalid_payload';
        if (key === 'workoutId' && !isUuid(value)) return 'invalid_payload';
        if (key === 'exerciseId' && !isUuid(value)) return 'invalid_payload';
        if (key === 'archived' && typeof value !== 'boolean') return 'invalid_payload';
    }
    return null;
}

function validCardio(value) {
    if (!object(value) || !['swimming', 'jogging', 'inline-skating', 'stairmaster', 'walking-pad'].includes(value.kind)
        || !Number.isSafeInteger(value.durationSeconds) || value.durationSeconds <= 0 || value.durationSeconds > 604800) return false;
    const keys = Object.keys(value).sort().join(',');
    if (['swimming', 'jogging'].includes(value.kind)) {
        if (keys === 'distanceKm,durationSeconds,kind') return positiveNumber(value.distanceKm, 10000);
        return keys === 'durationSeconds,kind,laps' && Number.isSafeInteger(value.laps) && value.laps > 0 && value.laps <= 100000;
    }
    if (value.kind === 'inline-skating') return keys === 'distanceKm,durationSeconds,kind' && positiveNumber(value.distanceKm, 10000);
    if (value.kind === 'stairmaster') return keys === 'durationSeconds,kind,speed' && positiveNumber(value.speed, 10000);
    return (keys === 'durationSeconds,kind,speed' || keys === 'durationSeconds,inclination,kind,speed')
        && positiveNumber(value.speed, 1000) && (value.inclination === undefined || positiveNumber(value.inclination, 100, true));
}

function positiveNumber(value, maximum, allowZero = false) {
    return typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) && value <= maximum;
}
