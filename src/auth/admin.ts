import { isUuid } from '@shared/commands';
import { actionRequest, isObject, jsonBody, type ActionResponse } from '@/lib/api';
export interface OidcAdminConfig {
    enabled: boolean;
    issuer: string;
    scopes: string;
    hasCredentials: boolean;
    environmentManaged: Array<'enabled' | 'issuer' | 'scopes'>;
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
    scopes: string;
}

export interface ServerAdminConfig {
    port: number;
    dataDir: string;
    nodeEnv: string;
    seedDevData: boolean;
    cookieSecure: boolean;
    publicUrl: string;
    viteApiTarget: string;
    environmentManaged: string[];
}
export interface ServerAdminResponse extends ActionResponse { config?: ServerAdminConfig }

export interface AdminUser {
    id: string;
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
    && typeof value.config.issuer === 'string'
    && typeof value.config.scopes === 'string' && typeof value.config.hasCredentials === 'boolean'
    && Array.isArray(value.config.environmentManaged)
    && value.config.environmentManaged.every(key => ['enabled', 'issuer', 'scopes'].includes(String(key)));
const isServerConfig = (value: unknown): value is ServerAdminResponse => isObject(value) && isObject(value.config)
    && Number.isInteger(value.config.port) && typeof value.config.dataDir === 'string'
    && typeof value.config.nodeEnv === 'string' && typeof value.config.seedDevData === 'boolean'
    && typeof value.config.cookieSecure === 'boolean' && typeof value.config.publicUrl === 'string'
    && typeof value.config.viteApiTarget === 'string' && Array.isArray(value.config.environmentManaged)
    && value.config.environmentManaged.every(key => typeof key === 'string');
const isUsers = (value: unknown): value is AdminUsersResponse => isObject(value) && Array.isArray(value.users)
    && value.users.every(user => isObject(user) && isUuid(user.id) && typeof user.name === 'string'
        && (user.username === null || typeof user.username === 'string') && typeof user.isAdmin === 'boolean'
        && typeof user.isSelf === 'boolean' && ['password', 'oidc'].includes(String(user.authType)));

export const getOidcAdminConfig = (): Promise<OidcAdminResponse> => actionRequest('/api/admin/oidc', isOidc);
export const getServerAdminConfig = (): Promise<ServerAdminResponse> => actionRequest('/api/admin/config', isServerConfig);
export const getAdminUsers = (): Promise<AdminUsersResponse> => actionRequest('/api/admin/users', isUsers);
export const createAdminUser = (input: CreateUserInput): Promise<AdminActionResponse> =>
    actionRequest('/api/admin/users', isAction, jsonBody(input));
export const resetUserPassword = (userId: string, password: string): Promise<AdminActionResponse> =>
    actionRequest(`/api/admin/users/${userId}/password`, isAction, jsonBody({ password }));
export const setUserAdmin = (userId: string, isAdmin: boolean): Promise<AdminActionResponse> =>
    actionRequest(`/api/admin/users/${userId}`, isAction, jsonBody({ isAdmin }, 'PATCH'));
export const deleteAdminUser = (userId: string): Promise<AdminActionResponse> =>
    actionRequest(`/api/admin/users/${userId}`, isAction, { method: 'DELETE' });
export const saveOidcAdminConfig = (input: OidcConfigInput): Promise<OidcAdminResponse> =>
    actionRequest('/api/admin/oidc', isOidc, jsonBody(input, 'PUT'));
