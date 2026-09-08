export const AUTHORIZATION_FAILURE = 'gymapp-authorization-failure';

// Notify the session coordinator without awaiting it: the failed outbox request
// must finish before the coordinator can quiesce its sender.
export async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);
    if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event(AUTHORIZATION_FAILURE));
    }
    return response;
}
