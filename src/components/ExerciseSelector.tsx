import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { MUSCLE_GROUP_SECTIONS, rankExercises } from '@/lib/exerciseCatalog';
import type { MuscleGroup } from '@shared/exercises';

export function ExerciseSelector({ workoutId }: { workoutId: string }) {
    const db = useDatabase();
    const { t } = useLanguage();
    const uses = useLiveQuery(() => db.workoutExercises.toArray(), [db]);
    const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | ''>('');
    const [busyId, setBusyId] = useState<string>();
    const [failed, setFailed] = useState(false);
    const selected = new Set(uses?.filter(use => use.workoutId === workoutId).map(use => use.exerciseId));
    const exercises = rankExercises(uses ?? [], muscleGroup || undefined);

    const addExercise = async (exerciseId: string) => {
        setBusyId(exerciseId);
        setFailed(false);
        try {
            await applyOperation(db, 'workoutExercise.create', null, { workoutId, exerciseId });
        } catch {
            setFailed(true);
        } finally {
            setBusyId(undefined);
        }
    };

    return <section className="space-y-3">
        <div>
            <h2 className="text-xl font-bold">{t('exercise.title')}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{t('exercise.sortedByUsage')}</p>
        </div>
        <label className="block space-y-1">
            <span className="text-sm font-medium">{t('exercise.muscleGroup')}</span>
            <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                value={muscleGroup}
                onChange={event => setMuscleGroup(event.target.value as MuscleGroup | '')}
            >
                <option value="">{t('exercise.allGroups')}</option>
                {MUSCLE_GROUP_SECTIONS.map(section => <optgroup key={section.label} label={t(section.label)}>
                    {section.groups.map(group => <option key={group} value={group}>{t(`exercise.muscle.${group}`)}</option>)}
                </optgroup>)}
            </select>
        </label>
        {failed && <p role="alert">{t('sync.operationFailed')}</p>}
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {exercises.map(exercise => <li key={exercise.id}>
                <button
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-[var(--card)] p-3 text-left disabled:opacity-50"
                    disabled={selected.has(exercise.id) || busyId !== undefined}
                    onClick={() => void addExercise(exercise.id)}
                >
                    <span>
                        <span className="block font-medium">{exercise.name}</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">{exercise.equipment}</span>
                    </span>
                    <span className="shrink-0 text-sm">{selected.has(exercise.id) ? t('exercise.added') : t('exercise.add')}</span>
                </button>
            </li>)}
        </ul>
    </section>;
}
