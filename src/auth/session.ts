import { isUuid } from '@shared/commands';
import type { Snapshot } from '@shared/commands';
import { actionRequest, isObject, jsonBody, requestJson, type ActionResponse } from '@/lib/api';
import { isSnapshot } from '@/db/hydrate';
import { changeSession, notifySession } from './tabs';

export interface SessionUser {
    id: string;
    username: string | null;
    name: string;
    language: 'en' | 'de';
    theme: 'light' | 'dark' | 'oled' | 'system';
    isAdmin: boolean;
}
export interface Capabilities { manageUsers: boolean; manageOidc: boolean; manageGyms: boolean }
export type Bootstrap =
    | { status: 'setup' | 'signedOut'; installationId: string }
    | { status: 'authenticated'; installationId: string; user: SessionUser; capabilities: Capabilities; snapshot: Snapshot };

function isSessionUser(value: unknown): value is SessionUser {
    return isObject(value) && isUuid(value.id)
        && (value.username === null || typeof value.username === 'string') && typeof value.name === 'string'
        && ['en', 'de'].includes(String(value.language)) && ['light', 'dark', 'oled', 'system'].includes(String(value.theme))
        && typeof value.isAdmin === 'boolean';
}
export function isBootstrap(value: unknown): value is Bootstrap {
    if (!isObject(value) || !isUuid(value.installationId)) return false;
    if (value.status === 'setup' || value.status === 'signedOut') return true;
    if (value.status !== 'authenticated' || !isSessionUser(value.user) || !isObject(value.capabilities)
        || !isSnapshot(value.snapshot)) return false;
    const { capabilities, user } = value;
    return ['manageUsers', 'manageOidc', 'manageGyms'].every(key => capabilities[key] === user.isAdmin)
        && value.snapshot.accountId === value.user.id && value.snapshot.installationId === value.installationId;
}
export const getBootstrap = () => requestJson('/api/bootstrap', isBootstrap, undefined, false);

interface AuthResponse extends ActionResponse { user?: SessionUser }
const isAuthResponse = (value: unknown): value is AuthResponse => isObject(value) && value.ok === true && isSessionUser(value.user);
const authenticate = (path: string, body: unknown): Promise<AuthResponse> =>
    changeSession(() => actionRequest(path, isAuthResponse, jsonBody(body), false));

export const loginWithUsername = (username: string, password: string) => authenticate('/api/auth/login', { username, password });
export const registerWithUsername = (username: string, password: string) => authenticate('/api/auth/register', { username, password });
export interface SetupInput { username: string; password: string; name: string; email?: string; language?: 'en' | 'de' }
export const setupInitialAdmin = (input: SetupInput) => authenticate('/api/setup', input);
export async function logoutSession(): Promise<void> {
    await changeSession(() => requestJson('/api/auth/logout',
        (value): value is { ok: true } => isObject(value) && value.ok === true, jsonBody({}), false));
}
export async function getOidcStatus(): Promise<boolean> {
    try {
        const result = await requestJson('/api/auth/oidc/status',
            (value): value is { enabled: boolean } => isObject(value) && typeof value.enabled === 'boolean', undefined, false);
        return result.enabled;
    } catch { return false; }
}
export function startOidcLogin(): void {
    // Navigation leaves cookie handling to the OIDC callback. Server-side command
    // bindings still reject stale tabs if the browser changes its cookie externally.
    sessionStorage.setItem('gymapp-oidc-return', 'true');
    notifySession('changing');
    window.location.href = '/api/auth/oidc/login';
}
