import sqlite3 from 'sqlite3';
import { SNAPSHOT_TABLES } from '../shared/syncSchema.js';

export function openDatabase(filename) {
    const db = new sqlite3.Database(filename);
    function runSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function onRun(error) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({ changes: this.changes ?? 0, lastID: this.lastID ?? 0 });
            });
        });
    }

    function getSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (error, row) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(row ?? null);
            });
        });
    }

    function allSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(rows ?? []);
            });
        });
    }

    async function initDatabase() {
        await runSql('PRAGMA journal_mode = WAL;').catch(() => {});

        // Account / auth tables keep a simple integer primary key.
        await runSql('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, passwordHash TEXT, isAdmin INTEGER DEFAULT 0, oidcSubject TEXT, oidcIssuer TEXT, name TEXT NOT NULL, email TEXT, weight REAL, height REAL, bodyFat REAL, age INTEGER, gender TEXT, reminderFrequency TEXT, language TEXT, theme TEXT, mainColor TEXT, createdAt INTEGER, lastLoginAt INTEGER)');
        await runSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)').catch(() => {});
        await runSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc ON users(oidcIssuer, oidcSubject)').catch(() => {});

        await runSql('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)');
        await runSql('CREATE TABLE IF NOT EXISTS oidc_states (state TEXT PRIMARY KEY, codeVerifier TEXT NOT NULL, nonce TEXT NOT NULL, expiresAt INTEGER NOT NULL)');
        await runSql('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, expiresAt INTEGER NOT NULL)');
        await runSql('CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)');

        // User-scoped data tables use composite primary keys `(userId, id)`.
        await runSql('CREATE TABLE IF NOT EXISTS userMeasurements (userId INTEGER NOT NULL, id INTEGER NOT NULL, weight REAL, bodyFat REAL, timestamp INTEGER NOT NULL, PRIMARY KEY (userId, id))');
        await runSql('CREATE TABLE IF NOT EXISTS gyms (userId INTEGER NOT NULL, id INTEGER NOT NULL, name TEXT NOT NULL, location TEXT, lastVisited INTEGER NOT NULL, visitCount INTEGER NOT NULL, PRIMARY KEY (userId, id))');
        await runSql('CREATE TABLE IF NOT EXISTS exercises (userId INTEGER NOT NULL, id INTEGER NOT NULL, name TEXT NOT NULL, muscleGroup TEXT, PRIMARY KEY (userId, id))');
        await runSql('CREATE TABLE IF NOT EXISTS gymEquipments (userId INTEGER NOT NULL, id INTEGER NOT NULL, gymId INTEGER NOT NULL, exerciseId INTEGER NOT NULL, equipmentName TEXT NOT NULL, conversionFactor REAL NOT NULL, PRIMARY KEY (userId, id))');
        await runSql('CREATE TABLE IF NOT EXISTS workouts (userId INTEGER NOT NULL, id INTEGER NOT NULL, gymId INTEGER NOT NULL, startTime INTEGER NOT NULL, endTime INTEGER, duration INTEGER, PRIMARY KEY (userId, id))');
        await runSql('CREATE TABLE IF NOT EXISTS workoutSets (userId INTEGER NOT NULL, id INTEGER NOT NULL, workoutId INTEGER NOT NULL, exerciseId INTEGER NOT NULL, gymEquipmentId INTEGER, type TEXT NOT NULL, setNumber INTEGER NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL, rpe REAL, timestamp INTEGER NOT NULL, PRIMARY KEY (userId, id))');

        for (const table of SNAPSHOT_TABLES) {
            await runSql(`CREATE INDEX IF NOT EXISTS idx_${table}_userId ON ${table}(userId)`).catch(() => {});
        }
    }


    // Every public operation joins the same queue. A transaction holds its slot
    // across awaits, so unrelated statements cannot enter its commit/rollback.
    let tail = Promise.resolve();
    let closing = false;
    function enqueue(operation) {
        if (closing) return Promise.reject(new Error('database_closed'));
        const result = tail.then(operation);
        tail = result.catch(() => {});
        return result;
    }
    const statements = { runSql, getSql, allSql };
    return {
        runSql: (...args) => enqueue(() => runSql(...args)),
        getSql: (...args) => enqueue(() => getSql(...args)),
        allSql: (...args) => enqueue(() => allSql(...args)),
        initDatabase: () => enqueue(initDatabase),
        transaction: operation => enqueue(async () => {
            await runSql('BEGIN IMMEDIATE');
            let active = true;
            const scoped = Object.fromEntries(Object.entries(statements).map(([name, statement]) => [name, (...args) => {
                if (!active) return Promise.reject(new Error('transaction_closed'));
                return statement(...args);
            }]));
            try {
                const result = await operation(scoped);
                active = false;
                await runSql('COMMIT');
                return result;
            } catch (error) {
                active = false;
                await runSql('ROLLBACK');
                throw error;
            }
        }),
        close: () => {
            if (closing) return tail;
            closing = true;
            tail = tail.then(() => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())));
            return tail;
        },
    };
}
