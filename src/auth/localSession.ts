import { isUuid } from '@shared/commands';
import type { AccountBinding, ProfileFields } from '@shared/commands';
import { isObject } from '@/lib/api';

const KEY = 'gymapp-local-session';
export interface OfflineAccount extends AccountBinding {
    defaultTimeFormat: ProfileFields['timeFormat'];
}
interface LocalSession { locked: boolean; pendingLogout: boolean; account: OfflineAccount | null }
const empty: LocalSession = { locked: false, pendingLogout: false, account: null };
let fallback = empty;
let storageFailed = false;
function write(state: LocalSession): void {
    fallback = state;
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
        storageFailed = false;
    } catch {
        // Keep this document locked even if the browser refuses persistence.
        storageFailed = true;
        try { localStorage.removeItem(KEY); } catch { /* Server logout is still attempted. */ }
    }
}

export function localSession(): LocalSession {
    if (storageFailed) return fallback;
    try {
        let raw: string | null;
        try { raw = localStorage.getItem(KEY); } catch { return fallback; }
        if (!raw) return empty;
        const value: unknown = JSON.parse(raw);
        if (!isObject(value) || typeof value.locked !== 'boolean' || typeof value.pendingLogout !== 'boolean') throw new Error();
        const account = value.account;
        if (account !== null && (!isObject(account) || !isUuid(account.accountId) || !isUuid(account.installationId)
            || !['system', '24h', '12h'].includes(String(account.defaultTimeFormat)))) throw new Error();
        return value as unknown as LocalSession;
    } catch {
        return { locked: true, pendingLogout: false, account: null };
    }
}
export function rememberAccount(account: OfflineAccount): void {
    if (localSession().locked) return;
    write({ ...empty, account });
}
export function forgetAccount(): void {
    const state = localSession();
    write({ ...state, account: null });
}
export function lockLocalSession(): void {
    write({ locked: true, pendingLogout: true, account: null });
}
export function completeLocalLogout(): void {
    write({ locked: true, pendingLogout: false, account: null });
}
export function unlockLocalSession(): void {
    write(empty);
}
