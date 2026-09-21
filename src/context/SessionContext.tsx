/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ProfileFields } from '@shared/commands';
import { AUTHORIZATION_FAILURE, ApiError } from '@/lib/api';
import { finishPendingLogout, getBootstrap, logoutSession, type Capabilities, type SessionUser } from '@/auth/session';
import { forgetAccount, localSession, lockLocalSession, rememberAccount } from '@/auth/localSession';
import { readSession, subscribeSession, notifySession, sessionEpoch } from '@/auth/tabs';
import { AccountDatabase } from '@/db/db';
import { discardPendingChanges, prepareAccountCache, resolvePendingConflict } from '@/db/hydrate';
import { flushPendingMutations } from '@/db/sqliteSync';

type Status = 'loading' | 'setup' | 'signedOut' | 'preparing' | 'ready' | 'failed';
interface SessionState {
    status: Status;
    user: SessionUser | null;
    database: AccountDatabase | null;
    capabilities: Capabilities | null;
    error: Error | null;
    defaultTimeFormat: ProfileFields['timeFormat'];
    offlineAccess: boolean;
}
interface SessionContextValue extends SessionState {
    userId: string | null;
    isAdmin: boolean;
    isLoading: boolean;
    refresh: () => Promise<void>;
    drain: () => Promise<void>;
    logout: () => Promise<void>;
    discardLocalChanges: () => Promise<void>;
    resolveConflict: (resolution: 'discard' | 'reapply') => Promise<void>;
}
const detached = (status: Status, error: Error | null = null): SessionState =>
    ({ status, user: null, database: null, capabilities: null, error, defaultTimeFormat: 'system', offlineAccess: false });
