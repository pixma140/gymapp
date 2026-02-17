import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GymList } from '@/components/GymList';
import { AddGymForm } from '@/components/AddGymForm';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useLanguage } from '@/i18n/LanguageContext';

export function TrainingPage() {
    const [view, setView] = useState<'list' | 'add'>('list');
    const navigate = useNavigate();
    const activeWorkout = useActiveWorkout();
    const { t } = useLanguage();

    const handleGymSelect = (gymId: number) => {
        if (activeWorkout) {
            if (activeWorkout.gymId === gymId) {
                navigate(`/workout/${gymId}`);
            } else {
                // Prevent starting new workout if one exists
                const gymName = activeWorkout.gymName || t('common.unknownGym');
                const confirmMessage = `${t('training.activeWorkoutConfirmPrefix')} ${gymName}. ${t('training.activeWorkoutConfirmSuffix')}`;
                if (window.confirm(confirmMessage)) {
                    navigate(`/workout/${activeWorkout.gymId}`);
                }
            }
        } else {
            navigate(`/workout/${gymId}`);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{t('training.title')}</h1>
                <p className="text-[var(--muted-foreground)] mt-1">
                    {view === 'add' ? t('training.subtitle.add') : t('training.subtitle.select')}
                </p>
            </header>

            <div className="grid gap-4">
                {view === 'list' && (
                    <GymList
                        onSelect={handleGymSelect}
                        onAdd={() => setView('add')}
                    />
                )}

                {view === 'add' && (
                    <AddGymForm
                        onCancel={() => setView('list')}
                        onComplete={() => setView('list')}
                    />
                )}
            </div>
        </div>
    );
}
