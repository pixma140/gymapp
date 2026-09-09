import { v7 as uuidv7 } from 'uuid';
import { seedDevelopmentData } from './seed.js';

const uuidCheck = column => `length(${column}) = 36 AND substr(${column}, 9, 1) = '-' AND substr(${column}, 14, 1) = '-' AND substr(${column}, 15, 1) = '7' AND substr(${column}, 19, 1) = '-' AND substr(${column}, 20, 1) IN ('8', '9', 'a', 'b') AND substr(${column}, 24, 1) = '-' AND length(replace(${column}, '-', '')) = 32 AND replace(${column}, '-', '') NOT GLOB '*[^0-9a-f]*'`;
const profileColumns = 'name, email, weight, height, bodyFat, age, gender, reminderFrequency, language, theme, mainColor';

// Alpha schema changes belong directly in this fresh-database DDL.
export async function initializeSchema(tx, { seedDevData = false, fixtureCredentials } = {}) {
    await tx.runSql(`CREATE TABLE IF NOT EXISTS installation (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        id TEXT NOT NULL UNIQUE CHECK (${uuidCheck('id')}),
        catalogGeneration INTEGER NOT NULL DEFAULT 0 CHECK (catalogGeneration >= 0),
        initializationMode TEXT NOT NULL CHECK (initializationMode IN ('empty', 'fixtures'))
    )`);
    await tx.runSql(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL CHECK (${uuidCheck('id')}),
        username TEXT, passwordHash TEXT, isAdmin INTEGER NOT NULL DEFAULT 0 CHECK (isAdmin IN (0, 1)),
        oidcSubject TEXT, oidcIssuer TEXT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0), email TEXT,
        weight REAL CHECK (weight > 0), height REAL CHECK (height > 0), bodyFat REAL CHECK (bodyFat BETWEEN 0 AND 100),
        age INTEGER CHECK (age > 0 AND age = CAST(age AS INTEGER)), gender TEXT CHECK (gender IN ('male', 'female', 'other')),
        reminderFrequency TEXT NOT NULL DEFAULT 'never' CHECK (reminderFrequency IN ('daily', 'weekly', 'monthly', 'never')),
        language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de')),
        theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'oled', 'system')),
        mainColor TEXT, createdAt INTEGER, lastLoginAt INTEGER,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        dataGeneration INTEGER NOT NULL DEFAULT 0 CHECK (dataGeneration >= 0)
    )`);
    await tx.runSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)');
    await tx.runSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc ON users(oidcIssuer, oidcSubject)');
    await tx.runSql('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)');
    await tx.runSql('CREATE TABLE IF NOT EXISTS oidc_states (state TEXT PRIMARY KEY, codeVerifier TEXT NOT NULL, nonce TEXT NOT NULL, expiresAt INTEGER NOT NULL)');
    await tx.runSql('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expiresAt INTEGER NOT NULL)');
    await tx.runSql('CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)');
    await tx.runSql(`CREATE TABLE IF NOT EXISTS gyms (
        id TEXT PRIMARY KEY NOT NULL CHECK (${uuidCheck('id')}), name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        location TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
    )`);
    await tx.runSql(`CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY NOT NULL CHECK (${uuidCheck('id')}), userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gymId TEXT NOT NULL REFERENCES gyms(id) ON DELETE RESTRICT,
        startTime INTEGER NOT NULL CHECK (startTime >= 0), endTime INTEGER CHECK (endTime >= startTime),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
    )`);
    await tx.runSql('CREATE INDEX IF NOT EXISTS idx_workouts_userId ON workouts(userId)');
    await tx.runSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_active ON workouts(userId) WHERE endTime IS NULL');
    await tx.runSql(`CREATE TABLE IF NOT EXISTS customExercises (
        id TEXT PRIMARY KEY NOT NULL CHECK (${uuidCheck('id')}), userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200), muscleGroup TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
    )`);
    await tx.runSql('CREATE INDEX IF NOT EXISTS idx_customExercises_userId ON customExercises(userId)');
    await tx.runSql(`CREATE TABLE IF NOT EXISTS workoutExercises (
        id TEXT PRIMARY KEY NOT NULL CHECK (${uuidCheck('id')}), userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workoutId TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, exerciseId TEXT NOT NULL CHECK (length(exerciseId) BETWEEN 1 AND 100),
        sets TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sets) AND json_type(sets) = 'array'),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0), UNIQUE (workoutId, exerciseId)
    )`);
    await tx.runSql('CREATE INDEX IF NOT EXISTS idx_workoutExercises_userId ON workoutExercises(userId)');
    await tx.runSql(`CREATE TABLE IF NOT EXISTS userMeasurements (
        id TEXT PRIMARY KEY NOT NULL CHECK (${uuidCheck('id')}), userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weight REAL CHECK (weight > 0), bodyFat REAL CHECK (bodyFat BETWEEN 0 AND 100), timestamp INTEGER NOT NULL CHECK (timestamp >= 0),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
    )`);
    await tx.runSql('CREATE INDEX IF NOT EXISTS idx_measurements_userId ON userMeasurements(userId)');
    await tx.runSql(`CREATE TABLE IF NOT EXISTS mutation_receipts (
        userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mutationId TEXT NOT NULL CHECK (${uuidCheck('mutationId')}),
        command TEXT NOT NULL, result TEXT NOT NULL, createdAt INTEGER NOT NULL,
        PRIMARY KEY (userId, mutationId)
    )`);

    // Triggers centralize revision/generation accounting for every SQL write path.
    await tx.runSql(`CREATE TRIGGER IF NOT EXISTS profile_revision AFTER UPDATE OF ${profileColumns} ON users BEGIN
        UPDATE users SET revision = OLD.revision + 1, dataGeneration = OLD.dataGeneration + 1 WHERE id = NEW.id;
    END`);
    for (const [table, columns] of [['workouts', 'gymId, startTime, endTime'], ['workoutExercises', 'workoutId, exerciseId, sets'], ['customExercises', 'name, muscleGroup'], ['userMeasurements', 'weight, bodyFat, timestamp']]) {
        await tx.runSql(`CREATE TRIGGER IF NOT EXISTS ${table}_revision AFTER UPDATE OF ${columns} ON ${table} BEGIN
            UPDATE ${table} SET revision = OLD.revision + 1 WHERE id = NEW.id;
            UPDATE users SET dataGeneration = dataGeneration + 1 WHERE id = NEW.userId;
        END`);
        for (const [operation, row] of [['INSERT', 'NEW'], ['DELETE', 'OLD']]) {
            await tx.runSql(`CREATE TRIGGER IF NOT EXISTS ${table}_${operation.toLowerCase()} AFTER ${operation} ON ${table} BEGIN
                UPDATE users SET dataGeneration = dataGeneration + 1 WHERE id = ${row}.userId;
            END`);
        }
    }
    await tx.runSql(`CREATE TRIGGER IF NOT EXISTS gyms_revision AFTER UPDATE OF name, location, archived ON gyms BEGIN
        UPDATE gyms SET revision = OLD.revision + 1 WHERE id = NEW.id;
        UPDATE installation SET catalogGeneration = catalogGeneration + 1 WHERE singleton = 1;
    END`);
    for (const operation of ['INSERT', 'DELETE']) {
        await tx.runSql(`CREATE TRIGGER IF NOT EXISTS gyms_${operation.toLowerCase()} AFTER ${operation} ON gyms BEGIN
            UPDATE installation SET catalogGeneration = catalogGeneration + 1 WHERE singleton = 1;
        END`);
    }
    const installation = await tx.getSql('SELECT * FROM installation WHERE singleton = 1');
    if (!installation) {
        await tx.runSql('INSERT INTO installation (singleton, id, initializationMode) VALUES (1, ?, ?)',
            [uuidv7(), seedDevData ? 'fixtures' : 'empty']);
        if (seedDevData) await seedDevelopmentData(tx, fixtureCredentials);
    } else if (seedDevData && installation.initializationMode !== 'fixtures') {
        throw new Error('fixtures_require_explicit_reset');
    }
}
