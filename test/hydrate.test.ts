import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { hydrateFromServer } from '@/db/hydrate';

interface SnapshotPayload {
    ok: boolean;
    user: unknown;
    tables: Record<string, unknown[]>;
    error?: string;
}

function mockSnapshot(payload: SnapshotPayload, { ok = true } = {}): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
            ok,
            json: async () => payload,
        }))
    );
}

afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
    await db.open();
});

describe('hydrateFromServer', () => {
    it('replaces local data with the server snapshot and reports a hydrated user', async () => {
        // Seed some stale local data that hydration must clear.
        await db.gyms.put({ id: 99, name: 'Stale Gym', lastVisited: 0, visitCount: 0 });

        mockSnapshot({
            ok: true,
            user: { id: 1, name: 'Alice' },
            tables: {
                gyms: [{ id: 1, userId: 1, name: 'Server Gym', lastVisited: 5, visitCount: 3 }],
                exercises: [{ id: 1, userId: 1, name: 'Bench Press', muscleGroup: 'addExercise.muscle.chest' }],
                workouts: [],
                workoutSets: [],
                gymEquipments: [],
                userMeasurements: [],
            },
        });

        const hydrated = await hydrateFromServer();

        expect(hydrated).toBe(true);
        const gyms = await db.gyms.toArray();
        expect(gyms).toHaveLength(1);
        expect(gyms[0].name).toBe('Server Gym');
        expect(gyms[0].userId).toBe(1);

        const exercises = await db.exercises.toArray();
        expect(exercises).toHaveLength(1);

        const user = await db.users.get(1);
        expect(user?.name).toBe('Alice');
    });

    it('clears local data and returns false when the account has no profile yet', async () => {
        await db.gyms.put({ id: 7, name: 'Local Only', lastVisited: 0, visitCount: 0 });

        mockSnapshot({
            ok: true,
            user: null,
            tables: { gyms: [], exercises: [], workouts: [], workoutSets: [], gymEquipments: [], userMeasurements: [] },
        });

        const hydrated = await hydrateFromServer();

        expect(hydrated).toBe(false);
        expect(await db.gyms.count()).toBe(0);
        expect(await db.users.count()).toBe(0);
    });

    it('leaves local data untouched and returns false on a failed request', async () => {
        await db.gyms.put({ id: 3, name: 'Keep Me', lastVisited: 0, visitCount: 0 });

        mockSnapshot({ ok: false, user: null, tables: {}, error: 'unauthorized' }, { ok: false });

        const hydrated = await hydrateFromServer();

        expect(hydrated).toBe(false);
        const gyms = await db.gyms.toArray();
        expect(gyms).toHaveLength(1);
        expect(gyms[0].name).toBe('Keep Me');
    });
});
