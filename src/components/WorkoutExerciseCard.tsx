import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Plus, Trash2 } from 'lucide-react';
import { v7 as uuidv7 } from 'uuid';
import type { WorkoutExercise, WorkoutSet } from '@shared/commands';
import type { CatalogExercise } from '@shared/exercises';
import { useDatabase } from '@/context/SessionContext';
import { editWorkoutSets, applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/utils';

export function WorkoutExerciseCard({ exercise, catalog, editable = true, initialSetType = 'working' }: {
    exercise: WorkoutExercise; catalog?: CatalogExercise; editable?: boolean; initialSetType?: WorkoutSet['type'];
}) {
    const db = useDatabase();
    const { t, language } = useLanguage();
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
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
            .flatMap(workout => uses.filter(use => use.workoutId === workout.id && use.sets.length)
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
        <ul className="space-y-2">
            {exercise.sets.map((set, index) => <li key={set.id} className={cn('flex items-center gap-3 rounded-lg p-2 text-sm', set.type === 'warmup' && 'border border-dashed border-[var(--border)]')}>
                <span title={t(`sets.${set.type}`)} className={cn('min-w-6 rounded px-1 text-center text-xs font-bold', set.type === 'warmup' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500')}>
                    {set.type === 'warmup' ? t('sets.warmupBadge') : index + 1}
                </span>
                <span className="flex-1">{setText(set)}</span>
                {editable && <button disabled={busy} aria-label={t('sets.delete')} className="p-2 text-[var(--muted-foreground)] hover:text-red-500"
                    onClick={() => { if (window.confirm(t('sets.deleteConfirm'))) void act(() => editWorkoutSets(db, exercise.id, sets => sets.filter(row => row.id !== set.id))); }}><Trash2 className="size-4" /></button>}
            </li>)}
        </ul>
        {editable && <form className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-end gap-2 border-t border-[var(--border)] pt-3" onSubmit={event => {
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
        {failed && <p role="alert" className="text-sm text-red-500">{t('sync.operationFailed')}</p>}
        {historyOpen && <Modal title={`${catalog?.name ?? t('exercise.unknown')} · ${t('exercise.history')}`} onClose={() => setHistoryOpen(false)}>
            {!history?.length && <p className="text-sm text-[var(--muted-foreground)]">{t('exercise.noHistory')}</p>}
            {history?.map(use => <section key={use.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                <h3 className="text-sm font-bold">{new Date(use.startTime).toLocaleDateString(language)}</h3>
                {use.sets.map(set => <p key={set.id} className="text-sm">{setText(set)} <span className="text-xs text-[var(--muted-foreground)]">{t(`sets.${set.type}`)}</span></p>)}
            </section>)}
        </Modal>}
    </article>;
}
