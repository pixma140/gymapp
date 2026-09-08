import fs from 'node:fs/promises';
import path from 'node:path';

export function databasePath(env = process.env) {
    return path.resolve(env.DATA_DIR ?? '/app/data', 'gymapp.db');
}

// All application processes (server/reset) hold this lease while using the file.
// Do not guess whether another PID is alive: a container may use a different PID namespace.
export async function acquireDatabaseLease(filename) {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    const lockPath = `${filename}.lock`;
    let file;
    try {
        file = await fs.open(lockPath, 'wx');
    } catch (error) {
        if (error.code === 'EEXIST') throw new Error('database_in_use: stop the server before resetting or starting another instance');
        throw error;
    }
    try {
        await file.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    } catch (error) {
        await file.close();
        await fs.unlink(lockPath);
        throw error;
    }
    let released = false;
    return async () => {
        if (released) return;
        released = true;
        await file.close();
        await fs.unlink(lockPath);
    };
}
