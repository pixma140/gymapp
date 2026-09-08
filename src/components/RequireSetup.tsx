import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getSetupStatus } from '@/auth/session';
import { useLanguage } from '@/i18n/LanguageContext';

export function RequireSetup() {
    const [isLoading, setIsLoading] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        let mounted = true;

        const checkSetup = async () => {
            try {
                const result = await getSetupStatus();
                if (mounted) {
                    setNeedsSetup(result);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        void checkSetup();

        return () => {
            mounted = false;
        };
    }, []);

    if (isLoading) {
        return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)]">{t('common.loading')}</div>;
    }

    if (needsSetup) {
        return <Navigate to="/setup" replace />;
    }

    return <Outlet />;
}
