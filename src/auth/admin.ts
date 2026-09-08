export interface OidcAdminConfig {
    enabled: boolean;
    issuer: string;
    clientId: string;
    scopes: string;
    hasClientSecret: boolean;
}

export interface OidcAdminResponse {
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

export async function getOidcAdminConfig(): Promise<OidcAdminResponse> {
    const response = await fetch('/api/admin/oidc', { credentials: 'include' });
    const payload = (await response.json()) as OidcAdminResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'load_failed' };
    }

    return payload;
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

export interface AdminUsersResponse {
    ok: boolean;
    users?: AdminUser[];
    error?: string;
}

export interface AdminActionResponse {
    ok: boolean;
    error?: string;
}

export interface CreateUserInput {
    username: string;
    password: string;
    name: string;
    email?: string;
    isAdmin: boolean;
}

export async function getAdminUsers(): Promise<AdminUsersResponse> {
    const response = await fetch('/api/admin/users', { credentials: 'include' });
    const payload = (await response.json()) as AdminUsersResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'load_failed' };
    }

    return payload;
}

export async function createAdminUser(input: CreateUserInput): Promise<AdminActionResponse> {
    const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
    });

    const payload = (await response.json()) as AdminActionResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'create_failed' };
    }

    return payload;
}

export async function resetUserPassword(userId: number, password: string): Promise<AdminActionResponse> {
    const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
    });

    const payload = (await response.json()) as AdminActionResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'reset_failed' };
    }

    return payload;
}

export async function setUserAdmin(userId: number, isAdmin: boolean): Promise<AdminActionResponse> {
    const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAdmin })
    });

    const payload = (await response.json()) as AdminActionResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'update_failed' };
    }

    return payload;
}

export async function deleteAdminUser(userId: number): Promise<AdminActionResponse> {
    const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    const payload = (await response.json()) as AdminActionResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'delete_failed' };
    }

    return payload;
}

export async function saveOidcAdminConfig(input: OidcConfigInput): Promise<OidcAdminResponse> {
    const response = await fetch('/api/admin/oidc', {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
    });

    const payload = (await response.json()) as OidcAdminResponse;

    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'save_failed' };
    }

    return payload;
}
