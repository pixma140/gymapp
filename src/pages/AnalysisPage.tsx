import { useState } from 'react';
import { WorkoutHistoryList } from '@/components/WorkoutHistoryList';
import { ProgressChart } from '@/components/ProgressChart';
import { BodyProgressChart } from '@/components/BodyProgressChart';
import { Tabs } from '@/components/Tabs';
import { useLanguage } from '@/i18n/LanguageContext';

export function AnalysisPage() {
    const [activeTab, setActiveTab] = useState('workout');
    const [rangeDays, setRangeDays] = useState(30);
    const { t } = useLanguage();

    const rangeOptions = [
        { days: 7, label: t('charts.range.7') },
        { days: 30, label: t('charts.range.30') },
        { days: 90, label: t('charts.range.90') },
        { days: 180, label: t('charts.range.180') },
        { days: 365, label: t('charts.range.365') }
    ];

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
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-[var(--foreground)]">{t('analysis.section.progress')}</h2>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                                <span>{t('charts.rangeLabel')}</span>
                                <select
                                    value={rangeDays}
                                    onChange={e => setRangeDays(Number(e.target.value))}
                                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--foreground)] text-xs font-medium"
                                >
                                    {rangeOptions.map(option => (
                                        <option key={option.days} value={option.days}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <ProgressChart rangeDays={rangeDays} />
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-[var(--foreground)]">{t('analysis.section.recent')}</h2>
                        <WorkoutHistoryList />
                    </section>
                </div>
            ) : (
                <div className="space-y-8">
                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-[var(--foreground)]">{t('analysis.section.bodyMetrics')}</h2>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                                <span>{t('charts.rangeLabel')}</span>
                                <select
                                    value={rangeDays}
                                    onChange={e => setRangeDays(Number(e.target.value))}
                                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--foreground)] text-xs font-medium"
                                >
                                    {rangeOptions.map(option => (
                                        <option key={option.days} value={option.days}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <p className="text-sm text-[var(--muted-foreground)]">{t('analysis.section.bodyMetrics.desc')}</p>
                        <BodyProgressChart rangeDays={rangeDays} />
                    </section>
                </div>
            )}
        </div>
    );
}
