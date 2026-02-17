import { useState } from 'react';
import { db } from '@/db/db';
import { Dumbbell, Save, X } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function AddExerciseForm({ initialName = '', onCancel, onComplete }: { initialName?: string, onCancel: () => void, onComplete: () => void }) {
    const [name, setName] = useState(initialName);
    const [muscleGroup, setMuscleGroup] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await db.exercises.add({
                name: name.trim(),
                muscleGroup: muscleGroup.trim() || undefined,
            });
            onComplete();
        } catch (err) {
            console.error("Failed to add exercise", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const muscleGroups = [
        { id: 'chest', label: t('addExercise.muscle.chest') },
        { id: 'back', label: t('addExercise.muscle.back') },
        { id: 'legs', label: t('addExercise.muscle.legs') },
        { id: 'shoulders', label: t('addExercise.muscle.shoulders') },
        { id: 'arms', label: t('addExercise.muscle.arms') },
        { id: 'core', label: t('addExercise.muscle.core') },
        { id: 'cardio', label: t('addExercise.muscle.cardio') },
        { id: 'fullBody', label: t('addExercise.muscle.fullBody') },
    ];

    return (
        <form onSubmit={handleSubmit} className="p-5 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[var(--foreground)]">{t('addExercise.title')}</h3>
                <button type="button" onClick={onCancel} className="p-2 -mr-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-full hover:bg-[var(--accent)] transition-colors">
                    <X className="size-5" />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('addExercise.nameLabel')}</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 pl-10 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                            placeholder={t('addExercise.namePlaceholder')}
                            autoFocus
                            required
                        />
                        <Dumbbell className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('addExercise.muscleGroupLabel')} <span className="text-[var(--muted-foreground)] font-normal normal-case">({t('common.optional')})</span></label>
                    <div className="flex flex-wrap gap-2">
                        {muscleGroups.map(mg => (
                            <button
                                key={mg.id}
                                type="button"
                                onClick={() => setMuscleGroup(mg.label === muscleGroup ? '' : mg.label)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${muscleGroup === mg.label
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                                    }`}
                            >
                                {mg.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium transition-colors">{t('addExercise.cancel')}</button>
                <button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                >
                    {isSubmitting ? t('addExercise.saving') : (
                        <>
                            <Save className="size-4" />
                            {t('addExercise.save')}
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
