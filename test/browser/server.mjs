import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../server/app.js';
import { openDatabase } from '../../server/db.js';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gymapp-browser-'));
const database = openDatabase(path.join(dir, 'gymapp.db'));
await database.initDatabase({ seedDevData: true });
const { app } = createApp({ database });
const server = app.listen(4173, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(async () => { await database.close(); await fs.rm(dir, { recursive: true }); });
});
