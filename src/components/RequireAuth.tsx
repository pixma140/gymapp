import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';
export function RequireAuth() {
    const { status, refresh } = useSession();
    const { t } = useLanguage();
    if (status === 'failed') return <div className="safe-area-screen"><p>{t('sync.loadFailed')}</p><button onClick={() => void refresh()}>{t('sync.retry')}</button></div>;
    if (status === 'setup') return <Navigate to="/setup" replace />;
    if (status === 'signedOut') return <Navigate to="/auth" replace />;
    if (status !== 'ready') return <div className="safe-area-screen">{t('common.loading')}</div>;
    return <Outlet />;
}
