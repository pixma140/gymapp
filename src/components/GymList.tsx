import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { MapPin, ChevronRight, Plus } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function GymList({ onSelect, onAdd }: { onSelect: (gymId: number) => void, onAdd: () => void }) {
    const { t } = useLanguage();
    const gymsWithVisits = useLiveQuery(async () => {
        const gyms = await db.gyms.toArray();

        // Calculate visit count from completed workouts
        const gymsWithCounts = await Promise.all(
            gyms.map(async (gym) => {
                const completedWorkouts = await db.workouts
                    .where('gymId')
                    .equals(gym.id)
                    .filter(w => w.endTime !== undefined)
                    .toArray();

                const visitCount = completedWorkouts.length;
                const lastVisited = completedWorkouts.length > 0
                    ? Math.max(...completedWorkouts.map(w => w.endTime || 0))
                    : gym.lastVisited;

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
                    <button
                        onClick={onAdd}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="size-4" />
                        {t('gyms.addNew')}
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {gyms.map(gym => (
                        <button
                            key={gym.id}
                            onClick={() => onSelect(gym.id)}
                            className="group flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-[var(--primary)]/50 hover:bg-[var(--accent)] transition-all text-left active:scale-[0.98]"
                        >
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
                        </button>
                    ))}

                    <button
                        onClick={onAdd}
                        className="w-full py-4 rounded-xl border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--accent)] transition-all flex items-center justify-center gap-2 text-sm font-medium mt-2"
                    >
                        <Plus className="size-4" />
                        {t('gyms.addAnother')}
                    </button>
                </div>
            )}
        </div>
    );
}
