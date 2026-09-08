import { Link } from 'react-router-dom';
import { GymList } from '@/components/GymList';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useLanguage } from '@/i18n/LanguageContext';
export function TrainingPage() {
    const active = useActiveWorkout();
    const { t } = useLanguage();
    return <div className="space-y-6 max-w-md mx-auto">
        <h1 className="text-3xl font-bold">{t('training.title')}</h1>
        <p>{t('training.subtitle.select')}</p>
        {active && <Link className="inline-block p-4 bg-[var(--primary)] rounded-xl" to={`/workout/${active.gymId}`}>{t('timed.resume')}</Link>}
        <GymList activeGymId={active?.gymId} />
    </div>;
}
