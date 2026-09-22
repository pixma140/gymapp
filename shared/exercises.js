import catalog from './exercises.json' with { type: 'json' };

export const EXERCISE_CATALOG = Object.freeze(catalog);
export const EXERCISE_SOURCE = Object.freeze(catalog.source);
export const EXERCISE_TAXONOMY = Object.freeze(catalog.taxonomy);
export const EXERCISES = Object.freeze(catalog.exercises);
export const EXERCISE_IDS = new Set(EXERCISES.map(exercise => exercise.id));
