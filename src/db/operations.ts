import type { Command, CommandPayloads, Operation } from '@shared/commands';
import { validateCommand } from '@shared/commands';
import type { AccountDatabase } from './db';

export async function applyOperation<K extends Operation>(db: AccountDatabase, operation: K, targetId: string | null, payload: CommandPayloads[K]): Promise<string | null> {
    const [domain, action] = operation.split('.');
    const table = domain === 'profile' ? db.users : domain === 'gym' ? db.gyms : domain === 'workout' ? db.workouts : db.userMeasurements;
    const create = action === 'create' || action === 'start';
    const id = domain === 'profile' ? db.binding.accountId : targetId ?? crypto.randomUUID();
    await db.transaction('rw', [db.users, db.gyms, db.workouts, db.userMeasurements, db.outbox], async () => {
        const current = await db.table(table.name).get(id);
        if (!create && !current) throw new Error('record_not_found');
        if (operation === 'workout.start') {
            if (await db.workouts.filter(workout => workout.endTime === null).count()) throw new Error('active_workout_exists');
            const start = payload as CommandPayloads['workout.start'];
            const gym = await db.gyms.get(start.gymId);
            if (!gym || gym.archived) throw new Error('gym_unavailable');
        }
        const previous = await db.outbox.filter(entry => entry.command.operation.split('.')[0] === domain && entry.command.targetId === (domain === 'profile' ? null : id)).last();
        const command = { ...db.binding, mutationId: crypto.randomUUID(), operation,
            targetId: domain === 'profile' ? null : id, expectedRevision: create ? null : current.revision || 1, payload } as Command;
        const invalid = validateCommand(command);
        if (invalid) throw new Error(invalid);
        if (action === 'delete') await db.table(table.name).delete(id);
        else await db.table(table.name).put({ ...(create ? { id, revision: 0,
            ...(domain === 'workout' ? { endTime: null } : {}), ...(domain === 'gym' ? { archived: false } : {}) } : current), ...payload });
        await db.outbox.add({ command, dependency: previous?.sequence, attempts: 0, state: 'pending' });
    });
    return typeof id === 'string' ? id : null;
}
