import { actionRequest, isObject, jsonBody, type ActionResponse } from '@/lib/api';
export interface OidcAdminConfig {
    enabled: boolean;
    issuer: string;
    clientId: string;
    scopes: string;
    hasClientSecret: boolean;
}

export interface OidcAdminResponse extends ActionResponse {
    ok: boolean;
    config?: OidcAdminConfig;
    redirectUri?: string;
    error?: string;
}

export interface OidcConfigInput {
    enabled: boolean;
    issuer: string;
    clientId: string;
    clientSecret?: string;
    scopes: string;
}

export interface AdminUser {
    id: number;
    username: string | null;
    name: string;
    email: string | null;
    isAdmin: boolean;
    authType: 'oidc' | 'password';
    oidcIssuer: string | null;
    createdAt: number | null;
    lastLoginAt: number | null;
    isSelf: boolean;
}

export interface AdminUsersResponse extends ActionResponse {
    ok: boolean;
    users?: AdminUser[];
    error?: string;
}

export type AdminActionResponse = ActionResponse;

export interface CreateUserInput {
    username: string;
    password: string;
    name: string;
    email?: string;
    isAdmin: boolean;
}

const isAction = (value: unknown): value is AdminActionResponse => isObject(value) && value.ok === true;
const isOidc = (value: unknown): value is OidcAdminResponse => isObject(value) && isObject(value.config)
    && typeof value.redirectUri === 'string' && typeof value.config.enabled === 'boolean'
    && typeof value.config.issuer === 'string' && typeof value.config.clientId === 'string'
    && typeof value.config.scopes === 'string' && typeof value.config.hasClientSecret === 'boolean';
const isUsers = (value: unknown): value is AdminUsersResponse => isObject(value) && Array.isArray(value.users)
    && value.users.every(user => isObject(user) && Number.isSafeInteger(user.id) && typeof user.name === 'string'
        && (user.username === null || typeof user.username === 'string') && typeof user.isAdmin === 'boolean'
        && typeof user.isSelf === 'boolean' && ['password', 'oidc'].includes(String(user.authType)));

export const getOidcAdminConfig = (): Promise<OidcAdminResponse> => actionRequest('/api/admin/oidc', isOidc);
export const getAdminUsers = (): Promise<AdminUsersResponse> => actionRequest('/api/admin/users', isUsers);
export const createAdminUser = (input: CreateUserInput): Promise<AdminActionResponse> =>
    actionRequest('/api/admin/users', isAction, jsonBody(input));
export const resetUserPassword = (userId: number, password: string): Promise<AdminActionResponse> =>
    actionRequest(`/api/admin/users/${userId}/password`, isAction, jsonBody({ password }));
export const setUserAdmin = (userId: number, isAdmin: boolean): Promise<AdminActionResponse> =>
    actionRequest(`/api/admin/users/${userId}`, isAction, jsonBody({ isAdmin }, 'PATCH'));
export const deleteAdminUser = (userId: number): Promise<AdminActionResponse> =>
    actionRequest(`/api/admin/users/${userId}`, isAction, { method: 'DELETE' });
export const saveOidcAdminConfig = (input: OidcConfigInput): Promise<OidcAdminResponse> =>
    actionRequest('/api/admin/oidc', isOidc, jsonBody(input, 'PUT'));
