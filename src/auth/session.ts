export interface SessionUser {
    id: number;
    username: string;
    name?: string;
    language?: 'en' | 'de';
    theme?: 'light' | 'dark' | 'oled' | 'system';
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

export async function logoutSession(): Promise<void> {
    await sendAuthRequest('/api/auth/logout', {});
}
