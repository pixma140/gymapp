import { PROFILE_COLUMNS, validateCommand } from '../../shared/commands.js';
import { EXERCISE_IDS } from '../../shared/exercises.js';

const failure = (status, error) => ({ status, error });
const tables = Object.freeze({ profile: 'users', measurement: 'userMeasurements', workout: 'workouts', workoutExercise: 'workoutExercises', gym: 'gyms' });
const canonical = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

export function createSyncService(database) {
    return {
        snapshot: accountId => database.transaction(tx => readSnapshot(tx, accountId)),
        apply: (accountId, command) => database.transaction(async tx => {
            const invalid = validateCommand(command);
            if (invalid) return failure(400, invalid);
            const actor = await tx.getSql('SELECT id, isAdmin FROM users WHERE id = ?', [accountId]);
            if (!actor) return failure(401, 'unauthorized');
            const installation = await tx.getSql('SELECT id FROM installation WHERE singleton = 1');
            if (command.accountId !== accountId || command.installationId !== installation.id) return failure(409, 'account_binding_mismatch');
            const [domain, operation] = command.operation.split('.');
            if (domain === 'gym' && !actor.isAdmin) return failure(403, 'forbidden');
            const serialized = canonical(command);
            const previous = await tx.getSql('SELECT command, result FROM mutation_receipts WHERE userId = ? AND mutationId = ?', [accountId, command.mutationId]);
            if (previous) return previous.command === serialized ? JSON.parse(previous.result) : failure(409, 'mutation_id_reused');
            const table = tables[domain];
            const id = domain === 'profile' ? accountId : command.targetId;
            const privateRecord = ['measurement', 'workout', 'workoutExercise'].includes(domain);
            const current = await tx.getSql(`SELECT * FROM ${table} WHERE id = ?${privateRecord ? ' AND userId = ?' : ''}`, privateRecord ? [id, accountId] : [id]);
            const create = ['create', 'start'].includes(operation);
            if (create && current) return failure(409, 'record_exists');
            if (!create && !current) return failure(404, 'record_not_found');
            if (!create && current.revision !== command.expectedRevision) return failure(409, 'revision_conflict');
            const payload = { ...command.payload };
            if (domain === 'workout' && operation === 'start') {
                const gym = await tx.getSql('SELECT archived FROM gyms WHERE id = ?', [payload.gymId]);
                if (!gym || gym.archived) return failure(409, 'gym_unavailable');
                if (await tx.getSql('SELECT id FROM workouts WHERE userId = ? AND endTime IS NULL', [accountId])) return failure(409, 'active_workout_exists');
            }
            if (domain === 'workout' && operation === 'finish' && (current.endTime !== null || payload.endTime < current.startTime)) return failure(409, 'invalid_workout_finish');
            if (domain === 'workoutExercise' && operation === 'create') {
                const workout = await tx.getSql('SELECT endTime FROM workouts WHERE id = ? AND userId = ?', [payload.workoutId, accountId]);
                if (!workout || workout.endTime !== null) return failure(409, 'workout_unavailable');
                if (!EXERCISE_IDS.has(payload.exerciseId)) return failure(409, 'exercise_unavailable');
                if (await tx.getSql('SELECT id FROM workoutExercises WHERE workoutId = ? AND exerciseId = ?', [payload.workoutId, payload.exerciseId])) {
                    return failure(409, 'exercise_already_selected');
                }
            }
            if (typeof payload.archived === 'boolean') payload.archived = Number(payload.archived);
            if (create) {
                const columns = ['id', ...(privateRecord ? ['userId'] : []), ...Object.keys(payload)];
                const values = [id, ...(privateRecord ? [accountId] : []), ...Object.values(payload)];
                // A UUID already used by another owner is a conflict, never an upsert.
                if (await tx.getSql(`SELECT id FROM ${table} WHERE id = ?`, [id])) return failure(409, 'record_exists');
                await tx.runSql(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
            } else if (operation === 'delete') {
                await tx.runSql(`DELETE FROM ${table} WHERE id = ?`, [id]);
            } else {
                await tx.runSql(`UPDATE ${table} SET ${Object.keys(payload).map(key => `${key} = ?`).join(', ')} WHERE id = ?`, [...Object.values(payload), id]);
            }
            const row = operation === 'delete' ? null : await tx.getSql(`SELECT revision FROM ${table} WHERE id = ?`, [id]);
            const account = await tx.getSql('SELECT dataGeneration FROM users WHERE id = ?', [accountId]);
            const catalog = await tx.getSql('SELECT catalogGeneration FROM installation WHERE singleton = 1');
            const result = {
                accountId, installationId: installation.id, mutationId: command.mutationId,
                revision: row?.revision ?? current.revision + 1,
                accountGeneration: account.dataGeneration, catalogGeneration: catalog.catalogGeneration,
            };
            await tx.runSql('INSERT INTO mutation_receipts (userId, mutationId, command, result, createdAt) VALUES (?, ?, ?, ?, ?)',
                [accountId, command.mutationId, serialized, JSON.stringify(result), Date.now()]);
            return result;
        }),
    };
}

export async function readSnapshot(tx, accountId) {
    const installation = await tx.getSql('SELECT id, catalogGeneration FROM installation WHERE singleton = 1');
    const user = await tx.getSql(`SELECT id, revision, dataGeneration, ${PROFILE_COLUMNS.join(', ')} FROM users WHERE id = ?`, [accountId]);
    if (!user) return failure(401, 'unauthorized');
    const { dataGeneration, ...profile } = user;
    return {
        accountId, installationId: installation.id, accountGeneration: dataGeneration,
        catalogGeneration: installation.catalogGeneration, profile,
        gyms: (await tx.allSql('SELECT * FROM gyms ORDER BY name, id')).map(gym => ({ ...gym, archived: Boolean(gym.archived) })),
        workouts: await tx.allSql('SELECT id, gymId, startTime, endTime, revision FROM workouts WHERE userId = ?', [accountId]),
        workoutExercises: await tx.allSql('SELECT id, workoutId, exerciseId, revision FROM workoutExercises WHERE userId = ?', [accountId]),
        measurements: await tx.allSql('SELECT id, weight, bodyFat, timestamp, revision FROM userMeasurements WHERE userId = ?', [accountId]),
    };
}
