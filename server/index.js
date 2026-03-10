import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 80);
const DATA_DIR = process.env.DATA_DIR ?? '/app/data';
const DB_PATH = path.join(DATA_DIR, 'gymapp.db');
const DIST_DIR = path.resolve(__dirname, '../dist');
const SESSION_COOKIE = 'gymapp_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

const TABLE_COLUMNS = {
    users: ['id', 'name', 'email', 'weight', 'height', 'bodyFat', 'age', 'gender', 'reminderFrequency', 'language', 'theme', 'mainColor'],
    userMeasurements: ['id', 'userId', 'weight', 'bodyFat', 'timestamp'],
    gyms: ['id', 'userId', 'name', 'location', 'lastVisited', 'visitCount'],
    exercises: ['id', 'userId', 'name', 'muscleGroup'],
    gymEquipments: ['id', 'userId', 'gymId', 'exerciseId', 'equipmentName', 'conversionFactor'],
    workouts: ['id', 'userId', 'gymId', 'startTime', 'endTime', 'duration'],
    workoutSets: ['id', 'workoutId', 'exerciseId', 'gymEquipmentId', 'type', 'setNumber', 'weight', 'reps', 'rpe', 'timestamp']
};

const USER_SCOPED_TABLES = new Set(['userMeasurements', 'gyms', 'exercises', 'gymEquipments', 'workouts']);

db.serialize(() => {
    const ignoreSqlError = () => {};

    db.run('PRAGMA journal_mode = WAL;', ignoreSqlError);
    db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, passwordHash TEXT, name TEXT NOT NULL, email TEXT, weight REAL, height REAL, bodyFat REAL, age INTEGER, gender TEXT, reminderFrequency TEXT, language TEXT, theme TEXT, mainColor TEXT)', ignoreSqlError);
    db.run('ALTER TABLE users ADD COLUMN username TEXT', ignoreSqlError);
    db.run('ALTER TABLE users ADD COLUMN passwordHash TEXT', ignoreSqlError);
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, expiresAt INTEGER NOT NULL)', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS userMeasurements (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, weight REAL, bodyFat REAL, timestamp INTEGER NOT NULL)', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_userMeasurements_userId ON userMeasurements(userId)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS gyms (id INTEGER PRIMARY KEY, userId INTEGER, name TEXT NOT NULL, location TEXT, lastVisited INTEGER NOT NULL, visitCount INTEGER NOT NULL)', ignoreSqlError);
    db.run('ALTER TABLE gyms ADD COLUMN userId INTEGER', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_gyms_userId ON gyms(userId)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY, userId INTEGER, name TEXT NOT NULL, muscleGroup TEXT)', ignoreSqlError);
    db.run('ALTER TABLE exercises ADD COLUMN userId INTEGER', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_exercises_userId ON exercises(userId)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS gymEquipments (id INTEGER PRIMARY KEY, userId INTEGER, gymId INTEGER NOT NULL, exerciseId INTEGER NOT NULL, equipmentName TEXT NOT NULL, conversionFactor REAL NOT NULL)', ignoreSqlError);
    db.run('ALTER TABLE gymEquipments ADD COLUMN userId INTEGER', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_gymEquipments_userId ON gymEquipments(userId)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, gymId INTEGER NOT NULL, startTime INTEGER NOT NULL, endTime INTEGER, duration INTEGER)', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_workouts_userId ON workouts(userId)', ignoreSqlError);

    db.run('CREATE TABLE IF NOT EXISTS workoutSets (id INTEGER PRIMARY KEY, workoutId INTEGER NOT NULL, exerciseId INTEGER NOT NULL, gymEquipmentId INTEGER, type TEXT NOT NULL, setNumber INTEGER NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL, rpe REAL, timestamp INTEGER NOT NULL)', ignoreSqlError);
    db.run('CREATE INDEX IF NOT EXISTS idx_workoutSets_workoutId ON workoutSets(workoutId)', ignoreSqlError);
});

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

function parseCookies(rawCookieHeader) {
    if (!rawCookieHeader) {
        return {};
    }

    return rawCookieHeader.split(';').reduce((acc, entry) => {
        const [rawKey, ...rest] = entry.trim().split('=');
        if (!rawKey) {
            return acc;
        }

        acc[rawKey] = decodeURIComponent(rest.join('='));
        return acc;
    }, {});
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
}

function verifyPassword(password, passwordHash) {
    const [salt, expected] = String(passwordHash ?? '').split(':');
    if (!salt || !expected) {
        return false;
    }

    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex'));
}

function pickAllowedColumns(table, source) {
    const allowed = TABLE_COLUMNS[table];
    const entries = Object.entries(source).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    return Object.fromEntries(entries);
}

