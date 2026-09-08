export type ApiErrorKind = 'network' | 'unauthenticated' | 'forbidden' | 'validation' | 'conflict' | 'malformed' | 'server' | 'rateLimited' | 'http';
export class ApiError extends Error {
    readonly kind: ApiErrorKind;
    readonly status?: number;
    readonly retryAfterMs?: number;
    constructor(kind: ApiErrorKind, message: string, status?: number, retryAfterMs?: number) {
        super(message);
        this.kind = kind;
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}
export const AUTHORIZATION_FAILURE = 'gymapp-authorization-failure';
export const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit, notify = true): Promise<Response> {
    let response: Response;
    try { response = await fetch(input, { credentials: 'include', ...init }); }
    catch { throw new ApiError('network', 'network_failed'); }
    if (notify && (response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTHORIZATION_FAILURE));
    }
    return response;
}

export async function requestJson<T>(
    path: string, validate: (value: unknown) => value is T, init?: RequestInit, notify = true,
): Promise<T> {
    const response = await apiFetch(path, init, notify);
    let payload: unknown;
    try { payload = await response.json(); } catch {
        if (response.ok) throw new ApiError('malformed', 'invalid_response', response.status);
    }
    if (!response.ok) {
        const kind: ApiErrorKind = response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden'
            : response.status === 409 ? 'conflict' : response.status === 400 || response.status === 422 ? 'validation'
                : response.status === 429 ? 'rateLimited' : response.status >= 500 ? 'server' : 'http';
        const retryAfter = response.headers.get('Retry-After');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const retryAfterMs = retryAfter === null ? undefined : Number.isFinite(seconds) && seconds >= 0
            ? seconds * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
        throw new ApiError(kind, isObject(payload) && typeof payload.error === 'string' ? payload.error : `http_${response.status}`,
            response.status, Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
    }
    if (!isObject(payload) || payload.ok !== true || !validate(payload)) throw new ApiError('malformed', 'invalid_response', response.status);
    return payload;
}

export const jsonBody = (body: unknown, method = 'POST'): RequestInit =>
    ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export interface ActionResponse { ok: boolean; error?: string; kind?: ApiErrorKind }
export async function actionRequest<T extends ActionResponse>(
    path: string, validate: (value: unknown) => value is T, init?: RequestInit, notify = true,
): Promise<T | { ok: false; error: string; kind: ApiErrorKind }> {
    try { return await requestJson(path, validate, init, notify); }
    catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return { ok: false, error: error.message, kind: error.kind };
    }
}
