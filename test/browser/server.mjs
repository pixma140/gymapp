import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../server/app.js';
import { openDatabase } from '../../server/db.js';
import { readFixtureCredentials, readServerConfig } from '../../server/config.js';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gymapp-browser-'));
const database = openDatabase(path.join(dir, 'gymapp.db'));
const fixtureCredentials = readFixtureCredentials(Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('TEST_SEED_')).map(([key, value]) => [key.slice(5), value])));
await database.initDatabase({ seedDevData: true, fixtureCredentials });
const { app } = createApp({ database, config: readServerConfig({
    PORT: '4173', DATA_DIR: dir, SEED_DEV_DATA: 'true', OIDC_ENABLED: 'false',
    OIDC_ISSUER: 'https://identity.example', OIDC_CLIENT_ID: crypto.randomUUID(), OIDC_CLIENT_SECRET: crypto.randomUUID(),
}) });
const server = app.listen(4173, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(async () => { await database.close(); await fs.rm(dir, { recursive: true }); });
});
