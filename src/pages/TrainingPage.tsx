import { Link } from 'react-router-dom';
import { GymList } from '@/components/GymList';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useLanguage } from '@/i18n/LanguageContext';

export function TrainingPage() {
    const active = useActiveWorkout();
    const { t } = useLanguage();

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{t('training.title')}</h1>
                <p className="text-[var(--muted-foreground)] mt-1">{t('training.subtitle.select')}</p>
            </header>

            {active && <Link className="inline-block p-4 bg-[var(--primary)] rounded-xl" to={`/workout/${active.gymId}`}>{t('timed.resume')}</Link>}
            <GymList activeGymId={active?.gymId} />
        </div>
    );
}
