import { useNavigate } from 'react-router-dom';
import { GymList } from '@/components/GymList';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useLanguage } from '@/i18n/LanguageContext';
export function TrainingPage() {
    const navigate = useNavigate();
    const active = useActiveWorkout();
    const { t } = useLanguage();
    return <div className="space-y-6 max-w-md mx-auto">
        <h1 className="text-3xl font-bold">{t('training.title')}</h1>
        <p>{t('training.subtitle.select')}</p>
        {active && <button className="p-4 bg-[var(--primary)] rounded-xl" onClick={() => navigate(`/workout/${active.gymId}`)}>{t('timed.resume')}</button>}
        <GymList onSelect={id => navigate(`/workout/${active?.gymId ?? id}`)} />
    </div>;
}
