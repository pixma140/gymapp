import { isUuid } from '@shared/commands';
import type { ProfileFields, Snapshot } from '@shared/commands';
import { actionRequest, isObject, jsonBody, requestJson, type ActionResponse } from '@/lib/api';
import { isSnapshot } from '@/db/hydrate';
import { changeSession, notifyLocalLogout, notifySession } from './tabs';
import { completeLocalLogout, forgetAccount, localSession, lockLocalSession, unlockLocalSession } from './localSession';

export interface SessionUser {
    id: string;
    username: string | null;
    name: string;
    language: 'en' | 'de';
    theme: 'light' | 'dark' | 'oled' | 'system';
    isAdmin: boolean;
}
export interface Capabilities { manageUsers: boolean; manageOidc: boolean; manageGyms: boolean }
export type Bootstrap = { defaultTimeFormat: ProfileFields['timeFormat'] } & (
    | { status: 'setup' | 'signedOut'; installationId: string }
    | { status: 'authenticated'; installationId: string; user: SessionUser; capabilities: Capabilities; snapshot: Snapshot });

function isSessionUser(value: unknown): value is SessionUser {
    return isObject(value) && isUuid(value.id)
        && (value.username === null || typeof value.username === 'string') && typeof value.name === 'string'
        && ['en', 'de'].includes(String(value.language)) && ['light', 'dark', 'oled', 'system'].includes(String(value.theme))
        && typeof value.isAdmin === 'boolean';
}
export function isBootstrap(value: unknown): value is Bootstrap {
    if (!isObject(value) || !isUuid(value.installationId)) return false;
    if (typeof value.defaultTimeFormat !== 'string' || !['system', '24h', '12h'].includes(value.defaultTimeFormat)) return false;
    if (value.status === 'setup' || value.status === 'signedOut') return true;
    if (value.status !== 'authenticated' || !isSessionUser(value.user) || !isObject(value.capabilities)
        || !isSnapshot(value.snapshot)) return false;
    const { capabilities, user } = value;
    return ['manageUsers', 'manageOidc', 'manageGyms'].every(key => capabilities[key] === user.isAdmin)
        && value.snapshot.accountId === value.user.id && value.snapshot.installationId === value.installationId;
}
export async function getBootstrap(): Promise<Bootstrap> {
    const bootstrap = await requestJson('/api/bootstrap', isBootstrap, undefined, false);
    const saved = localSession().account;
    // A confirmed identity change revokes offline eligibility immediately, even
    // if subsequent preparation or another request fails.
    if (saved && (bootstrap.status !== 'authenticated' || bootstrap.user.id !== saved.accountId
        || bootstrap.installationId !== saved.installationId)) forgetAccount();
    return bootstrap;
}

interface AuthResponse extends ActionResponse { user?: SessionUser }
const isAuthResponse = (value: unknown): value is AuthResponse => isObject(value) && value.ok === true && isSessionUser(value.user);
const authenticate = (path: string, body: unknown): Promise<AuthResponse> =>
    changeSession(async () => {
        await finishPendingLogout();
        forgetAccount();
        const response = await actionRequest(path, isAuthResponse, jsonBody(body), false);
        if (response.ok) unlockLocalSession();
        return response;
    });

export const loginWithUsername = (username: string, password: string) => authenticate('/api/auth/login', { username, password });
export const registerWithUsername = (username: string, password: string) => authenticate('/api/auth/register', { username, password });
export interface SetupInput { username: string; password: string; name: string; email?: string; language?: 'en' | 'de' }
export const setupInitialAdmin = (input: SetupInput) => authenticate('/api/setup', input);
export async function logoutSession(): Promise<void> {
    lockLocalSession();
    notifyLocalLogout();
    await changeSession(finishPendingLogout);
}
// Call under the exclusive session lock, before any new cookie is established.
export async function finishPendingLogout(): Promise<void> {
    if (!localSession().pendingLogout) return;
    await requestJson('/api/auth/logout',
        (value): value is { ok: true } => isObject(value) && value.ok === true, jsonBody({}), false);
    completeLocalLogout();
}
export async function getOidcStatus(): Promise<boolean> {
    try {
        const result = await requestJson('/api/auth/oidc/status',
            (value): value is { enabled: boolean } => isObject(value) && typeof value.enabled === 'boolean', undefined, false);
        return result.enabled;
    } catch { return false; }
}
export async function startOidcLogin(): Promise<void> {
    // Navigation leaves cookie handling to the OIDC callback. Server-side command
    // bindings still reject stale tabs if the browser changes its cookie externally.
    await changeSession(async () => {
        await finishPendingLogout();
        unlockLocalSession();
        sessionStorage.setItem('gymapp-oidc-return', 'true');
        notifySession('changing');
        window.location.href = '/api/auth/oidc/login';
    });
}
