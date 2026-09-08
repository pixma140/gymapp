import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';

import { useDatabase } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';

export function GymList({ activeGymId }: { activeGymId?: string }) {
    const db = useDatabase();
    const { t } = useLanguage();
    const gymsWithVisits = useLiveQuery(async () => {
        const gyms = await db.gyms.filter(gym => !gym.archived).toArray();

        // Calculate visit count from completed workouts
        const gymsWithCounts = await Promise.all(
            gyms.map(async (gym) => {
                const completedWorkouts = await db.workouts
                    .where('gymId')
                    .equals(gym.id)
                    .filter(w => w.endTime !== null)
                    .toArray();

                const visitCount = completedWorkouts.length;
                const lastVisited = completedWorkouts.length > 0
                    ? Math.max(...completedWorkouts.map(w => w.endTime || 0))
                    : 0;

                return { ...gym, visitCount, lastVisited };
            })
        );

        // Sort by visit count descending
        return gymsWithCounts.sort((a, b) => b.visitCount - a.visitCount);
    });

    const gyms = gymsWithVisits;

    if (!gyms) return <div className="text-[var(--muted-foreground)] text-center py-8">{t('gyms.loading')}</div>;

    return (
        <div className="space-y-4">
            {gyms.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]">
                    <div className="size-12 bg-[var(--accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="size-6 text-[var(--muted-foreground)]" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-1">{t('gyms.empty.title')}</h3>
                    <p className="text-[var(--muted-foreground)] text-sm mb-6">{t('gyms.empty.subtitle')}</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {gyms.map(gym => {
                        const content = <>
                            <div className="flex-1 min-w-0 mr-4">
                                <h3 className="font-semibold text-lg text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">{gym.name}</h3>
                                {gym.location && (
                                    <div className="flex items-center text-[var(--muted-foreground)] text-sm mt-1">
                                        <MapPin className="size-3.5 mr-1.5 shrink-0" />
                                        <span className="truncate">{gym.location}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end">
                                    <span className="text-[var(--muted-foreground)] text-xs">{t('gyms.visits')}</span>
                                    <span className="text-[var(--foreground)] font-mono font-medium">{gym.visitCount}</span>
                                </div>
                                <ChevronRight className="size-5 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]/60 transition-colors" />
                            </div>
                        </>;
                        const className = "group flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl transition-all text-left";
                        return activeGymId && activeGymId !== gym.id ? (
                            <div key={gym.id} aria-disabled="true" className={`${className} opacity-50`}>
                                {content}
                            </div>
                        ) : (
                            <Link key={gym.id} to={`/workout/${gym.id}`} className={`${className} hover:border-[var(--primary)]/50 hover:bg-[var(--accent)] active:scale-[0.98]`}>
                                {content}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
