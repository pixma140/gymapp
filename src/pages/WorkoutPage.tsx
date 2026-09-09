import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Timer } from 'lucide-react';
import { useDatabase } from '@/context/SessionContext';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { useLanguage } from '@/i18n/LanguageContext';
import { WorkoutExercises } from '@/components/WorkoutExercises';
import { formatDuration } from '@/lib/workoutDisplay';

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
    return <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <Link to="/" aria-label={t('common.back')} className="p-1 text-[var(--muted-foreground)]"><ArrowLeft className="size-5" /></Link>
            <div className="min-w-0 flex-1">
                <h1 className="truncate font-bold">{gym?.name ?? t('common.unknownGym')}</h1>
                {workout && <p className="flex items-center gap-1 font-mono text-xs text-[var(--muted-foreground)]"><Timer className="size-3" />{formatDuration(now - workout.startTime)}</p>}
            </div>
            {workout?.gymId === gymId && <>
                <button disabled={busy} aria-label={t('timed.cancel')} className="rounded-full border border-red-500/40 px-3 py-2 text-xs font-bold text-red-500" onClick={() => { if (window.confirm(t('history.deleteConfirm'))) void act(cancelWorkout, true); }}>{t('common.cancel')}</button>
                <button disabled={busy} aria-label={t('timed.finish')} className="rounded-full bg-green-500 px-4 py-2 text-xs font-bold text-white" onClick={() => void act(finishWorkout, true)}>{t('workout.finishShort')}</button>
            </>}
        </header>
        {failed && <p role="alert">{t('sync.operationFailed')}</p>}
        {workout ? workout.gymId === gymId ? <WorkoutExercises workoutId={workout.id} />
            : <Link to={`/workout/${workout.gymId}`}>{t('timed.resume')}</Link>
            : <button disabled={busy || !gym || gym.archived} className="w-full rounded-2xl border border-dashed border-[var(--border)] p-8 font-semibold text-[var(--primary)] disabled:opacity-50" onClick={() => void act(startWorkout)}>{t('timed.start')}</button>}
    </div>;
}
