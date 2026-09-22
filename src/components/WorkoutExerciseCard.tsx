import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Plus, Trash2 } from 'lucide-react';
import { v7 as uuidv7 } from 'uuid';
import type { CardioActivity, WorkoutExercise, WorkoutSet } from '@shared/commands';
import type { DisplayExercise } from '@/lib/exerciseCatalog';
import { useDatabase } from '@/context/SessionContext';
import { editCardioActivity, editWorkoutSets, applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/utils';

export function WorkoutExerciseCard({ exercise, catalog, editable = true, initialSetType = 'working' }: {
    exercise: WorkoutExercise; catalog?: DisplayExercise; editable?: boolean; initialSetType?: WorkoutSet['type'];
}) {
    const db = useDatabase();
    const { t, language } = useLanguage();
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [duration, setDuration] = useState(exercise.cardio ? String(exercise.cardio.durationSeconds / 60) : '');
    const [distance, setDistance] = useState(exercise.cardio && 'distanceKm' in exercise.cardio ? String(exercise.cardio.distanceKm) : '');
    const [laps, setLaps] = useState(exercise.cardio && 'laps' in exercise.cardio ? String(exercise.cardio.laps) : '');
    const [speed, setSpeed] = useState(exercise.cardio && 'speed' in exercise.cardio ? String(exercise.cardio.speed) : '');
    const [inclination, setInclination] = useState(exercise.cardio && 'inclination' in exercise.cardio ? String(exercise.cardio.inclination) : '');
    const [distanceMode, setDistanceMode] = useState<'distance' | 'laps'>(exercise.cardio && 'laps' in exercise.cardio ? 'laps' : 'distance');
    const [type, setType] = useState<WorkoutSet['type']>(initialSetType);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const history = useLiveQuery(async () => {
        if (!historyOpen) return [];
        const uses = await db.workoutExercises.where('exerciseId').equals(exercise.exerciseId).toArray();
        const workouts = await db.workouts.toArray();
        return workouts.filter(workout => workout.endTime !== null && workout.id !== exercise.workoutId)
            .sort((a, b) => b.startTime - a.startTime)
            .flatMap(workout => uses.filter(use => use.workoutId === workout.id && (use.sets.length || use.cardio))
                .map(use => ({ ...use, startTime: workout.startTime })));
    }, [db, historyOpen, exercise.exerciseId, exercise.workoutId]);
    const act = async (action: () => Promise<unknown>) => {
        setBusy(true); setFailed(false);
        try { await action(); } catch { setFailed(true); } finally { setBusy(false); }
    };
    const setText = (set: WorkoutSet) => <>
        <strong>{set.weight.toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{t('common.unit.kg')}</span>
        <span className="mx-2 text-[var(--muted-foreground)]">×</span>
        <strong>{set.reps.toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{t('sets.reps')}</span>
    </>;
    const cardioKind = catalog?.source.type === 'cardio' ? catalog.source.id as CardioActivity['kind'] : null;
    const cardioText = (activity: CardioActivity) => <>
        <strong>{(activity.durationSeconds / 60).toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{t('cardio.minutes')}</span>
        {'distanceKm' in activity && activity.distanceKm !== undefined && <><span className="mx-2 text-[var(--muted-foreground)]">·</span><strong>{activity.distanceKm.toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{t('cardio.kilometers')}</span></>}
        {'laps' in activity && activity.laps !== undefined && <><span className="mx-2 text-[var(--muted-foreground)]">·</span><strong>{activity.laps.toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{t('cardio.laps')}</span></>}
        {'speed' in activity && <><span className="mx-2 text-[var(--muted-foreground)]">·</span><strong>{activity.speed.toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{activity.kind === 'walking-pad' ? t('cardio.kilometersPerHour') : t('cardio.speed')}</span></>}
        {'inclination' in activity && activity.inclination !== undefined && <><span className="mx-2 text-[var(--muted-foreground)]">·</span><strong>{activity.inclination.toLocaleString(language)}</strong> <span className="text-xs text-[var(--muted-foreground)]">{t('cardio.percentInclination')}</span></>}
    </>;
    const cardioValid = Boolean(duration) && Number(duration) > 0
        && (cardioKind === 'swimming' || cardioKind === 'jogging' ? distanceMode === 'distance' ? Number(distance) > 0 : Number(laps) > 0
            : cardioKind === 'inline-skating' ? Number(distance) > 0 : Number(speed) > 0);
    return <article className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <header className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words text-lg font-bold">{catalog?.name ?? t('exercise.unknown')}</h2>
                {catalog && <p className="text-sm text-[var(--muted-foreground)]">{t(`exercise.muscle.${catalog.muscleGroup}`)}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-1 text-xs text-[var(--primary)]"><History className="size-3" />{t('exercise.history')}</button>
                {editable && <button disabled={busy} aria-label={t('exercise.remove')} className="p-2 text-[var(--muted-foreground)] hover:text-red-500"
                    onClick={() => { if (window.confirm(t('exercise.removeConfirm'))) void act(() => applyOperation(db, 'workoutExercise.delete', exercise.id, {})); }}><Trash2 className="size-4" /></button>}
            </div>
        </header>
        {!cardioKind && <ul className="space-y-2">
            {exercise.sets.map((set, index) => <li key={set.id} className={cn('flex items-center gap-3 rounded-lg p-2 text-sm', set.type === 'warmup' && 'border border-dashed border-[var(--border)]')}>
                <span title={t(`sets.${set.type}`)} className={cn('min-w-6 rounded px-1 text-center text-xs font-bold', set.type === 'warmup' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500')}>
                    {set.type === 'warmup' ? t('sets.warmupBadge') : index + 1}
                </span>
                <span className="flex-1">{setText(set)}</span>
                {editable && <button disabled={busy} aria-label={t('sets.delete')} className="p-2 text-[var(--muted-foreground)] hover:text-red-500"
                    onClick={() => { if (window.confirm(t('sets.deleteConfirm'))) void act(() => editWorkoutSets(db, exercise.id, sets => sets.filter(row => row.id !== set.id))); }}><Trash2 className="size-4" /></button>}
            </li>)}
        </ul>}
        {cardioKind && exercise.cardio && <div className="rounded-lg bg-[var(--accent)] p-3 text-sm">{cardioText(exercise.cardio)}</div>}
        {editable && !cardioKind && <form className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-end gap-2 border-t border-[var(--border)] pt-3" onSubmit={event => {
            event.preventDefault();
            if (busy || !reps || Number(reps) <= 0) return;
            const set: WorkoutSet = { id: uuidv7(), weight: Number(weight), reps: Number(reps), type };
            void act(() => editWorkoutSets(db, exercise.id, sets => [...sets, set]));
        }}>
            <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('sets.weight')}</span>
                <input aria-label={t('sets.weight')} type="number" inputMode="decimal" min="0" max="10000" step="0.25" placeholder="0" value={weight} onChange={event => setWeight(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>
            <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('sets.reps')}</span>
                <input aria-label={t('sets.reps')} type="number" inputMode="numeric" required min="1" max="10000" step="1" placeholder="0" value={reps} onChange={event => setReps(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>
            <button type="button" aria-label={t('sets.toggleType')} aria-pressed={type === 'warmup'} onClick={() => setType(type === 'warmup' ? 'working' : 'warmup')}
                className={cn('h-10 rounded-lg border px-2 text-[10px] font-bold uppercase', type === 'warmup' ? 'border-amber-500/40 text-amber-500' : 'border-green-500/40 text-green-500')}>{t(`sets.${type}`)}</button>
            <button aria-label={t('sets.add')} disabled={busy || !reps || Number(reps) <= 0} className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-white disabled:opacity-40"><Plus className="size-5" /></button>
        </form>}
        {editable && cardioKind && <form className="grid grid-cols-2 items-end gap-2 border-t border-[var(--border)] pt-3" onSubmit={event => {
            event.preventDefault();
            if (busy || !cardioValid) return;
            const base = { kind: cardioKind, durationSeconds: Math.round(Number(duration) * 60) };
            const activity: CardioActivity = cardioKind === 'swimming' || cardioKind === 'jogging'
                ? distanceMode === 'distance' ? { ...base, kind: cardioKind, distanceKm: Number(distance) } : { ...base, kind: cardioKind, laps: Number(laps) }
                : cardioKind === 'inline-skating' ? { ...base, kind: cardioKind, distanceKm: Number(distance) }
                    : cardioKind === 'stairmaster' ? { ...base, kind: cardioKind, speed: Number(speed) }
                        : { ...base, kind: cardioKind, speed: Number(speed), ...(inclination ? { inclination: Number(inclination) } : {}) };
            void act(() => editCardioActivity(db, exercise.id, activity));
        }}>
            <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('cardio.time')}</span>
                <input aria-label={t('cardio.time')} type="number" inputMode="decimal" required min="0.1" max="10080" step="0.1" placeholder="0" value={duration} onChange={event => setDuration(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>
            {(cardioKind === 'swimming' || cardioKind === 'jogging') && <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('cardio.measure')}</span>
                <select value={distanceMode} onChange={event => setDistanceMode(event.target.value as 'distance' | 'laps')} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-sm"><option value="distance">{t('cardio.distance')}</option><option value="laps">{t('cardio.laps')}</option></select></label>}
            {(cardioKind === 'inline-skating' || ((cardioKind === 'swimming' || cardioKind === 'jogging') && distanceMode === 'distance')) && <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('cardio.distance')}</span>
                <input aria-label={t('cardio.distance')} type="number" inputMode="decimal" required min="0.01" max="10000" step="0.01" placeholder="0" value={distance} onChange={event => setDistance(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>}
            {(cardioKind === 'swimming' || cardioKind === 'jogging') && distanceMode === 'laps' && <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('cardio.laps')}</span>
                <input aria-label={t('cardio.laps')} type="number" inputMode="numeric" required min="1" max="100000" step="1" placeholder="0" value={laps} onChange={event => setLaps(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>}
            {(cardioKind === 'stairmaster' || cardioKind === 'walking-pad') && <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{cardioKind === 'walking-pad' ? t('cardio.speedKph') : t('cardio.speed')}</span>
                <input aria-label={cardioKind === 'walking-pad' ? t('cardio.speedKph') : t('cardio.speed')} type="number" inputMode="decimal" required min="0.1" max={cardioKind === 'walking-pad' ? 1000 : 10000} step="0.1" placeholder="0" value={speed} onChange={event => setSpeed(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>}
            {cardioKind === 'walking-pad' && <label className="min-w-0 space-y-1"><span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{t('cardio.inclination')}</span>
                <input aria-label={t('cardio.inclination')} type="number" inputMode="decimal" min="0" max="100" step="0.1" placeholder={t('cardio.optional')} value={inclination} onChange={event => setInclination(event.target.value)} className="h-10 w-full rounded-lg bg-[var(--accent)] px-2 text-center font-mono text-sm" /></label>}
            <button className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-white disabled:opacity-40" disabled={busy || !cardioValid}><Plus className="size-5" />{exercise.cardio ? t('cardio.update') : t('cardio.save')}</button>
        </form>}
        {failed && <p role="alert" className="text-sm text-red-500">{t('sync.operationFailed')}</p>}
        {historyOpen && <Modal title={`${catalog?.name ?? t('exercise.unknown')} · ${t('exercise.history')}`} onClose={() => setHistoryOpen(false)}>
            {!history?.length && <p className="text-sm text-[var(--muted-foreground)]">{t('exercise.noHistory')}</p>}
            {history?.map(use => <section key={use.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                <h3 className="text-sm font-bold">{new Date(use.startTime).toLocaleDateString(language)}</h3>
                {use.cardio ? <p className="text-sm">{cardioText(use.cardio)}</p> : use.sets.map(set => <p key={set.id} className="text-sm">{setText(set)} <span className="text-xs text-[var(--muted-foreground)]">{t(`sets.${set.type}`)}</span></p>)}
            </section>)}
        </Modal>}
    </article>;
}
