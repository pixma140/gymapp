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

export function localSession(): LocalSession {
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
    try { localStorage.setItem(KEY, JSON.stringify({ ...empty, account })); } catch { /* Online-only if storage is unavailable. */ }
}
export function forgetAccount(): void {
    const state = localSession();
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, account: null })); } catch { /* No offline access without storage. */ }
}
export function lockLocalSession(): void {
    fallback = { locked: true, pendingLogout: true, account: null };
    localStorage.setItem(KEY, JSON.stringify({ locked: true, pendingLogout: true, account: null }));
}
export function completeLocalLogout(): void {
    fallback = { locked: true, pendingLogout: false, account: null };
    localStorage.setItem(KEY, JSON.stringify({ locked: true, pendingLogout: false, account: null }));
}
export function unlockLocalSession(): void {
    fallback = empty;
    localStorage.setItem(KEY, JSON.stringify(empty));
}
