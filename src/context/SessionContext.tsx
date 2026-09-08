/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AUTHORIZATION_FAILURE } from '@/auth/authorization';
import { getSessionUser, getSetupStatus, logoutSession, type SessionUser } from '@/auth/session';
import { AccountDatabase, clearLegacyCacheOnce } from '@/db/db';
import { hydrateFromServer } from '@/db/hydrate';
import { flushPendingMutations } from '@/db/sqliteSync';
import type { Snapshot } from '@shared/commands';

type Status = 'loading' | 'setup' | 'signedOut' | 'preparing' | 'ready' | 'failed';
interface SessionContextValue {
    user: SessionUser | null;
    userId: number | null;
    isAdmin: boolean;
    isLoading: boolean;
    status: Status;
    database: AccountDatabase | null;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
    discardLocalChanges: () => Promise<void>;
}
const SessionContext = createContext<SessionContextValue | undefined>(undefined);
export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<{ status: Status; user: SessionUser | null; database: AccountDatabase | null }>({ status: 'loading', user: null, database: null });
    const generation = useRef(0);
    const current = useRef<AccountDatabase | null>(null);
    const sender = useRef<Promise<void>>(Promise.resolve());
    const stop = useCallback(async () => {
        const version = ++generation.current;
        await sender.current.catch(() => {});
        if (version === generation.current) {
            current.current?.close();
            current.current = null;
        }
        return version;
    }, []);
    const refresh = useCallback(async () => {
        setState({ status: 'loading', user: null, database: null });
        const version = await stop();
        if (version !== generation.current) return;
        let database: AccountDatabase | null = null;
        try {
            if (await getSetupStatus()) {
                if (version === generation.current) setState({ status: 'setup', user: null, database: null });
                return;
            }
            const user = await getSessionUser();
            if (version !== generation.current) return;
            if (!user) { setState({ status: 'signedOut', user: null, database: null }); return; }
            setState({ status: 'preparing', user, database: null });
            const response = await fetch('/api/sync/snapshot', { credentials: 'include' });
            if (!response.ok) throw new Error('snapshot_failed');
            const snapshot: Snapshot = await response.json();
            if (snapshot.accountId !== user.id) throw new Error('account_changed');
            await clearLegacyCacheOnce();
            database = new AccountDatabase({ accountId: user.id, installationId: snapshot.installationId });
            await database.open();
            const pending = await database.outbox.orderBy('sequence').first();
            if (!pending) await hydrateFromServer(database, snapshot);
            else {
                const metadata = await database.syncMetadata.get('state');
                if (!metadata || metadata.accountGeneration !== snapshot.accountGeneration || metadata.catalogGeneration !== snapshot.catalogGeneration) {
                    await database.outbox.update(pending.sequence, { state: 'conflict', error: 'generation_conflict' });
                } else if (pending.state === 'paused') {
                    await database.outbox.update(pending.sequence, { state: 'pending', error: undefined });
                }
            }
            if (version !== generation.current) { database.close(); return; }
            current.current = database;
            setState({ status: 'ready', user, database });
        } catch {
            database?.close();
            if (version === generation.current) setState({ status: 'failed', user: null, database: null });
        }
    }, [stop]);
    const logout = useCallback(async () => {
        setState({ status: 'loading', user: null, database: null });
        try {
            await stop();
            await logoutSession();
            setState({ status: 'signedOut', user: null, database: null });
            const channel = new BroadcastChannel('gymapp-session');
            channel.postMessage('changed'); channel.close();
        } catch {
            setState({ status: 'failed', user: null, database: null });
        }
    }, [stop]);
    const discardLocalChanges = useCallback(async () => {
        const binding = current.current?.binding;
        if (!binding) return;
        setState({ status: 'loading', user: null, database: null });
        await stop();
        const database = new AccountDatabase(binding);
        try {
            const discard = () => database.outbox.clear();
            if (navigator.locks) await navigator.locks.request(`sync:${database.name}`, discard);
            else await discard();
        } finally { database.close(); }
        await refresh();
    }, [refresh, stop]);
    useEffect(() => {
        void refresh();
        const channel = new BroadcastChannel('gymapp-session');
        const revalidate = () => void refresh();
        channel.onmessage = revalidate;
        window.addEventListener(AUTHORIZATION_FAILURE, revalidate);
        return () => {
            window.removeEventListener(AUTHORIZATION_FAILURE, revalidate);
            channel.close();
            void stop();
        };
    }, [refresh, stop]);
    useEffect(() => {
        if (state.status !== 'ready' || !state.database) return;
        const database = state.database;
        const version = generation.current;
        const active = () => generation.current === version && current.current === database;
        const send = () => {
            sender.current = sender.current.then(() => active() ? flushPendingMutations(database, active) : undefined).catch(() => {});
        };
        send();
        const timer = window.setInterval(send, 2000);
        window.addEventListener('online', send);
        return () => { clearInterval(timer); window.removeEventListener('online', send); };
    }, [state]);
    return <SessionContext.Provider value={{ ...state, userId: state.user?.id ?? null, isAdmin: Boolean(state.user?.isAdmin),
        isLoading: ['loading', 'preparing'].includes(state.status), refresh, logout, discardLocalChanges }}>{children}</SessionContext.Provider>;
}
export function useSession() {
    const context = useContext(SessionContext);
    if (!context) throw new Error('useSession must be used within SessionProvider');
    return context;
}
export function useDatabase(): AccountDatabase {
    const { database } = useSession();
    if (!database) throw new Error('account_cache_not_ready');
    return database;
}
