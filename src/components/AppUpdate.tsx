import { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

export function AppUpdate() {
    const { t } = useLanguage();
    const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
    useEffect(() => {
        if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
        let disposed = false;
        let registration: ServiceWorkerRegistration | undefined;
        let controlled = Boolean(navigator.serviceWorker.controller);
        const changed = () => {
            if (controlled) window.location.reload();
            controlled = true;
        };
        const check = () => {
            if (registration?.waiting && !disposed) setWaiting(registration.waiting);
        };
        const found = () => registration?.installing?.addEventListener('statechange', check);
        const update = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {});
        };
        navigator.serviceWorker.addEventListener('controllerchange', changed);
        void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(result => {
            if (disposed) return;
            registration = result;
            check();
            found();
            registration.addEventListener('updatefound', found);
        }).catch(() => {});
        document.addEventListener('visibilitychange', update);
        window.addEventListener('online', update);
        return () => {
            disposed = true;
            navigator.serviceWorker.removeEventListener('controllerchange', changed);
            registration?.removeEventListener('updatefound', found);
            document.removeEventListener('visibilitychange', update);
            window.removeEventListener('online', update);
        };
    }, []);
    if (!waiting) return null;
    return <div className="fixed top-4 inset-x-4 z-[100] mx-auto max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
        <p className="text-sm">{t('pwa.updateAvailable')}</p>
        <button className="mt-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-white" onClick={() => {
            if (window.confirm(t('pwa.updateConfirm'))) waiting.postMessage({ type: 'SKIP_WAITING' });
        }}>{t('pwa.update')}</button>
    </div>;
}
