import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getSessionUser } from '@/auth/session';
import { useLanguage } from '@/i18n/LanguageContext';

export function RequireAdmin() {
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        let mounted = true;

        const checkAdmin = async () => {
            try {
                const user = await getSessionUser();
                if (mounted) {
                    setIsAdmin(Boolean(user?.isAdmin));
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        void checkAdmin();

        return () => {
            mounted = false;
        };
    }, []);

    if (isLoading) {
        return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)]">{t('common.loading')}</div>;
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
