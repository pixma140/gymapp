import { useState } from 'react';
import { Tabs } from '@/components/Tabs';
import { OidcSettingsTab } from '@/components/admin/OidcSettingsTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { useLanguage } from '@/i18n/LanguageContext';

type AdminTab = 'oidc' | 'general' | 'users';

export function AdminPage() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<AdminTab>('general');

    const tabs = [
        { id: 'general', label: t('admin.tab.general') },
        { id: 'users', label: t('admin.tab.users') },
        { id: 'oidc', label: t('admin.tab.oidc') }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4 transition-colors duration-300">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{t('admin.title')}</h1>
                <p className="text-[var(--muted-foreground)] mt-1">{t('admin.subtitle')}</p>
            </header>

            <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as AdminTab)} />

            {activeTab === 'oidc' && <OidcSettingsTab />}

            {activeTab === 'users' && <UsersTab />}

            {activeTab === 'general' && (
                <div className="text-sm text-[var(--muted-foreground)] py-12 text-center">
                    {t('admin.comingSoon')}
                </div>
            )}
        </div>
    );
}
