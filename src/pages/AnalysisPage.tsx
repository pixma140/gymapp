import { useState } from 'react';
import { WorkoutHistoryList } from '@/components/WorkoutHistoryList';
import { ProgressChart } from '@/components/ProgressChart';
import { BodyProgressChart } from '@/components/BodyProgressChart';
import { Tabs } from '@/components/Tabs';
import { useLanguage } from '@/i18n/LanguageContext';

export function AnalysisPage() {
    const [activeTab, setActiveTab] = useState('workout');
    const { t } = useLanguage();

    const tabs = [
        { id: 'workout', label: t('analysis.tab.workout') },
        { id: 'body', label: t('analysis.tab.body') },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{t('analysis.title')}</h1>
                <p className="text-[var(--muted-foreground)] mt-1">{t('analysis.subtitle')}</p>
            </header>

            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'workout' ? (
                <div className="space-y-8">
                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-[var(--foreground)]">{t('analysis.section.progress')}</h2>
                        <ProgressChart />
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-[var(--foreground)]">{t('analysis.section.recent')}</h2>
                        <WorkoutHistoryList />
                    </section>
                </div>
            ) : (
                <div className="space-y-8">
                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-[var(--foreground)]">{t('analysis.section.bodyMetrics')}</h2>
                        <p className="text-sm text-[var(--muted-foreground)]">{t('analysis.section.bodyMetrics.desc')}</p>
                        <BodyProgressChart />
                    </section>
                </div>
            )}
        </div>
    );
}
