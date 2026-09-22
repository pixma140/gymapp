import { readFile } from 'node:fs/promises';
import { validate as isUuid, version as uuidVersion } from 'uuid';

const path = new URL('../shared/exercises.json', import.meta.url);
const catalog = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
const requiredLocales = ['en', 'de'];
const requiredTaxonomy = {
    category: 'categories', bodyPart: 'bodyParts', equipment: 'equipment', target: 'muscles',
    synergistMuscle: 'muscles', muscleGroup: 'muscleGroups',
};

if (catalog.schemaVersion !== 1) errors.push('schemaVersion must be 1');
if (JSON.stringify(catalog.locales) !== JSON.stringify(requiredLocales)) errors.push('locales must be ["en","de"]');
if (!Array.isArray(catalog.exercises) || !catalog.exercises.length) errors.push('exercises must be a non-empty array');
if (catalog.exercises?.length !== 80) errors.push('curated catalog must contain exactly 80 exercises');

const ids = new Set();
const sources = new Set();
for (const exercise of catalog.exercises ?? []) {
    const label = exercise?.names?.en ?? exercise?.id ?? 'unknown exercise';
    if (!isUuid(exercise.id) || uuidVersion(exercise.id) !== 7) errors.push(`${label}: id must be a lowercase UUID v7`);
    if (ids.has(exercise.id)) errors.push(`${label}: duplicate id ${exercise.id}`);
    ids.add(exercise.id);
    if (!['github', 'cardio'].includes(exercise?.source?.type) || typeof exercise?.source?.id !== 'string' || !exercise.source.id) {
        errors.push(`${label}: invalid source`);
    } else {
        const source = `${exercise.source.type}:${exercise.source.id}`;
        if (sources.has(source)) errors.push(`${label}: duplicate source ${source}`);
        sources.add(source);
    }
    for (const locale of requiredLocales) {
        if (typeof exercise?.names?.[locale] !== 'string' || !exercise.names[locale].trim()) errors.push(`${label}: missing ${locale} name`);
        if (!Array.isArray(exercise?.aliases?.[locale])) errors.push(`${label}: missing ${locale} aliases`);
        if (!Array.isArray(exercise?.instructions?.[locale]) || !exercise.instructions[locale].length
            || exercise.instructions[locale].some(step => typeof step !== 'string' || !step.trim())) {
            errors.push(`${label}: missing ${locale} instruction steps`);
        }
    }
    if (exercise?.instructions?.de?.some(step => /\bSie\b|\bIhr(?:e|en|em|er|es)?\b/.test(step))) {
        errors.push(`${label}: German instructions must use the informal voice`);
    }
    for (const [field, section] of Object.entries(requiredTaxonomy)) {
        const key = exercise?.[field];
        const entry = catalog?.taxonomy?.[section]?.[key];
        if (!entry) errors.push(`${label}: missing ${section} taxonomy for ${key}`);
        else for (const locale of requiredLocales) if (typeof entry[locale] !== 'string' || !entry[locale].trim()) {
            errors.push(`${label}: missing ${locale} label for ${section}.${key}`);
        }
    }
    if (!Array.isArray(exercise?.secondaryMuscles)) errors.push(`${label}: secondaryMuscles must be an array`);
    else for (const muscle of exercise.secondaryMuscles) if (!catalog?.taxonomy?.muscles?.[muscle]) {
        errors.push(`${label}: missing muscles taxonomy for ${muscle}`);
    }
    const media = exercise?.media;
    if (!media || !Object.hasOwn(media, 'thumbnail') || !Object.hasOwn(media, 'gif')) errors.push(`${label}: missing media fields`);
    if (exercise?.source?.type === 'github' && (!media?.thumbnail || !media?.gif)) errors.push(`${label}: GitHub exercise requires thumbnail and GIF`);
    if (exercise?.source?.type === 'cardio' && (media?.thumbnail !== null || media?.gif !== null)) errors.push(`${label}: local cardio media must be explicit null`);
}

for (const [section, entries] of Object.entries(catalog.taxonomy ?? {})) {
    for (const [key, entry] of Object.entries(entries)) for (const locale of requiredLocales) {
        if (typeof entry?.[locale] !== 'string' || !entry[locale].trim()) errors.push(`missing ${locale} label for ${section}.${key}`);
    }
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Validated ${catalog.exercises.length} exercises from ${path.pathname}`);
}
