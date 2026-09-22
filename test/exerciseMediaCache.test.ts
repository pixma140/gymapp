import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryCache {
    readonly responses = new Map<string, Response>();
    async match(input: RequestInfo | URL) {
        const key = input instanceof Request ? input.url : String(input);
        return this.responses.get(key)?.clone();
    }
    async put(input: RequestInfo | URL, response: Response) {
        const key = input instanceof Request ? input.url : String(input);
        this.responses.set(key, response.clone());
    }
    async keys() {
        return [...this.responses.keys()].map(url => new Request(url));
    }
}

describe('exercise media cache', () => {
    const stores = new Map<string, MemoryCache>();
    beforeEach(() => {
        vi.resetModules();
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stores.clear();
        vi.stubGlobal('caches', {
            open: vi.fn(async (name: string) => {
                const cache = stores.get(name) ?? new MemoryCache();
                stores.set(name, cache);
                return cache;
            }),
            keys: vi.fn(async () => [...stores.keys()]),
            delete: vi.fn(async (name: string) => stores.delete(name)),
        });
        vi.stubGlobal('fetch', vi.fn(async () => new Response('media', { status: 200 })));
    });

    it('downloads every catalog asset once, reports progress, and clears it', async () => {
        const media = await import('@/lib/exerciseMediaCache');
        await media.cacheExerciseMedia();
        expect(media.getExerciseMediaCacheStatus()).toMatchObject({ state: 'complete', cached: 150, total: 150, failed: 0 });
        expect(fetch).toHaveBeenCalledTimes(150);
        await media.cacheExerciseMedia();
        expect(fetch).toHaveBeenCalledTimes(150);
        await media.clearExerciseMediaCache();
        expect(media.getExerciseMediaCacheStatus()).toMatchObject({ state: 'idle', cached: 0, total: 150 });
    });

    it('keeps successful assets and exposes failed downloads for retry', async () => {
        let call = 0;
        vi.mocked(fetch).mockImplementation(async () => {
            call++;
            return new Response('media', { status: call === 1 ? 503 : 200 });
        });
        const media = await import('@/lib/exerciseMediaCache');
        await media.cacheExerciseMedia();
        expect(media.getExerciseMediaCacheStatus()).toMatchObject({ state: 'error', cached: 149, failed: 1 });
        await media.cacheExerciseMedia();
        expect(media.getExerciseMediaCacheStatus()).toMatchObject({ state: 'complete', cached: 150, failed: 0 });
    });
});
