import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getSessionUser } from '@/auth/session';
import { useLanguage } from '@/i18n/LanguageContext';

export function RequireAuth() {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            try {
                const user = await getSessionUser();
                if (mounted) {
                    setIsAuthenticated(Boolean(user));
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        void checkAuth();

        return () => {
            mounted = false;
        };
    }, []);

    if (isLoading) {
        return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)]">{t('common.loading')}</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }

    return <Outlet />;
}
