import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { acquireDatabaseLease, databasePath } from './databaseFiles.js';

let database;
let server;
let release;
let stopping;
function shutdown() {
    if (stopping) return stopping;
    stopping = (async () => {
        try {
            if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            if (database) await database.close();
        } finally {
            if (release) await release();
        }
    })();
    return stopping;
}

try {
    const filename = databasePath();
    release = await acquireDatabaseLease(filename);
    database = openDatabase(filename);
    const seedDevData = process.env.SEED_DEV_DATA === 'true';
    await database.initDatabase({ seedDevData });
    const { app, bootstrapAdmin } = createApp({
        database,
        cookieSecure: process.env.COOKIE_SECURE === 'true',
        adminUsername: process.env.ADMIN_USERNAME ?? '',
        publicUrl: process.env.PUBLIC_URL ?? '',
    });
    // Fixture installations must preserve intentional role edits on every restart.
    const installation = await database.getSql('SELECT initializationMode FROM installation WHERE singleton = 1');
    if (installation.initializationMode !== 'fixtures') await bootstrapAdmin();
    await new Promise((resolve, reject) => {
        server = app.listen(Number(process.env.PORT ?? 80), resolve);
        server.once('error', reject);
    });
    console.log(`GymApp server running on port ${server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => void shutdown().catch(error => {
            console.error('Shutdown failed', error);
            process.exitCode = 1;
        }));
    }
} catch (error) {
    console.error('Failed to start server', error);
    await shutdown();
    process.exitCode = 1;
}
