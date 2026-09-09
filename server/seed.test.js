import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { resetDatabase } from './reset.js';
import { acquireDatabaseLease, databasePath } from './databaseFiles.js';
import { DEVELOPMENT_GYMS } from './seed.js';
import { hashPassword, verifyPassword } from './lib/crypto.js';
import { readServerConfig } from './config.js';

const fixtureCredentials = {
    admin: { username: randomUUID(), password: randomUUID() },
    user: { username: randomUUID(), password: randomUUID() },
};
const fixtureOptions = { seedDevData: true, fixtureCredentials };

describe('fresh schema and development fixtures', () => {
    it('rolls back fresh initialization without fixture credentials', async () => {
        const db = openDatabase(':memory:');
        try {
            await expect(db.initDatabase({ seedDevData: true })).rejects.toThrow('fixture_credentials_required');
            expect(await db.allSql("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([]);
        } finally { await db.close(); }
    });
    it('authenticates the exact fixture accounts and returns one shared catalog', async () => {
        const db = openDatabase(':memory:');
        let server;
        try {
            await db.initDatabase(fixtureOptions);
            const { app } = createApp({ database: db });
            await new Promise((resolve, reject) => { server = app.listen(0, resolve); server.once('error', reject); });
            const base = `http://127.0.0.1:${server.address().port}`;
            const catalogs = [];
            for (const [role, name, isAdmin] of [['admin', 'Administrator', true], ['user', 'User', false]]) {
                const { username, password } = fixtureCredentials[role];
                const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                expect(response.status).toBe(200);
                const authenticated = await response.json();
                expect(authenticated.user).toMatchObject({ username, name, isAdmin });
                const snapshot = await fetch(`${base}/api/sync/snapshot`, { headers: { Cookie: response.headers.get('set-cookie').split(';')[0] } });
                const data = await snapshot.json();
                expect(data.profile.name).toBe(name);
                expect(data.workouts).toEqual([]); expect(data.measurements).toEqual([]);
                catalogs.push(data.gyms.map(({ id, name, location }) => ({ id, name, location })));
            }
            expect(catalogs[0]).toEqual(DEVELOPMENT_GYMS);
            expect(catalogs[1]).toEqual(catalogs[0]);
            expect(await db.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 2 });
            const tables = (await db.allSql("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name);
            for (const name of ['exercises', 'gymEquipments', 'workoutSets']) expect(tables).not.toContain(name);
            expect(await db.getSql("SELECT value FROM app_settings WHERE key = 'dev.seed.completed'")).toEqual({ value: 'v1' });
        } finally {
            if (server) await new Promise(resolve => server.close(resolve));
            await db.close();
        }
    });
    it('preserves edits, deletions, and installation identity across reopening', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gymapp-seed-'));
        let db = openDatabase(path.join(dir, 'gymapp.db'));
        try {
            await db.initDatabase(fixtureOptions);
            const before = await db.getSql('SELECT id FROM installation');
            const changedPassword = randomUUID();
            await db.runSql('UPDATE users SET passwordHash = ?, isAdmin = 0 WHERE username = ?', [hashPassword(changedPassword), fixtureCredentials.admin.username]);
            await db.runSql('DELETE FROM users WHERE username = ?', [fixtureCredentials.user.username]);
            await db.runSql('UPDATE gyms SET name = ? WHERE id = ?', ['Renamed', DEVELOPMENT_GYMS[0].id]);
            await db.close(); db = openDatabase(path.join(dir, 'gymapp.db'));
            await db.initDatabase(fixtureOptions);
            await createApp({ database: db, config: readServerConfig({ ADMIN_USERNAME: fixtureCredentials.admin.username }) }).bootstrapAdmin();
            expect(await db.getSql('SELECT id FROM installation')).toEqual(before);
            const users = await db.allSql('SELECT * FROM users');
            expect(users).toHaveLength(1); expect(users[0].isAdmin).toBe(0);
            expect(verifyPassword(changedPassword, users[0].passwordHash)).toBe(true);
            expect(await db.getSql('SELECT name FROM gyms WHERE id = ?', [DEVELOPMENT_GYMS[0].id])).toEqual({ name: 'Renamed' });
            expect(await db.getSql('SELECT COUNT(*) AS count FROM gyms')).toEqual({ count: 2 });
        } finally { await db.close(); await fs.rm(dir, { recursive: true }); }
    });
    it('refuses fixture injection into an initialized empty installation', async () => {
        const db = openDatabase(':memory:');
        try {
            await db.initDatabase({ seedDevData: false });
            await expect(db.initDatabase({ seedDevData: true })).rejects.toThrow('fixtures_require_explicit_reset');
            expect(await db.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 0 });
        } finally { await db.close(); }
    });
    it('enforces foreign keys, non-reused account IDs, and revision/generation accounting', async () => {
        const db = openDatabase(':memory:');
        try {
            await db.initDatabase(fixtureOptions);
            expect(await db.getSql('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
            const workoutId = randomUUID();
            await db.runSql('INSERT INTO workouts (id, userId, gymId, startTime) VALUES (?, 2, ?, 1)', [workoutId, DEVELOPMENT_GYMS[0].id]);
            await expect(db.runSql('DELETE FROM gyms WHERE id = ?', [DEVELOPMENT_GYMS[0].id])).rejects.toThrow();
            await expect(db.runSql('INSERT INTO workouts (id, userId, gymId, startTime) VALUES (?, 2, ?, 2)', [randomUUID(), DEVELOPMENT_GYMS[0].id])).rejects.toThrow();
            await db.runSql('UPDATE workouts SET endTime = 2 WHERE id = ?', [workoutId]);
            expect(await db.getSql('SELECT revision FROM workouts WHERE id = ?', [workoutId])).toEqual({ revision: 2 });
            expect(await db.getSql('SELECT dataGeneration FROM users WHERE id = 2')).toEqual({ dataGeneration: 2 });
            await db.runSql('DELETE FROM users WHERE id = 2');
            expect(await db.allSql('SELECT * FROM workouts')).toEqual([]);
            const next = await db.runSql("INSERT INTO users (name) VALUES ('Next')");
            expect(next.lastID).toBeGreaterThan(2);
            await expect(db.runSql('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, 999, 10)', ['invalid'])).rejects.toThrow();
        } finally { await db.close(); }
    });
    it('resets only configured database files, reseeds explicitly, and refuses a running-server lease', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gymapp-reset-'));
        const filename = databasePath({ DATA_DIR: dir });
        try {
            await fs.writeFile(path.join(dir, 'history.csv'), 'preserve');
            await fs.writeFile(path.join(dir, 'gymapp.db.backup'), 'unrelated');
            const first = await resetDatabase(filename, fixtureOptions);
            const release = await acquireDatabaseLease(filename);
            try { await expect(resetDatabase(filename)).rejects.toThrow('database_in_use'); } finally { await release(); }
            await fs.writeFile(`${filename}-wal`, 'stale-wal');
            await fs.writeFile(`${filename}-shm`, 'stale-shm');
            const second = await resetDatabase(filename, fixtureOptions);
            expect(second).not.toBe(first);
            let db = openDatabase(filename);
            expect(await db.allSql('SELECT username, name, isAdmin FROM users ORDER BY id')).toEqual([
                { username: fixtureCredentials.admin.username, name: 'Administrator', isAdmin: 1 },
                { username: fixtureCredentials.user.username, name: 'User', isAdmin: 0 },
            ]);
            expect(await db.allSql('SELECT id, name, location FROM gyms ORDER BY id')).toEqual(
                [...DEVELOPMENT_GYMS].sort((left, right) => left.id.localeCompare(right.id)));
            for (const table of ['workouts', 'userMeasurements', 'mutation_receipts']) {
                expect(await db.getSql(`SELECT COUNT(*) AS count FROM ${table}`)).toEqual({ count: 0 });
            }
            const tables = (await db.allSql("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name);
            for (const name of ['exercises', 'gymEquipments', 'workoutSets']) expect(tables).not.toContain(name);
            await db.close();
            for (const [suffix, stale] of [['-wal', 'stale-wal'], ['-shm', 'stale-shm']]) {
                const contents = await fs.readFile(`${filename}${suffix}`, 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
                expect(contents).not.toBe(stale);
            }
            await resetDatabase(filename, { seedDevData: false });
            db = openDatabase(filename);
            expect(await db.getSql('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 0 });
            await db.close();
            expect(await fs.readFile(path.join(dir, 'history.csv'), 'utf8')).toBe('preserve');
            expect(await fs.readFile(path.join(dir, 'gymapp.db.backup'), 'utf8')).toBe('unrelated');
            expect(await fs.readdir(dir)).not.toContain('gymapp.db.lock');
        } finally { await fs.rm(dir, { recursive: true }); }
    });
});
