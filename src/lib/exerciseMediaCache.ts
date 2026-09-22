import { EXERCISES, EXERCISE_SOURCE } from '@shared/exercises';

export type ExerciseMediaCacheStatus = Readonly<{
    state: 'unsupported' | 'idle' | 'downloading' | 'complete' | 'error';
    cached: number;
    total: number;
    failed: number;
    bytes: number;
}>;

export const EXERCISE_MEDIA_CACHE = `gymapp-exercise-media-${EXERCISE_SOURCE.metadataRevision}`;
const PREFIX = 'gymapp-exercise-media-';
const urls = EXERCISES.flatMap(exercise => [exercise.media.thumbnail, exercise.media.gif]).filter((url): url is string => Boolean(url));
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;
let status: ExerciseMediaCacheStatus = {
    state: typeof caches === 'undefined' ? 'unsupported' : 'idle', cached: 0, total: urls.length, failed: 0, bytes: 0,
};

const publish = (next: ExerciseMediaCacheStatus) => {
    status = Object.freeze(next);
    for (const listener of listeners) listener();
};

export const getExerciseMediaCacheStatus = () => status;
export const subscribeExerciseMediaCache = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

async function removeOldCaches() {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== EXERCISE_MEDIA_CACHE) await caches.delete(name);
}

async function cachedBytes(cache: Cache) {
    let bytes = 0;
    for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (response) bytes += (await response.blob()).size;
    }
    return bytes;
}

export async function refreshExerciseMediaCacheStatus() {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(EXERCISE_MEDIA_CACHE);
    let cached = 0;
    for (const url of urls) if (await cache.match(url)) cached++;
    publish({ state: cached === urls.length ? 'complete' : 'idle', cached, total: urls.length, failed: 0, bytes: await cachedBytes(cache) });
}

export function cacheExerciseMedia(): Promise<void> {
    if (running) return running;
    if (typeof caches === 'undefined') return Promise.resolve();
    running = (async () => {
        await removeOldCaches();
        const cache = await caches.open(EXERCISE_MEDIA_CACHE);
        let cached = 0;
        let failed = 0;
        for (const url of urls) if (await cache.match(url)) cached++;
        publish({ ...status, state: 'downloading', cached, total: urls.length, failed: 0 });
        let index = 0;
        const worker = async () => {
            while (index < urls.length) {
                const url = urls[index++];
                if (await cache.match(url)) continue;
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    await cache.put(url, response);
                    cached++;
                } catch (error) {
                    console.warn(`Could not cache exercise media ${url}`, error);
                    failed++;
                }
                publish({ ...status, state: 'downloading', cached, total: urls.length, failed });
            }
        };
        await Promise.all(Array.from({ length: 4 }, worker));
        publish({ state: failed ? 'error' : 'complete', cached, total: urls.length, failed, bytes: await cachedBytes(cache) });
    })().catch(error => {
        console.warn('Could not prepare the exercise media cache', error);
        publish({ ...status, state: 'error', failed: Math.max(1, status.failed) });
    }).finally(() => { running = null; });
    return running;
}

export async function clearExerciseMediaCache() {
    if (typeof caches === 'undefined') return;
    await caches.delete(EXERCISE_MEDIA_CACHE);
    publish({ state: 'idle', cached: 0, total: urls.length, failed: 0, bytes: 0 });
}
