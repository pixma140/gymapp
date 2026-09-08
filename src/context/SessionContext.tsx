/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AUTHORIZATION_FAILURE, ApiError } from '@/lib/api';
import { getBootstrap, logoutSession, type Capabilities, type SessionUser } from '@/auth/session';
import { readSession, subscribeSession, notifySession, sessionEpoch } from '@/auth/tabs';
import { AccountDatabase, clearLegacyCacheOnce } from '@/db/db';
import { discardPendingChanges, prepareAccountCache, resolvePendingConflict } from '@/db/hydrate';
import { flushPendingMutations } from '@/db/sqliteSync';

type Status = 'loading' | 'setup' | 'signedOut' | 'preparing' | 'ready' | 'failed';
interface SessionState {
    status: Status;
    user: SessionUser | null;
    database: AccountDatabase | null;
    capabilities: Capabilities | null;
    error: Error | null;
}
interface SessionContextValue extends SessionState {
    userId: number | null;
    isAdmin: boolean;
    isLoading: boolean;
    refresh: () => Promise<void>;
    drain: () => Promise<void>;
    logout: () => Promise<void>;
    discardLocalChanges: () => Promise<void>;
    resolveConflict: (resolution: 'discard' | 'reapply') => Promise<void>;
}
const detached = (status: Status, error: Error | null = null): SessionState =>
    ({ status, user: null, database: null, capabilities: null, error });
