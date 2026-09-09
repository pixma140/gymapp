import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Pencil, Save, Timer, Trash2 } from 'lucide-react';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { WorkoutExercises } from '@/components/WorkoutExercises';
import { formatDuration } from '@/lib/workoutDisplay';

export function WorkoutDetailsPage({ editable = false }: { editable?: boolean }) {
    const { workoutId = '' } = useParams();
    const db = useDatabase();
    const { language, t } = useLanguage();
    const navigate = useNavigate();
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const workout = useLiveQuery(() => db.workouts.get(workoutId), [db, workoutId]);
    const gym = useLiveQuery(() => workout ? db.gyms.get(workout.gymId) : undefined, [db, workout]);
    const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
    return <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <Link to="/analysis" aria-label={t('common.back')} className="p-1 text-[var(--muted-foreground)]"><ArrowLeft className="size-5" /></Link>
            <div className="min-w-0 flex-1">
                <h1 className="truncate font-bold">{gym?.name ?? t('common.unknownGym')}</h1>
                {workout && <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
                    <p className="flex items-center gap-1"><Calendar className="size-3" />{new Date(workout.startTime).toLocaleDateString(language)}</p>
                    <p className="flex flex-wrap items-center gap-1 font-mono"><Clock className="size-3" />{time(workout.startTime)} – {workout.endTime === null ? t('timed.active') : time(workout.endTime)}
                        {workout.endTime !== null && <><span>·</span><Timer className="size-3" />{formatDuration(workout.endTime - workout.startTime)}</>}
                    </p>
                </div>}
            </div>
            {workout && <Link to={`/workout/${workoutId}/${editable ? 'view' : 'edit'}`} className="flex items-center gap-1 rounded-full bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white">
                {editable ? <Save className="size-3" /> : <Pencil className="size-3" />}{t(editable ? 'common.save' : 'common.edit')}
            </Link>}
        </header>
        {!workout ? <p>{t('timed.notFound')}</p> : <>
            {editable && <p className="text-xs text-[var(--muted-foreground)]">{t('workout.autoSaved')}</p>}
            <WorkoutExercises workoutId={workoutId} editable={editable} />
            <button disabled={busy} className="flex items-center gap-2 p-3 text-sm text-red-500" onClick={async () => {
                if (!window.confirm(t('history.deleteConfirm'))) return;
                setBusy(true); setFailed(false);
                try { await applyOperation(db, 'workout.delete', workout.id, {}); navigate('/analysis'); } catch { setFailed(true); } finally { setBusy(false); }
            }}><Trash2 className="size-4" />{t('history.delete')}</button>
            {failed && <p role="alert">{t('sync.operationFailed')}</p>}
        </>}
    </div>;
}
