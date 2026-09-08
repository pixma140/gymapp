export interface SessionUser {
    id: number;
    username: string;
    name?: string;
    language?: 'en' | 'de';
    theme?: 'light' | 'dark' | 'oled' | 'system';
    isAdmin?: boolean;
}

interface AuthResponse {
    ok: boolean;
    user?: SessionUser;
    error?: string;
}

async function sendAuthRequest(path: string, body?: Record<string, unknown>): Promise<AuthResponse> {
    const response = await fetch(path, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const payload = (await response.json()) as AuthResponse;

    if (response.status >= 500) throw new Error('server_unavailable');
    if (!response.ok || !payload.ok) {
        return { ok: false, error: payload.error ?? 'unknown_error' };
    }

    return payload;
}

export async function getSessionUser(): Promise<SessionUser | null> {
    const result = await sendAuthRequest('/api/auth/me');
    return result.ok && result.user ? result.user : null;
}

export async function loginWithUsername(username: string, password: string): Promise<AuthResponse> {
    return sendAuthRequest('/api/auth/login', { username, password });
}

export async function registerWithUsername(username: string, password: string): Promise<AuthResponse> {
    return sendAuthRequest('/api/auth/register', { username, password });
}

export interface SetupInput {
    username: string;
    password: string;
    name: string;
    email?: string;
    language?: 'en' | 'de';
}

export async function getSetupStatus(): Promise<boolean> {
    const response = await fetch('/api/setup/status', { credentials: 'include' });
    const payload = await response.json();
    if (!response.ok || !payload.ok || typeof payload.needsSetup !== 'boolean') throw new Error('setup_status_failed');
    return payload.needsSetup;
}

export async function setupInitialAdmin(input: SetupInput): Promise<AuthResponse> {
    return sendAuthRequest('/api/setup', { ...input });
}

export async function logoutSession(): Promise<void> {
    await sendAuthRequest('/api/auth/logout', {});
}

export async function getOidcStatus(): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/oidc/status', { credentials: 'include' });
        const payload = (await response.json()) as { ok: boolean; enabled?: boolean };
        return Boolean(payload.ok && payload.enabled);
    } catch {
        return false;
    }
}

export function startOidcLogin(): void {
    window.location.href = '/api/auth/oidc/login';
}
