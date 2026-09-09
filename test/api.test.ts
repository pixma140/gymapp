import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, isObject, requestJson } from '@/lib/api';
import { changeSession, sessionEpoch } from '@/auth/tabs';
import { getBootstrap, isBootstrap, logoutSession } from '@/auth/session';
import { v7 as uuidv7 } from 'uuid';

afterEach(() => vi.unstubAllGlobals());
const valid = (value: unknown): value is { ok: true } => isObject(value) && value.ok === true;
describe('typed API and bootstrap failures', () => {
    it('validates UUID v7 accounts in authenticated bootstrap responses', () => {
        const id = uuidv7();
        const installationId = uuidv7();
        const profile = { id, revision: 1, name: 'Test', email: null, weight: null, height: null, bodyFat: null,
            age: null, gender: null, reminderFrequency: 'never', language: 'en', theme: 'dark', mainColor: null };
        const user = { id, username: 'test', name: 'Test', language: 'en', theme: 'dark', isAdmin: false };
        const snapshot = { accountId: id, installationId, accountGeneration: 0, catalogGeneration: 0, profile, gyms: [], workouts: [], workoutExercises: [], customExercises: [], measurements: [] };
        const response = { status: 'authenticated', installationId, user, snapshot,
            capabilities: { manageUsers: false, manageOidc: false, manageGyms: false } };
        expect(isBootstrap(response)).toBe(true);
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
        vi.stubGlobal('localStorage', undefined);
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":false,"error":"logout_failed"}', { status: 500 })));
        await expect(logoutSession()).rejects.toBeInstanceOf(ApiError);
    });
});
