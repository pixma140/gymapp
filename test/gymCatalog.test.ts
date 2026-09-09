import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { AccountDatabase, type Gym } from '@/db/db';
import { getRankedGyms } from '@/db/gymCatalog';
import { applyOperation } from '@/db/operations';

const opened: AccountDatabase[] = [];
function account(installationId = uuidv7()) {
    const db = new AccountDatabase({ accountId: uuidv7(), installationId });
    opened.push(db);
    return db;
}
function gym(name: string, archived = false): Gym {
    return { id: uuidv7(), name, location: '', archived, revision: 1 };
}
async function visit(db: AccountDatabase, gymId: string) {
    const id = (await applyOperation(db, 'workout.start', null, { gymId, startTime: 10 }))!;
    await applyOperation(db, 'workout.finish', id, { endTime: 20 });
    return id;
}
afterEach(async () => {
    for (const db of opened.splice(0)) await db.delete();
});

describe('personal gym ranking', () => {
    it('ranks the shared catalog independently for each account, with unvisited gyms last', async () => {
        const first = account();
        const second = account(first.binding.installationId);
        const gyms = [gym('Zulu'), gym('Beta'), gym('Alpha'), gym('Delta'), gym('Archived', true)];
        await first.gyms.bulkAdd(gyms);
        await second.gyms.bulkAdd(gyms);
        await visit(first, gyms[0].id);
        await visit(first, gyms[0].id);
        await visit(first, gyms[1].id);
        await visit(second, gyms[3].id);
        const results = await getRankedGyms(first);
        expect(results.map(({ name, visitCount }) => [name, visitCount])).toEqual([
            ['Zulu', 2], ['Beta', 1], ['Alpha', 0], ['Delta', 0],
        ]);
        expect((await getRankedGyms(second)).map(({ name, visitCount }) => [name, visitCount])).toEqual([
            ['Delta', 1], ['Alpha', 0], ['Beta', 0], ['Zulu', 0],
        ]);
    });

    it('updates weights after finishing or deleting workouts and hides archived gyms', async () => {
        const db = account();
        const gyms = [gym('Alpha'), gym('Zulu')];
        await db.gyms.bulkAdd(gyms);
        const workoutId = (await applyOperation(db, 'workout.start', null, { gymId: gyms[1].id, startTime: 10 }))!;
        expect((await getRankedGyms(db)).map(gym => gym.visitCount)).toEqual([0, 0]);
        await applyOperation(db, 'workout.finish', workoutId, { endTime: 20 });
        expect((await getRankedGyms(db))[0]).toMatchObject({ name: 'Zulu', visitCount: 1 });
        await applyOperation(db, 'workout.delete', workoutId, {});
        expect((await getRankedGyms(db)).map(gym => gym.name)).toEqual(['Alpha', 'Zulu']);
        await visit(db, gyms[1].id);
        await applyOperation(db, 'gym.archive', gyms[1].id, { archived: true });
        expect((await getRankedGyms(db)).map(gym => gym.name)).toEqual(['Alpha']);
    });
});
