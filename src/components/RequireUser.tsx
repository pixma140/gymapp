import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Navigate, Outlet } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';

export function RequireUser() {
    const userCount = useLiveQuery(() => db.users.count());
    const { t } = useLanguage();

    // Wait for query to resolve
    if (userCount === undefined) {
        return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)]">{t('common.loading')}</div>;
    }

    if (userCount === 0) {
        return <Navigate to="/onboarding" replace />;
    }

    return <Outlet />;
}
