import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { acquireDatabaseLease, databasePath } from './databaseFiles.js';
import { readFixtureCredentials, readServerConfig } from './config.js';

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
    process.loadEnvFile?.();
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

try {
    const config = readServerConfig(process.env);
    const fixtureCredentials = config.seedDevData ? readFixtureCredentials(process.env) : undefined;
    const filename = databasePath({ DATA_DIR: config.dataDir });
    release = await acquireDatabaseLease(filename);
    database = openDatabase(filename);
    await database.initDatabase({ seedDevData: config.seedDevData, fixtureCredentials });
    const { app, bootstrapAdmin } = createApp({
        database,
        config,
    });
    // Fixture installations must preserve intentional role edits on every restart.
    const installation = await database.getSql('SELECT initializationMode FROM installation WHERE singleton = 1');
    if (installation.initializationMode !== 'fixtures') await bootstrapAdmin();
    await new Promise((resolve, reject) => {
        server = app.listen(config.port, resolve);
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