const SessionContext = createContext<SessionContextValue | undefined>(undefined);
export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<SessionState>(detached('loading'));
    const generation = useRef(0);
    const current = useRef<AccountDatabase | null>(null);
    const readyRole = useRef(false);
    const epoch = useRef<string | null>(null);
    const sender = useRef<Promise<void>>(Promise.resolve());
    const stop = useCallback(async () => {
        const version = ++generation.current;
        const database = current.current;
        current.current = null;
        setState(detached('loading'));
        await sender.current.catch(() => {});
        database?.close();
        return version;
    }, []);
    const refresh = useCallback(async () => {
        const version = await stop();
        if (version !== generation.current) return;
        let database: AccountDatabase | null = null;
        try {
            // Bootstrap and cache preparation exclude senders in every tab. Its
            // snapshot cannot become stale while waiting for an account lock.
            await readSession(async () => {
                if (version !== generation.current) return;
                const preparingEpoch = sessionEpoch();
                const bootstrap = await getBootstrap();
                if (version !== generation.current) return;
                if (bootstrap.status !== 'authenticated') {
                    setState(detached(bootstrap.status));
                    return;
                }
                const { user, capabilities, snapshot } = bootstrap;
                setState({ ...detached('preparing'), user, capabilities });
                await clearLegacyCacheOnce();
                if (version !== generation.current) return;
                database = new AccountDatabase({ accountId: user.id, installationId: bootstrap.installationId });
                await database.open();
                const result = await prepareAccountCache(database, snapshot);
                if (result.status === 'error') throw result.error;
                if (version !== generation.current) { database.close(); return; }
                if (preparingEpoch !== sessionEpoch()) { database.close(); return; }
                readyRole.current = user.isAdmin;
                epoch.current = preparingEpoch;
                current.current = database;
                setState({ status: 'ready', user, capabilities, database, error: null });
            }, true);
        } catch (error) {
            // The locally opened handle belongs to this bootstrap, never a later account.
            if (database) (database as AccountDatabase).close();
            if (version === generation.current) setState(detached('failed', error instanceof Error ? error : new Error('bootstrap_failed')));
        }
    }, [stop]);
    const drain = useCallback(() => {
        const database = current.current;
        if (database && epoch.current !== sessionEpoch()) return refresh();
        const version = generation.current;
        const active = () => generation.current === version && current.current === database && epoch.current === sessionEpoch();
        sender.current = sender.current.catch(() => {}).then(() =>
            database && active() ? flushPendingMutations(database, active) : undefined);
        return sender.current;
    }, [refresh]);
    const logout = useCallback(async () => {
        const version = await stop();
        if (version !== generation.current) return;
        try {
            await logoutSession();
            if (version === generation.current) setState(detached('signedOut'));
        } catch (error) {
            if (version === generation.current) setState(detached('failed', error instanceof Error ? error : new Error('logout_failed')));
        }
    }, [stop]);
    const discardLocalChanges = useCallback(async () => {
        const attached = current.current;
        if (!attached) return;
        const binding = attached.binding;
        const expectedMutationIds = (await attached.outbox.orderBy('sequence').toArray()).map(entry => entry.intent.mutationId);
        const version = await stop();
        if (version !== generation.current) return;
        let database: AccountDatabase | null = null;
        try {
            await readSession(async () => {
                if (version !== generation.current) return;
                const preparingEpoch = sessionEpoch();
                const bootstrap = await getBootstrap();
                if (version !== generation.current) return;
                if (bootstrap.status !== 'authenticated' || bootstrap.user.id !== binding.accountId
                    || bootstrap.installationId !== binding.installationId) throw new Error('account_binding_mismatch');
                database = new AccountDatabase(binding);
                await database.open();
                await discardPendingChanges(database, bootstrap.snapshot, expectedMutationIds);
                if (version !== generation.current || preparingEpoch !== sessionEpoch()) { database.close(); return; }
                readyRole.current = bootstrap.user.isAdmin;
                epoch.current = preparingEpoch;
                current.current = database;
                setState({ status: 'ready', user: bootstrap.user, capabilities: bootstrap.capabilities, database, error: null });
            }, true);
        } catch (error) {
            if (database) (database as AccountDatabase).close();
            if (version === generation.current) setState(detached('failed', error instanceof Error ? error : new Error('discard_failed')));
            throw error;
        }
    }, [stop]);
    const resolveConflict = useCallback(async (resolution: 'discard' | 'reapply') => {
        const attached = current.current;
        if (!attached) return;
        const binding = attached.binding;
        const expectedMutationIds = (await attached.outbox.orderBy('sequence').toArray()).map(entry => entry.intent.mutationId);
        const version = await stop();
        if (version !== generation.current) return;
        let database: AccountDatabase | null = null;
        try {
            await readSession(async () => {
                if (version !== generation.current) return;
                const preparingEpoch = sessionEpoch();
                const bootstrap = await getBootstrap();
                if (version !== generation.current) return;
                if (bootstrap.status !== 'authenticated' || bootstrap.user.id !== binding.accountId
                    || bootstrap.installationId !== binding.installationId) throw new Error('account_binding_mismatch');
                database = new AccountDatabase(binding);
                await database.open();
                await resolvePendingConflict(database, bootstrap.snapshot, expectedMutationIds, resolution);
                if (version !== generation.current || preparingEpoch !== sessionEpoch()) { database.close(); return; }
                readyRole.current = bootstrap.user.isAdmin;
                epoch.current = preparingEpoch;
                current.current = database;
                setState({ status: 'ready', user: bootstrap.user, capabilities: bootstrap.capabilities, database, error: null });
            }, true);
        } catch (error) {
            if (database) (database as AccountDatabase).close();
            if (version === generation.current) setState(detached('failed', error instanceof Error ? error : new Error('resolution_failed')));
            throw error;
        }
    }, [stop]);
    useEffect(() => {
        const initialRefresh = window.setTimeout(() => void refresh(), 0);
        const unsubscribe = subscribeSession(message => {
            if (message === 'changing') void stop();
            else void refresh();
        });
        const revalidate = () => void refresh();
        const resume = () => {
            const database = current.current;
            if (document.visibilityState !== 'visible' || !database) return;
            if (epoch.current !== sessionEpoch()) { void refresh(); return; }
            const version = generation.current;
            // A ready cache remains usable offline. Only a confirmed identity or
            // role change detaches it; returning to the tab is not a data refresh.
            void readSession(getBootstrap).then(bootstrap => {
                if (version !== generation.current || current.current !== database) return;
                if (bootstrap.status !== 'authenticated' || bootstrap.user.id !== database.binding.accountId
                    || bootstrap.installationId !== database.binding.installationId || bootstrap.user.isAdmin !== readyRole.current) {
                    void refresh();
                }
            }).catch(() => {});
        };
        window.addEventListener(AUTHORIZATION_FAILURE, revalidate);
        document.addEventListener('visibilitychange', resume);
        // An OIDC redirect replaces the document, so the arriving document tells
        // waiting tabs to revalidate after the callback has set its cookie.
        if (sessionStorage.getItem('gymapp-oidc-return')) {
            sessionStorage.removeItem('gymapp-oidc-return');
            notifySession('changed');
        }
        return () => {
            clearTimeout(initialRefresh);
            unsubscribe();
            window.removeEventListener(AUTHORIZATION_FAILURE, revalidate);
            document.removeEventListener('visibilitychange', resume);
            void stop();
        };
    }, [refresh, stop]);
    useEffect(() => {
        if (state.status !== 'ready' || !state.database) return;
        const send = () => { void drain().catch(() => {}); };
        send();
        const timer = window.setInterval(send, 2000);
        window.addEventListener('online', send);
        return () => { clearInterval(timer); window.removeEventListener('online', send); };
    }, [state.status, state.database, drain]);
    return <SessionContext.Provider value={{ ...state, userId: state.user?.id ?? null,
        isAdmin: state.status === 'ready' && Boolean(state.capabilities?.manageUsers),
        isLoading: ['loading', 'preparing'].includes(state.status), refresh, drain, logout, discardLocalChanges, resolveConflict }}>{children}</SessionContext.Provider>;
}
export function useSession() {
    const context = useContext(SessionContext);
    if (!context) throw new Error('useSession must be used within SessionProvider');
    return context;
}
export function useDatabase(): AccountDatabase {
    const { status, database } = useSession();
    if (status !== 'ready' || !database) throw new ApiError('unauthenticated', 'account_cache_not_ready');
    return database;
}