const SessionContext = createContext<SessionContextValue | undefined>(undefined);
export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<SessionState>(detached('loading'));
    const generation = useRef(0);
    const current = useRef<AccountDatabase | null>(null);
    const readyRole = useRef(false);
    const epoch = useRef<string | null>(null);
    const sender = useRef<Promise<void>>(Promise.resolve());
    const verified = useRef(false);
    const checking = useRef(false);
    const stop = useCallback(async () => {
        const version = ++generation.current;
        const database = current.current;
        current.current = null;
        verified.current = false;
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
                if (localSession().locked) {
                    await finishPendingLogout().catch(() => {});
                    if (version === generation.current) setState(detached('signedOut'));
                    return;
                }
                let bootstrap;
                try { bootstrap = await getBootstrap(); }
                catch (error) {
                    const saved = localSession();
                    if (!(error instanceof ApiError) || error.kind !== 'network' || saved.locked || !saved.account) throw error;
                    database = new AccountDatabase({ accountId: saved.account.accountId, installationId: saved.account.installationId });
                    await database.open();
                    const profile = await database.users.get(saved.account.accountId);
                    const metadata = await database.syncMetadata.get('state');
                    if (!profile || !metadata || metadata.accountId !== saved.account.accountId
                        || metadata.installationId !== saved.account.installationId) throw error;
                    if (version !== generation.current || preparingEpoch !== sessionEpoch() || localSession().locked) { database.close(); return; }
                    epoch.current = preparingEpoch;
                    current.current = database;
                    setState({ status: 'ready', database, offlineAccess: true, error: null,
                        user: { ...profile, username: null, isAdmin: false },
                        capabilities: { manageUsers: false, manageOidc: false, manageGyms: false },
                        defaultTimeFormat: saved.account.defaultTimeFormat });
                    return;
                }
                if (version !== generation.current || preparingEpoch !== sessionEpoch() || localSession().locked) return;
                if (bootstrap.status !== 'authenticated') {
                    forgetAccount();
                    setState({ ...detached(bootstrap.status), defaultTimeFormat: bootstrap.defaultTimeFormat });
                    return;
                }
                const { user, capabilities, snapshot, defaultTimeFormat } = bootstrap;
                forgetAccount();
                setState({ ...detached('preparing'), user, capabilities, defaultTimeFormat });
                database = new AccountDatabase({ accountId: user.id, installationId: bootstrap.installationId });
                await database.open();
                const result = await prepareAccountCache(database, snapshot);
                if (result.status === 'error') throw result.error;
                if (version !== generation.current) { database.close(); return; }
                if (preparingEpoch !== sessionEpoch() || localSession().locked) { database.close(); return; }
                readyRole.current = user.isAdmin;
                epoch.current = preparingEpoch;
                current.current = database;
                verified.current = true;
                rememberAccount({ ...database.binding, defaultTimeFormat });
                setState({ status: 'ready', user, capabilities, database, error: null, defaultTimeFormat, offlineAccess: false });
            }, true);
        } catch (error) {
            // The locally opened handle belongs to this bootstrap, never a later account.
            if (database) (database as AccountDatabase).close();
            if (version === generation.current) setState(detached('failed', error instanceof Error ? error : new Error('bootstrap_failed')));
        }
    }, [stop]);
    const drain = useCallback(() => {
        const database = current.current;
        if (localSession().locked) return refresh();
        if (database && epoch.current !== sessionEpoch()) return refresh();
        if (database && !verified.current) {
            if (checking.current || !navigator.onLine) return Promise.resolve();
            checking.current = true;
            const version = generation.current;
            return readSession(getBootstrap).then(() => {
                if (version === generation.current && current.current === database) return refresh();
            }).catch(() => {}).finally(() => { checking.current = false; });
        }
        const version = generation.current;
        const active = () => generation.current === version && current.current === database && epoch.current === sessionEpoch() && !localSession().locked;
        sender.current = sender.current.catch(() => {}).then(() =>
            database && active() ? flushPendingMutations(database, active) : undefined);
        return sender.current;
    }, [refresh]);
    const logout = useCallback(async () => {
        // Persist the lock before waiting for an in-flight sender to finish.
        lockLocalSession();
        const version = await stop();
        if (version !== generation.current) return;
        try {
            await logoutSession();
            if (version === generation.current) setState(detached('signedOut'));
        } catch (error) {
            if (version === generation.current) setState(localSession().locked ? detached('signedOut')
                : detached('failed', error instanceof Error ? error : new Error('logout_failed')));
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
                if (version !== generation.current || preparingEpoch !== sessionEpoch() || localSession().locked) { database.close(); return; }
                readyRole.current = bootstrap.user.isAdmin;
                epoch.current = preparingEpoch;
                current.current = database;
                verified.current = true;
                setState({ status: 'ready', user: bootstrap.user, capabilities: bootstrap.capabilities, database, error: null, defaultTimeFormat: bootstrap.defaultTimeFormat, offlineAccess: false });
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
                if (version !== generation.current || preparingEpoch !== sessionEpoch() || localSession().locked) { database.close(); return; }
                readyRole.current = bootstrap.user.isAdmin;
                epoch.current = preparingEpoch;
                current.current = database;
                verified.current = true;
                setState({ status: 'ready', user: bootstrap.user, capabilities: bootstrap.capabilities, database, error: null, defaultTimeFormat: bootstrap.defaultTimeFormat, offlineAccess: false });
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
        const revalidate = () => { forgetAccount(); void refresh(); };
        const reconnect = () => { if (localSession().locked || !current.current) void refresh(); else void drain(); };
        const storageChanged = (event: StorageEvent) => {
            if (event.key === 'gymapp-session-epoch' || event.key === 'gymapp-local-session' || event.key === null) {
                if (localSession().locked || epoch.current !== sessionEpoch()) void refresh();
            }
        };
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
        window.addEventListener('online', reconnect);
        window.addEventListener('storage', storageChanged);
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
            window.removeEventListener('online', reconnect);
            window.removeEventListener('storage', storageChanged);
            document.removeEventListener('visibilitychange', resume);
            void stop();
        };
    }, [refresh, stop, drain]);
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
