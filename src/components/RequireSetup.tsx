import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';
export function RequireSetup() {
    const { status, refresh } = useSession();
    const { t } = useLanguage();
    if (status === 'setup') return <Navigate to="/setup" replace />;
    if (status === 'failed') return <div className="safe-area-screen"><p>{t('sync.loadFailed')}</p><button onClick={() => void refresh()}>{t('sync.retry')}</button></div>;
    if (status === 'loading' || status === 'preparing') return <p>{t('common.loading')}</p>;
    return <Outlet />;
}
