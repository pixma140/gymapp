import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '@/context/SessionContext';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { useLanguage } from '@/i18n/LanguageContext';
import { ExerciseSelector } from '@/components/ExerciseSelector';
export function WorkoutPage() {
    const { gymId = '' } = useParams();
    const db = useDatabase();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const gym = useLiveQuery(() => db.gyms.get(gymId), [db, gymId]);
    const { workout, startWorkout, finishWorkout, cancelWorkout } = useWorkoutSession(gymId);
    const [now, setNow] = useState(Date.now());
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    const act = async (action: () => Promise<unknown>, leave = false) => {
        setBusy(true); setFailed(false);
        try { await action(); if (leave) navigate('/'); } catch { setFailed(true); } finally { setBusy(false); }
    };
    return <div className="space-y-6 max-w-md mx-auto">
        <Link to="/">{t('common.back')}</Link>
        <h1 className="text-2xl font-bold">{gym?.name ?? t('common.unknownGym')}</h1>
        {failed && <p role="alert">{t('sync.operationFailed')}</p>}
        {workout ? <>
            <p className="text-4xl font-mono">{Math.max(0, Math.floor((now - workout.startTime) / 1000))} {t('timed.seconds')}</p>
            {workout.gymId !== gymId && <Link to={`/workout/${workout.gymId}`}>{t('timed.resume')}</Link>}
            <ExerciseSelector workoutId={workout.id} />
            <button disabled={busy} className="p-4 bg-[var(--primary)] rounded-xl" onClick={() => void act(finishWorkout, true)}>{t('timed.finish')}</button>
            <button disabled={busy} className="p-4" onClick={() => { if (window.confirm(t('history.deleteConfirm'))) void act(cancelWorkout, true); }}>{t('timed.cancel')}</button>
        </> : <button disabled={busy || !gym || gym.archived} className="p-4 bg-[var(--primary)] rounded-xl disabled:opacity-50" onClick={() => void act(startWorkout)}>{t('timed.start')}</button>}
    </div>;
}
