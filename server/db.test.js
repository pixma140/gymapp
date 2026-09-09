import { describe, it, expect } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

describe('database lifecycle and serialization', () => {
    it('isolates explicitly created application databases', async () => {
        const first = openDatabase(':memory:');
        const second = openDatabase(':memory:');
        try {
            await Promise.all([first.initDatabase({ seedDevData: false }), second.initDatabase({ seedDevData: false })]);
            expect(createApp({ database: first }).app).not.toBe(createApp({ database: second }).app);
            await first.runSql("INSERT INTO users (id, name) VALUES (?, 'First')", [uuidv7()]);
            expect(await second.allSql('SELECT * FROM users')).toEqual([]);
        } finally {
            await Promise.all([first.close(), second.close()]);
        }
    });

    it('keeps an unrelated write outside a transaction that rolls back across awaits', async () => {
        const database = openDatabase(':memory:');
        try {
            await database.runSql('CREATE TABLE items (id INTEGER PRIMARY KEY)');
            let release;
            let entered;
            const gate = new Promise(resolve => { release = resolve; });
            const started = new Promise(resolve => { entered = resolve; });
            const transaction = database.transaction(async tx => {
                await tx.runSql('INSERT INTO items VALUES (1)');
                entered();
                await gate;
                throw new Error('rollback');
            });
            const rejected = expect(transaction).rejects.toThrow('rollback');
            await started;
            const unrelated = database.runSql('INSERT INTO items VALUES (2)');
            release();
            await rejected;
            await unrelated;
            expect(await database.allSql('SELECT id FROM items')).toEqual([{ id: 2 }]);
        } finally {
            await database.close();
        }
    });

    it('serializes competing read-modify-write transactions and rejects expired handles', async () => {
        const database = openDatabase(':memory:');
        try {
            await database.runSql('CREATE TABLE counter (value INTEGER)');
            await database.runSql('INSERT INTO counter VALUES (0)');
            let expired;
            await Promise.all(Array.from({ length: 10 }, () => database.transaction(async tx => {
                expired = tx;
                const { value } = await tx.getSql('SELECT value FROM counter');
                await tx.runSql('UPDATE counter SET value = ?', [value + 1]);
            })));
            expect(await database.getSql('SELECT value FROM counter')).toEqual({ value: 10 });
            await expect(expired.runSql('DELETE FROM counter')).rejects.toThrow('transaction_closed');
        } finally {
            await database.close();
        }
        await expect(database.getSql('SELECT 1')).rejects.toThrow('database_closed');
    });
});
