import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Search, Plus, Dumbbell, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

export function ExerciseList({ onSelect, onAdd }: { onSelect: (exerciseId: number) => void, onAdd: () => void }) {
    const [search, setSearch] = useState('');
    const { t } = useLanguage();
    const exercises = useLiveQuery(() => {
        const collection = db.exercises.orderBy('name');
        if (search) {
            // Simple case-insensitive client-side filtering since Dexie string filtering is limited
            return collection.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase())).toArray();
        }
        return collection.toArray();
    }, [search]);

    if (!exercises) return <div className="text-[var(--muted-foreground)] text-center py-8">{t('exercises.loading')}</div>;

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                <input
                    type="text"
                    placeholder={t('exercises.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
            </div>

            {exercises.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]">
                    <div className="size-12 bg-[var(--accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Dumbbell className="size-6 text-[var(--muted-foreground)]" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-1">
                        {search ? t('exercises.empty.noMatchesTitle') : t('exercises.empty.noneTitle')}
                    </h3>
                    <p className="text-[var(--muted-foreground)] text-sm mb-6">
                        {search ? t('exercises.empty.noMatchesBody') : t('exercises.empty.noneBody')}
                    </p>
                    <button
                        onClick={onAdd}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="size-4" />
                        {t('exercises.add')} "{search || t('exercises.new')}"
                    </button>
                </div>
            ) : (
                <div className="grid gap-2">
                    {exercises.map(exercise => (
                        <button
                            key={exercise.id}
                            onClick={() => onSelect(exercise.id)}
                            className="group flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-[var(--primary)]/50 hover:bg-[var(--accent)] transition-all text-left active:scale-[0.98]"
                        >
                            <div>
                                <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">{exercise.name}</h3>
                                {exercise.muscleGroup && (
                                    <span className="text-xs text-[var(--muted-foreground)] px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)] mt-1 inline-block">
                                        {exercise.muscleGroup}
                                    </span>
                                )}
                            </div>
                            <ChevronRight className="size-5 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]/60 transition-colors" />
                        </button>
                    ))}

                    <button
                        onClick={onAdd}
                        className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--accent)] transition-all flex items-center justify-center gap-2 text-sm font-medium mt-2"
                    >
                        <Plus className="size-4" />
                        {t('exercises.cantFindAdd')}
                    </button>
                </div>
            )}
        </div>
    );
}
