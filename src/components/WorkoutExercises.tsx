import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { EXERCISES } from '@shared/exercises';
import { useDatabase } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { ExerciseSelector } from '@/components/ExerciseSelector';
import { WorkoutExerciseCard } from '@/components/WorkoutExerciseCard';

export function WorkoutExercises({ workoutId, editable = true }: { workoutId: string; editable?: boolean }) {
    const db = useDatabase();
    const { t } = useLanguage();
    const [selecting, setSelecting] = useState(false);
    const uses = useLiveQuery(() => db.workoutExercises.where('workoutId').equals(workoutId).sortBy('id'), [db, workoutId]);
    const custom = useLiveQuery(() => db.customExercises.toArray(), [db]);
    const catalog = new Map([...EXERCISES, ...(custom ?? []).map(exercise => ({ ...exercise, equipment: '' }))].map(exercise => [exercise.id, exercise]));
    return <div className="space-y-5">
        {uses?.map(use => <WorkoutExerciseCard key={use.id} exercise={use} catalog={catalog.get(use.exerciseId)} editable={editable} />)}
        {editable ? <button onClick={() => setSelecting(true)} className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]">
            <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent)]"><Plus className="size-6" /></span>
            {t('exercise.addToWorkout')}
        </button> : !uses?.length && <p className="text-[var(--muted-foreground)]">{t('exercise.none')}</p>}
        {selecting && <ExerciseSelector workoutId={workoutId} onClose={() => setSelecting(false)} />}
    </div>;
}
