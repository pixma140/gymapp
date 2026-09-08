import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { acquireDatabaseLease, databasePath } from './databaseFiles.js';
import { openDatabase } from './db.js';

export async function resetDatabase(filename, { seedDevData = false } = {}) {
    const release = await acquireDatabaseLease(filename);
    let database;
    try {
        // The server must be stopped and its handles closed before this lease
        // can be acquired. Reset discards all old data, so no WAL checkpoint is
        // needed (old container-created files may be read-only to this process).
        for (const suffix of ['', '-wal', '-shm']) {
            await fs.rm(`${filename}${suffix}`, { force: true });
        }
        database = openDatabase(filename);
        await database.initDatabase({ seedDevData });
        const installation = await database.getSql('SELECT id FROM installation WHERE singleton = 1');
        return installation.id;
    } finally {
        try {
            if (database) await database.close();
        } finally {
            await release();
        }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--seed') || args.length > 1) {
        console.error('Usage: node server/reset.js [--seed]');
        process.exitCode = 1;
    } else {
        try {
            const filename = databasePath();
            const id = await resetDatabase(filename, { seedDevData: args.includes('--seed') });
            console.log(`Reset ${filename}; installation ${id}; fixtures ${args.includes('--seed') ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error(error.message);
            process.exitCode = 1;
        }
    }
}
