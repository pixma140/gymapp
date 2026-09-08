/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSessionUser, type SessionUser } from '@/auth/session';

interface SessionContextValue {
    user: SessionUser | null;
    userId: number | null;
    isAdmin: boolean;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        const sessionUser = await getSessionUser();
        setUser(sessionUser);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        let active = true;

        void (async () => {
            const sessionUser = await getSessionUser();
            if (active) {
                setUser(sessionUser);
                setIsLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    return (
        <SessionContext.Provider
            value={{
                user,
                userId: user?.id ?? null,
                isAdmin: Boolean(user?.isAdmin),
                isLoading,
                refresh
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
