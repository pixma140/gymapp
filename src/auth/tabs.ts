const SESSION_LOCK = 'gymapp-session';
const CHANNEL = 'gymapp-session';
const EPOCH_KEY = 'gymapp-session-epoch';
export function sessionEpoch(): string | null {
    try { return localStorage.getItem(EPOCH_KEY); } catch { return null; }
}
function advanceEpoch(): void {
    try { localStorage.setItem(EPOCH_KEY, crypto.randomUUID()); } catch { /* BroadcastChannel remains available. */ }
}
type SessionMessage = 'changing' | 'changed';

export function notifySession(message: SessionMessage): void {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(message);
    channel.close();
}

export function subscribeSession(listener: (message: SessionMessage) => void): () => void {
    if (typeof BroadcastChannel === 'undefined') return () => {};
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = event => {
        if (event.data === 'changing' || event.data === 'changed') listener(event.data);
    };
    return () => channel.close();
}

// Senders share the session lock; bootstrap and cookie changes take it
// exclusively, so a login/logout cannot overtake an active sender in another tab.
export async function readSession<T>(operation: () => Promise<T>, exclusive = false): Promise<T> {
    return navigator.locks ? navigator.locks.request(SESSION_LOCK, { mode: exclusive ? 'exclusive' : 'shared' }, operation) : operation();
}

export async function changeSession<T>(operation: () => Promise<T>): Promise<T> {
    advanceEpoch();
    notifySession('changing');
    const change = async () => {
        // Rotate again under the lock: a bootstrap queued before this change
        // may have observed the old cookie after the initial notification.
        advanceEpoch();
        try { return await operation(); } finally { advanceEpoch(); }
    };
    try {
        return await (navigator.locks ? navigator.locks.request(SESSION_LOCK, change) : change());
    } finally {
        // Failed login/logout also releases tabs to re-check the actual cookie.
        notifySession('changed');
    }
}
