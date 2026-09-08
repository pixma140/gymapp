import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const dataDir = process.env.DATA_DIR ?? '/app/data';
fs.mkdirSync(dataDir, { recursive: true });
const database = openDatabase(path.join(dataDir, 'gymapp.db'));
const { app, bootstrapAdmin } = createApp({
    database,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    adminUsername: process.env.ADMIN_USERNAME ?? '',
    publicUrl: process.env.PUBLIC_URL ?? '',
});

try {
    await database.initDatabase();
    app.listen(Number(process.env.PORT ?? 80), () => {
        console.log(`GymApp server running on port ${process.env.PORT ?? 80}`);
        void bootstrapAdmin();
    });
} catch (error) {
    console.error('Failed to initialise database', error);
    await database.close();
    process.exitCode = 1;
}
