import sqlite3 from 'sqlite3';
import { initializeSchema } from './schema.js';

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

    async function initDatabase(options) {
        await runSql('PRAGMA foreign_keys = ON');
        await runSql('PRAGMA busy_timeout = 5000');
        await runSql('PRAGMA journal_mode = WAL');
        await runSql('BEGIN IMMEDIATE');
        try {
            await initializeSchema({ runSql, getSql, allSql }, options);
            await runSql('COMMIT');
        } catch (error) {
            await runSql('ROLLBACK');
            throw error;
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
        initDatabase: options => enqueue(() => initDatabase(options)),
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
