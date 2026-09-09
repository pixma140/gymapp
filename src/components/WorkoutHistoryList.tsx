import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { EXERCISES } from '@shared/exercises';
import { formatDuration } from '@/lib/workoutDisplay';

export function WorkoutHistoryList() {
    const db = useDatabase();
    const { language, t } = useLanguage();
    const [deleting, setDeleting] = useState(false);
    const [failed, setFailed] = useState(false);
    const workouts = useLiveQuery(async () => {
        const allWorkouts = await db.workouts.orderBy('startTime').reverse().filter(workout => workout.endTime !== null).toArray();
        const uses = await db.workoutExercises.toArray();
        const custom = await db.customExercises.toArray();
        const names = new Map([...EXERCISES, ...custom].map(exercise => [exercise.id, exercise.name]));
        // Enrich with gym name
        const gymIds = [...new Set(allWorkouts.map(w => w.gymId))];
        const gyms = await db.gyms.where('id').anyOf(gymIds).toArray();
        const gymMap = new Map(gyms.map(g => [g.id, g.name]));

        return allWorkouts.map(w => ({
            ...w,
            gymName: gymMap.get(w.gymId),
            exercises: uses.filter(use => use.workoutId === w.id).map(use => ({ name: names.get(use.exerciseId), sets: use.sets.length })),
        }));
    }, [db]);

    if (!workouts) return <div className="text-[var(--muted-foreground)] text-center py-8">{t('history.loading')}</div>;

    return (
        <div className="space-y-4">
            {failed && <p role="alert">{t('sync.operationFailed')}</p>}
            {workouts.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]">
                    <p className="text-[var(--muted-foreground)]">{t('history.empty')}</p>
                </div>
            ) : (
                workouts.map(workout => (
                    <div key={workout.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex justify-between items-center group hover:border-[var(--primary)]/40 transition-colors">
                        <div>
                            <h3 className="font-semibold text-[var(--foreground)]">{workout.gymName || t('common.unknownGym')}</h3>
                            {workout.endTime !== null && <p className="font-mono text-sm text-[var(--muted-foreground)]">{formatDuration(workout.endTime - workout.startTime)}</p>}
                            <ul className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                                {workout.exercises.map((exercise, index) => <li key={index}>{exercise.name ?? t('exercise.unknown')} · {exercise.sets} {t('sets.title')}</li>)}
                            </ul>
                            <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)] mt-1">
                                <div className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {new Date(workout.startTime).toLocaleDateString(language)}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {new Date(workout.startTime).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label={t('history.delete')}
                                disabled={deleting}
                                onClick={async () => {
                                    if (deleting || !window.confirm(t('history.deleteConfirm'))) return;
                                    setDeleting(true);
                                    setFailed(false);
                                    try {
                                        await applyOperation(db, 'workout.delete', workout.id, {});
                                    } catch {
                                        setFailed(true);
                                    } finally {
                                        setDeleting(false);
                                    }
                                }}
                                className="p-2 rounded-full hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-500 transition-colors disabled:opacity-50"
                                title={t('history.delete')}
                            >
                                <Trash2 className="size-4" />
                            </button>
                            <Link
                                to={`/workout/${workout.id}/view`}
                                aria-label={t('history.view')}
                                className="p-2 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                title={t('history.view')}
                            >
                                <ChevronRight className="size-5" />
                            </Link>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
