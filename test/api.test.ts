import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, isObject, requestJson } from '@/lib/api';
import { changeSession, notifyLocalLogout, readSession, sessionEpoch, subscribeSession } from '@/auth/tabs';
import { getBootstrap, isBootstrap, logoutSession } from '@/auth/session';
import { finishPendingLogout, loginWithUsername } from '@/auth/session';
import { localSession, rememberAccount, unlockLocalSession } from '@/auth/localSession';
import { v7 as uuidv7 } from 'uuid';

afterEach(() => vi.unstubAllGlobals());
const valid = (value: unknown): value is { ok: true } => isObject(value) && value.ok === true;
describe('typed API and bootstrap failures', () => {
    it('ignores a delayed logout notification after a newer session change', async () => {
        const storage = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
        });
        vi.stubGlobal('navigator', {});
        const channels: Channel[] = [];
        const messages: unknown[] = [];
        class Channel {
            onmessage: ((event: { data: unknown }) => void) | null = null;
            constructor() { channels.push(this); }
            postMessage(message: unknown) { messages.push(message); }
            close() {}
        }
        vi.stubGlobal('BroadcastChannel', Channel);
        const listener = vi.fn();
        const unsubscribe = subscribeSession(listener);
        notifyLocalLogout();
        const message = messages[0];
        channels[0].onmessage?.({ data: message });
        expect(listener).toHaveBeenCalledWith('locked');
        listener.mockClear();
        await changeSession(async () => {});
        channels[0].onmessage?.({ data: message });
        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });
    it('revokes offline eligibility on confirmed sign-out even if the next request fails', async () => {
        const storage = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
        });
        unlockLocalSession();
        rememberAccount({ accountId: uuidv7(), installationId: uuidv7(), defaultTimeFormat: 'system' });
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, status: 'signedOut', installationId: uuidv7(), defaultTimeFormat: 'system' })))
            .mockRejectedValueOnce(new TypeError('offline')));
        expect((await getBootstrap()).status).toBe('signedOut');
        await expect(getBootstrap()).rejects.toMatchObject({ kind: 'network' });
        expect(localSession().account).toBeNull();
    });
    it('supports session operations without Web Locks or BroadcastChannel', async () => {
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('localStorage', undefined);
        vi.stubGlobal('BroadcastChannel', undefined);
        const listener = vi.fn();
        const unsubscribe = subscribeSession(listener);
        expect(await readSession(async () => 'ready')).toBe('ready');
        expect(await changeSession(async () => 'changed')).toBe('changed');
        unsubscribe();
        expect(listener).not.toHaveBeenCalled();
    });
    it('validates UUID v7 accounts in authenticated bootstrap responses', () => {
        const id = uuidv7();
        const installationId = uuidv7();
        const profile = { id, revision: 1, name: 'Test', email: null, weight: null, height: null, bodyFat: null,
            age: null, gender: null, reminderFrequency: 'never', language: 'en', timeFormat: 'system', theme: 'dark', mainColor: null };
        const user = { id, username: 'test', name: 'Test', language: 'en', theme: 'dark', isAdmin: false };
        const snapshot = { accountId: id, installationId, accountGeneration: 0, catalogGeneration: 0, profile, gyms: [], workouts: [], workoutExercises: [], customExercises: [], measurements: [] };
        const response = { status: 'authenticated', installationId, user, snapshot, defaultTimeFormat: 'system',
            capabilities: { manageUsers: false, manageOidc: false, manageGyms: false } };
        expect(isBootstrap(response)).toBe(true);
        for (const defaultTimeFormat of ['system', '24h', '12h']) {
            expect(isBootstrap({ ...response, defaultTimeFormat })).toBe(true);
        }
        for (const defaultTimeFormat of [undefined, null, 24, 'invalid', ['24h']]) {
            expect(isBootstrap({ ...response, defaultTimeFormat })).toBe(false);
        }
        for (const invalid of [1, crypto.randomUUID(), 'invalid']) {
            expect(isBootstrap({ ...response, user: { ...user, id: invalid } })).toBe(false);
            expect(isBootstrap({ ...response, snapshot: { ...snapshot, accountId: invalid, profile: { ...profile, id: invalid } } })).toBe(false);
        }
        expect(isBootstrap({ ...response, user: { ...user, id: uuidv7() } })).toBe(false);
    });
    it.each([
        [401, 'unauthenticated'], [403, 'forbidden'], [400, 'validation'], [409, 'conflict'],
        [429, 'rateLimited'], [500, 'server'], [404, 'http'],
    ])('classifies HTTP %s even when its body is not JSON', async (status, kind) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('proxy error', { status: Number(status) })));
        await expect(requestJson('/api/test', valid)).rejects.toMatchObject({ kind, status });
    });
    it('keeps network failure distinct from an unauthenticated session', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        await expect(getBootstrap()).rejects.toMatchObject({ kind: 'network' });
    });
    it('parses Retry-After seconds for rate-limited requests', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":false,"error":"too_many_requests"}', {
            status: 429, headers: { 'Retry-After': '12' },
        })));
        await expect(requestJson('/api/test', valid)).rejects.toMatchObject({ kind: 'rateLimited', retryAfterMs: 12_000 });
    });
    it.each(['not json', '{}', '{"ok":true}', '{"ok":true,"status":"signedOut","installationId":"invalid"}'])(
        'rejects malformed bootstrap %s', async body => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
            await expect(getBootstrap()).rejects.toMatchObject({ kind: 'malformed' });
        },
    );
    it('invalidates snapshots observed before and during a failed cookie change', async () => {
        const storage = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
        });
        vi.stubGlobal('BroadcastChannel', undefined);
        let queuedEpoch: string | null = null;
        let changingEpoch: string | null = null;
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, callback: () => Promise<void>) => {
            queuedEpoch = sessionEpoch();
            return callback();
        } } });
        await expect(changeSession(async () => {
            changingEpoch = sessionEpoch();
            throw new Error('ambiguous failure');
        })).rejects.toThrow('ambiguous failure');
        expect(queuedEpoch).not.toBeNull();
        expect(changingEpoch).not.toBe(queuedEpoch);
        expect(sessionEpoch()).not.toBe(changingEpoch);
    });
    it('does not claim logout succeeded when the server rejects it', async () => {
        vi.stubGlobal('navigator', {});
        const storage = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
        });
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":false,"error":"logout_failed"}', { status: 500 })));
        await expect(logoutSession()).rejects.toBeInstanceOf(ApiError);
        expect(localSession()).toMatchObject({ locked: true, pendingLogout: true, account: null });
        rememberAccount({ accountId: uuidv7(), installationId: uuidv7(), defaultTimeFormat: 'system' });
        expect(localSession().account).toBeNull();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}')));
        await finishPendingLogout();
        expect(localSession()).toMatchObject({ locked: true, pendingLogout: false });
        const user = { id: uuidv7(), username: 'test', name: 'Test', language: 'en', theme: 'dark', isAdmin: false };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, user }))));
        expect((await loginWithUsername('test', 'password')).ok).toBe(true);
        expect(localSession()).toMatchObject({ locked: false, pendingLogout: false });
    });
    it('locks and invalidates the server session even when storage writes fail', async () => {
        const storage = new Map<string, string>();
        const setItem = vi.fn((key: string, value: string) => { storage.set(key, value); });
        vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem,
            removeItem: (key: string) => storage.delete(key) });
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('BroadcastChannel', undefined);
        unlockLocalSession();
        rememberAccount({ accountId: uuidv7(), installationId: uuidv7(), defaultTimeFormat: 'system' });
        setItem.mockImplementation(() => { throw new DOMException('quota exceeded', 'QuotaExceededError'); });
        const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
        vi.stubGlobal('fetch', fetch);
        await logoutSession();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(localSession()).toEqual({ locked: true, pendingLogout: false, account: null });
        setItem.mockImplementation((key: string, value: string) => { storage.set(key, value); });
        unlockLocalSession();
    });
});
