import 'fake-indexeddb/auto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
import { resetDatabase } from '../server/reset.js';
import { AccountDatabase } from '@/db/db';
import { hydrateFromServer } from '@/db/hydrate';
import { applyOperation } from '@/db/operations';
import { flushPendingMutations } from '@/db/sqliteSync';
import type { Snapshot } from '@shared/commands';

const fixtureCredentials = {
    admin: { username: crypto.randomUUID(), password: crypto.randomUUID() },
    user: { username: crypto.randomUUID(), password: crypto.randomUUID() },
};

interface RunningServer {
    baseUrl: string;
    close: () => Promise<void>;
}

async function startServer(filename: string): Promise<RunningServer> {
    const database = openDatabase(filename);
    const { app } = createApp({ database });
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
        const listening = app.listen(0, () => resolve(listening));
        listening.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('invalid_test_server');
    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: async () => {
            await new Promise<void>(resolve => server.close(() => resolve()));
            await database.close();
        },
    };
}

async function login(baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixtureCredentials.user),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('missing_test_cookie');
    return cookie;
}

async function bootstrap(baseUrl: string, cookie: string) {
    const response = await fetch(`${baseUrl}/api/bootstrap`, { headers: { Cookie: cookie } });
    return response.json() as Promise<{ installationId: string; user: { id: number }; snapshot: Snapshot }>;
}

describe('server reset replay isolation', () => {
    const localDatabases: AccountDatabase[] = [];
    afterEach(async () => {
        vi.unstubAllGlobals();
        for (const database of localDatabases.splice(0)) await database.delete();
    });

    it('retains an installation-X command and cannot replay it into installation Y', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gymapp-reset-replay-'));
        const filename = path.join(dir, 'gymapp.db');
        let running: RunningServer | null = null;
        try {
            const installationX = await resetDatabase(filename, { seedDevData: true, fixtureCredentials });
            running = await startServer(filename);
            const cookieX = await login(running.baseUrl);
            const bootstrapX = await bootstrap(running.baseUrl, cookieX);
            const cacheX = new AccountDatabase({ accountId: bootstrapX.user.id, installationId: installationX });
            localDatabases.push(cacheX);
            await hydrateFromServer(cacheX, bootstrapX.snapshot);
            await applyOperation(cacheX, 'profile.update', null, { name: 'Stale X edit' });
            const staleCommand = (await cacheX.outbox.toArray())[0].command;

            await running.close();
            running = null;
            const installationY = await resetDatabase(filename, { seedDevData: true, fixtureCredentials });
            expect(installationY).not.toBe(installationX);
            running = await startServer(filename);
            const cookieY = await login(running.baseUrl);
            const bootstrapY = await bootstrap(running.baseUrl, cookieY);
            expect(bootstrapY.installationId).toBe(installationY);

            const nativeFetch = globalThis.fetch;
            vi.stubGlobal('navigator', { locks: { request: async (_name: string, ...args: unknown[]) =>
                (args.at(-1) as () => Promise<void>)() } });
            vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
                nativeFetch(new URL(String(input), running!.baseUrl), {
                    ...init, headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), Cookie: cookieY },
                }));
            await flushPendingMutations(cacheX);

            expect((await cacheX.outbox.toArray())[0]).toMatchObject({ state: 'paused', error: 'account_binding_mismatch', command: staleCommand });
            const serverSnapshot = await nativeFetch(`${running.baseUrl}/api/sync/snapshot`, { headers: { Cookie: cookieY } }).then(response => response.json());
            expect(serverSnapshot.profile.name).toBe('User');
            expect(serverSnapshot.workouts).toEqual([]);

            const cacheY = new AccountDatabase({ accountId: bootstrapY.user.id, installationId: installationY });
            localDatabases.push(cacheY);
            expect(cacheY.name).not.toBe(cacheX.name);
            expect(await cacheY.users.count()).toBe(0);
            await hydrateFromServer(cacheY, bootstrapY.snapshot);
            expect((await cacheY.users.get(bootstrapY.user.id))?.name).toBe('User');
            expect(await cacheY.outbox.count()).toBe(0);
            expect((await cacheX.users.get(bootstrapX.user.id))?.name).toBe('Stale X edit');
        } finally {
            if (running) await running.close();
            await fs.rm(dir, { recursive: true, force: true });
        }
    });
});
