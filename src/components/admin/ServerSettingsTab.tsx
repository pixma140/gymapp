import { useEffect, useState } from 'react';
import { getServerAdminConfig, type ServerAdminConfig } from '@/auth/admin';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

const fields: Array<{ key: Exclude<keyof ServerAdminConfig, 'environmentManaged'>; label: TranslationKey; description: TranslationKey; variable: string }> = [
    { key: 'publicUrl', label: 'admin.config.publicUrl', description: 'admin.config.publicUrl.desc', variable: 'PUBLIC_URL' },
    { key: 'cookieSecure', label: 'admin.config.cookieSecure', description: 'admin.config.cookieSecure.desc', variable: 'COOKIE_SECURE' },
    { key: 'seedDevData', label: 'admin.config.seedDevData', description: 'admin.config.seedDevData.desc', variable: 'SEED_DEV_DATA' },
    { key: 'port', label: 'admin.config.port', description: 'admin.config.port.desc', variable: 'PORT' },
    { key: 'dataDir', label: 'admin.config.dataDir', description: 'admin.config.dataDir.desc', variable: 'DATA_DIR' },
    { key: 'nodeEnv', label: 'admin.config.nodeEnv', description: 'admin.config.nodeEnv.desc', variable: 'NODE_ENV' },
    { key: 'viteApiTarget', label: 'admin.config.viteApiTarget', description: 'admin.config.viteApiTarget.desc', variable: 'VITE_API_TARGET' },
    { key: 'defaultTimeFormat', label: 'settings.timeFormat', description: 'settings.timeFormat.env', variable: 'DEFAULT_TIME_FORMAT' },
];

export function ServerSettingsTab() {
    const { t } = useLanguage();
    const [config, setConfig] = useState<ServerAdminConfig | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let mounted = true;
        void getServerAdminConfig().then(result => {
            if (!mounted) return;
            if (result.ok && result.config) setConfig(result.config);
            else setFailed(true);
        }).catch(() => { if (mounted) setFailed(true); });
        return () => { mounted = false; };
    }, []);

    if (failed) return <p role="alert" className="text-sm text-red-500">{t('admin.config.error')}</p>;
    if (!config) return <p className="text-sm text-[var(--muted-foreground)]">{t('common.loading')}</p>;
    return (
        <div className="space-y-5">
            <header>
                <h2 className="text-lg font-semibold">{t('admin.config.title')}</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">{t('admin.config.desc')}</p>
            </header>
            {fields.map(({ key, label, description, variable }) => (
                <div key={key} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-2">
                    <label htmlFor={`server-${key}`} className="block text-sm font-semibold">{t(label)}</label>
                    <input
                        id={`server-${key}`}
                        readOnly
                        value={typeof config[key] === 'boolean' ? t(config[key] ? 'admin.config.on' : 'admin.config.off') : String(config[key]) || t('admin.config.automatic')}
                        className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)]"
                    />
                    <p className="text-xs text-[var(--muted-foreground)]">{t(description)}</p>
                    <p className="text-xs text-[var(--muted-foreground)]"><code>{variable}</code> — {t(config.environmentManaged.includes(key) ? 'admin.config.managed' : 'admin.config.default')}</p>
                </div>
            ))}
        </div>
    );
}