function setSessionCookie(res, sessionId) {
    const secure = COOKIE_SECURE ? '; Secure' : '';
    const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`);
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function createSession(userId, res) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await runSql('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)', [sessionId, userId, expiresAt]);
    setSessionCookie(res, sessionId);
}

async function resolveSessionUser(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) {
        return null;
    }

    const row = await getSql(
        'SELECT users.id, users.username, users.name, users.language, users.theme FROM sessions JOIN users ON users.id = sessions.userId WHERE sessions.id = ? AND sessions.expiresAt > ?',
        [sessionId, Date.now()]
    );

    if (!row) {
        await runSql('DELETE FROM sessions WHERE id = ?', [sessionId]).catch(() => {});
        return null;
    }

    return row;
}

async function ensureWorkoutBelongsToUser(workoutId, userId) {
    const row = await getSql('SELECT id FROM workouts WHERE id = ? AND userId = ?', [workoutId, userId]);
    return Boolean(row);
}

const app = express();

app.use(express.json({ limit: '1mb' }));

app.post('/api/auth/register', async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (username.length < 3 || password.length < 8) {
        res.status(400).json({ ok: false, error: 'invalid_credentials' });
        return;
    }

    try {
        const existing = await getSql('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [username]);
        if (existing) {
            res.status(409).json({ ok: false, error: 'username_taken' });
            return;
        }

        const passwordHash = hashPassword(password);
        const result = await runSql(
            'INSERT INTO users (username, passwordHash, name, language, theme) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, username, 'en', 'dark']
        );

        const user = await getSql('SELECT id, username, name, language, theme FROM users WHERE id = ?', [result.lastID]);
        await createSession(result.lastID, res);
        res.json({ ok: true, user });
    } catch {
        res.status(500).json({ ok: false, error: 'register_failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!username || !password) {
        res.status(400).json({ ok: false, error: 'invalid_credentials' });
        return;
    }

    try {
        const user = await getSql('SELECT id, username, name, language, theme, passwordHash FROM users WHERE username = ? COLLATE NOCASE', [username]);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            res.status(401).json({ ok: false, error: 'invalid_credentials' });
            return;
        }

        await createSession(user.id, res);
        res.json({
            ok: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                language: user.language,
                theme: user.theme
            }
        });
    } catch {
        res.status(500).json({ ok: false, error: 'login_failed' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const user = await resolveSessionUser(req);
        if (!user) {
            res.status(401).json({ ok: false, error: 'unauthorized' });
            return;
        }

        res.json({ ok: true, user });
    } catch {
        res.status(500).json({ ok: false, error: 'session_failed' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const cookies = parseCookies(req.headers.cookie);
        const sessionId = cookies[SESSION_COOKIE];
        if (sessionId) {
            await runSql('DELETE FROM sessions WHERE id = ?', [sessionId]);
        }

        clearSessionCookie(res);
        res.json({ ok: true });
    } catch {
        res.status(500).json({ ok: false, error: 'logout_failed' });
    }
});

app.post('/api/sync', async (req, res) => {
    const authUser = await resolveSessionUser(req);
    if (!authUser) {
        res.status(401).json({ ok: false, error: 'unauthorized' });
        return;
    }

    const { table, operation } = req.body ?? {};
    if (!table || !TABLE_COLUMNS[table]) {
        res.status(400).json({ ok: false, error: 'unsupported_table' });
        return;
    }

    const userId = authUser.id;

    try {
        if (operation === 'upsert') {
            const payload = pickAllowedColumns(table, req.body.data ?? {});

            if (table === 'users') {
                payload.id = userId;
            }

            if (USER_SCOPED_TABLES.has(table)) {
                payload.userId = userId;
            }

            if (table === 'workoutSets') {
                const workoutId = Number(payload.workoutId);
                if (!Number.isFinite(workoutId) || !(await ensureWorkoutBelongsToUser(workoutId, userId))) {
                    res.status(403).json({ ok: false, error: 'forbidden' });
                    return;
                }
            }

            const columns = Object.keys(payload);
            if (columns.length === 0) {
                res.status(400).json({ ok: false, error: 'empty_payload' });
                return;
            }

            const values = columns.map((column) => payload[column]);
            const placeholders = columns.map(() => '?').join(', ');
            const updatableColumns = columns.filter((column) => column !== 'id');

            if (table === 'users') {
                if (updatableColumns.length === 0) {
                    await runSql('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)', [userId, authUser.username ?? authUser.name ?? 'User']);
                } else {
                    const setClause = updatableColumns.map((column) => `${column} = ?`).join(', ');
                    const updateValues = updatableColumns.map((column) => payload[column]);
                    await runSql(`UPDATE users SET ${setClause} WHERE id = ?`, [...updateValues, userId]);
                }

                res.json({ ok: true });
                return;
            }

            if (USER_SCOPED_TABLES.has(table)) {
                if (payload.id !== undefined && updatableColumns.length > 0) {
                    const setClause = updatableColumns.map((column) => `${column} = ?`).join(', ');
                    const updateValues = updatableColumns.map((column) => payload[column]);
                    const updated = await runSql(`UPDATE ${table} SET ${setClause} WHERE id = ? AND userId = ?`, [...updateValues, payload.id, userId]);

                    if (updated.changes === 0) {
                        await runSql(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
                    }
                } else {
                    await runSql(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
                }

                res.json({ ok: true });
                return;
            }

            if (table === 'workoutSets') {
                if (payload.id !== undefined && updatableColumns.length > 0) {
                    const setClause = updatableColumns.map((column) => `${column} = ?`).join(', ');
                    const updateValues = updatableColumns.map((column) => payload[column]);
                    const updated = await runSql(
                        `UPDATE workoutSets SET ${setClause} WHERE id = ? AND workoutId IN (SELECT id FROM workouts WHERE userId = ?)`,
                        [...updateValues, payload.id, userId]
                    );

                    if (updated.changes === 0) {
                        await runSql(`INSERT OR IGNORE INTO workoutSets (${columns.join(', ')}) VALUES (${placeholders})`, values);
                    }
                } else {
                    await runSql(`INSERT INTO workoutSets (${columns.join(', ')}) VALUES (${placeholders})`, values);
                }

                res.json({ ok: true });
                return;
            }
        }

        if (operation === 'update') {
            const id = Number(req.body.id);
            if (!Number.isFinite(id)) {
                res.json({ ok: true });
                return;
            }

            const changes = pickAllowedColumns(table, req.body.changes ?? {});
            delete changes.id;

            if (table === 'users') {
                if (id !== userId) {
                    res.status(403).json({ ok: false, error: 'forbidden' });
                    return;
                }
            }

            if (USER_SCOPED_TABLES.has(table)) {
                changes.userId = userId;
            }

            if (table === 'workoutSets' && changes.workoutId !== undefined) {
                const nextWorkoutId = Number(changes.workoutId);
                if (!Number.isFinite(nextWorkoutId) || !(await ensureWorkoutBelongsToUser(nextWorkoutId, userId))) {
                    res.status(403).json({ ok: false, error: 'forbidden' });
                    return;
                }
            }

            const columns = Object.keys(changes);
            if (columns.length === 0) {
                res.json({ ok: true });
                return;
            }

            const setClause = columns.map((column) => `${column} = ?`).join(', ');
            const values = columns.map((column) => changes[column]);

            if (table === 'users') {
                await runSql(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, userId]);
                res.json({ ok: true });
                return;
            }

            if (USER_SCOPED_TABLES.has(table)) {
                await runSql(`UPDATE ${table} SET ${setClause} WHERE id = ? AND userId = ?`, [...values, id, userId]);
                res.json({ ok: true });
                return;
            }

            if (table === 'workoutSets') {
                await runSql(
                    `UPDATE workoutSets SET ${setClause} WHERE id = ? AND workoutId IN (SELECT id FROM workouts WHERE userId = ?)`,
                    [...values, id, userId]
                );
                res.json({ ok: true });
                return;
            }
        }

        if (operation === 'delete') {
            const id = Number(req.body.id);
            if (!Number.isFinite(id)) {
                res.json({ ok: true });
                return;
            }

            if (table === 'users') {
                if (id !== userId) {
                    res.status(403).json({ ok: false, error: 'forbidden' });
                    return;
                }

                await runSql('DELETE FROM users WHERE id = ?', [userId]);
                await runSql('DELETE FROM sessions WHERE userId = ?', [userId]);
                clearSessionCookie(res);
                res.json({ ok: true });
                return;
            }

            if (USER_SCOPED_TABLES.has(table)) {
                await runSql(`DELETE FROM ${table} WHERE id = ? AND userId = ?`, [id, userId]);
                res.json({ ok: true });
                return;
            }

            if (table === 'workoutSets') {
                await runSql(
                    'DELETE FROM workoutSets WHERE id = ? AND workoutId IN (SELECT id FROM workouts WHERE userId = ?)',
                    [id, userId]
                );
                res.json({ ok: true });
                return;
            }
        }

        res.status(400).json({ ok: false, error: 'unsupported_operation' });
    } catch {
        res.status(500).json({ ok: false, error: 'sync_failed' });
    }
});

app.use(express.static(DIST_DIR));

app.use((_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`GymApp server running on port ${PORT}`);
});
