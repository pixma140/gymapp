import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus, Save, Search } from 'lucide-react';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation, createAndSelectExercise } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { rankExercises } from '@/lib/exerciseCatalog';
import { Modal } from '@/components/Modal';
import { MuscleGroupSelect } from '@/components/MuscleGroupSelect';
import type { MuscleGroup } from '@shared/exercises';

export function ExerciseSelector({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
    const db = useDatabase();
    const { t } = useLanguage();
    const uses = useLiveQuery(() => db.workoutExercises.toArray(), [db]);
    const custom = useLiveQuery(() => db.customExercises.toArray(), [db]);
    const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | ''>('');
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const selected = new Set(uses?.filter(use => use.workoutId === workoutId).map(use => use.exerciseId));
    const exercises = rankExercises(uses ?? [], muscleGroup || undefined,
        custom?.map(exercise => ({ ...exercise, equipment: '' })), search);
    const save = async (action: () => Promise<unknown>) => {
        setBusy(true); setFailed(false);
        try { await action(); onClose(); } catch { setFailed(true); } finally { setBusy(false); }
    };
    return <Modal title={t(creating ? 'exercise.new' : 'exercise.select')} onClose={() => { if (!busy) onClose(); }}>
        {failed && <p role="alert" className="text-sm text-red-500">{t('sync.operationFailed')}</p>}
        {creating ? <form className="space-y-5" onSubmit={event => {
            event.preventDefault();
            if (muscleGroup && name.trim()) void save(() => createAndSelectExercise(db, workoutId, { name: name.trim(), muscleGroup }));
        }}>
            <label className="block space-y-2">
                <span className="text-xs font-medium uppercase text-[var(--muted-foreground)]">{t('exercise.name')}</span>
                <input autoFocus required maxLength={200} value={name} onChange={event => setName(event.target.value)}
                    placeholder={t('exercise.namePlaceholder')} className="w-full rounded-xl bg-[var(--accent)] p-3 outline-[var(--primary)]" />
            </label>
            <MuscleGroupSelect value={muscleGroup} onChange={setMuscleGroup} allowAll={false} />
            <div className="flex justify-end gap-3">
                <button type="button" disabled={busy} onClick={() => setCreating(false)} className="px-4 py-2 text-[var(--muted-foreground)]">{t('common.cancel')}</button>
                <button disabled={busy || !name.trim() || !muscleGroup} className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 font-bold text-white disabled:opacity-50">
                    <Save className="size-4" />{t('exercise.save')}
                </button>
            </div>
        </form> : <>
            <label className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3">
                <Search className="size-4 shrink-0 text-[var(--muted-foreground)]" />
                <input autoFocus aria-label={t('exercise.search')} placeholder={t('exercise.search')} value={search}
                    onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
            </label>
            <MuscleGroupSelect value={muscleGroup} onChange={setMuscleGroup} />
            <p className="text-xs text-[var(--muted-foreground)]">{t('exercise.sortedByUsage')}</p>
            <ul className="max-h-[40dvh] space-y-2 overflow-y-auto">
                {exercises.map(exercise => <li key={exercise.id}>
                    <button disabled={busy || !uses || !custom || selected.has(exercise.id)}
                        onClick={() => void save(() => applyOperation(db, 'workoutExercise.create', null, { workoutId, exerciseId: exercise.id }))}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4 text-left hover:border-[var(--primary)] disabled:opacity-40">
                        <span><span className="block font-semibold">{exercise.name}</span>
                            <span className="mt-1 inline-block rounded-full border border-[var(--border)] px-2 text-xs text-[var(--muted-foreground)]">{t(`exercise.muscle.${exercise.muscleGroup}`)}</span>
                        </span>
                        {selected.has(exercise.id) ? <span className="text-xs">{t('exercise.added')}</span> : <ChevronRight className="size-4 shrink-0" />}
                    </button>
                </li>)}
            </ul>
            {!exercises.length && <p className="text-sm text-[var(--muted-foreground)]">{t('exercise.noResults')}</p>}
            <button onClick={() => { setName(search); setCreating(true); setFailed(false); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--primary)] bg-[var(--accent)] p-3 font-semibold">
                <Plus className="size-4" />{t('exercise.cantFind')}
            </button>
        </>}
    </Modal>;
}
