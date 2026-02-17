import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { ArrowLeft, Calendar, Dumbbell, Edit2, Trash2, Clock, Timer } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function WorkoutDetailsPage() {
    const { workoutId } = useParams();
    const navigate = useNavigate();
    const id = Number(workoutId);
    const { t } = useLanguage();

    const workout = useLiveQuery(() => db.workouts.get(id), [id]);
    const gym = useLiveQuery(() => workout ? db.gyms.get(workout.gymId) : undefined, [workout]);
    const workoutSets = useLiveQuery(() => db.workoutSets.where('workoutId').equals(id).toArray(), [id]);

    // Optimize Exercises Fetching
    const exercises = useLiveQuery(async () => {
        if (!workoutSets) return [];
        const exerciseIds = [...new Set(workoutSets.map(s => s.exerciseId))];
        return await db.exercises.where('id').anyOf(exerciseIds).toArray();
    }, [workoutSets]);

    if (!workout || !gym || !workoutSets || !exercises) {
        return <div className="p-8 text-center text-[var(--muted-foreground)]">{t('workoutDetails.loading')}</div>;
    }

    const setsByExercise = workoutSets.reduce((acc, set) => {
        if (!acc[set.exerciseId]) acc[set.exerciseId] = [];
        acc[set.exerciseId].push(set);
        return acc;
    }, {} as Record<number, typeof workoutSets>);

    const handleDelete = async () => {
        if (window.confirm(t('workoutDetails.deleteConfirm'))) {
            await db.transaction('rw', db.workouts, db.workoutSets, async () => {
                await db.workoutSets.where('workoutId').equals(id).delete();
                await db.workouts.delete(id);
            });
            navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--background)] pb-20 animate-in fade-in duration-300">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-[var(--foreground)]">{gym.name}</h1>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] font-mono">
                                <Calendar className="size-3" />
                                {new Date(workout.startTime).toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] font-mono">
                                <Clock className="size-3" />
                                <span>
                                    {new Date(workout.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {workout.endTime && ` - ${new Date(workout.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                                {workout.endTime && (
                                    <>
                                        <span className="text-[var(--muted-foreground)]">•</span>
                                        <Timer className="size-3" />
                                        <span>
                                            {(() => {
                                                const duration = workout.duration || Math.floor((workout.endTime! - workout.startTime) / 1000);
                                                const h = Math.floor(duration / 3600);
                                                const m = Math.floor((duration % 3600) / 60);
                                                return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                            })()}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center bg-[var(--accent)] rounded-full p-0.5 shadow-sm">
                    <button
                        onClick={() => navigate(`/workout/${id}/edit`)}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-l-full hover:bg-[var(--background)] text-[var(--foreground)] text-sm font-bold transition-colors border-r border-[var(--border)]"
                    >
                        <Edit2 className="size-3.5" />
                        {t('workoutDetails.edit')}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-3 py-1.5 rounded-r-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        title={t('workoutDetails.delete')}
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6 max-w-xl mx-auto">
                {exercises.length === 0 ? (
                    <div className="text-center py-12 text-[var(--muted-foreground)]">
                        <Dumbbell className="size-12 mx-auto mb-3 opacity-20" />
                        <p>{t('workoutDetails.noExercises')}</p>
                    </div>
                ) : (
                    exercises.map(exercise => {
                        const sets = setsByExercise[exercise.id] || [];
                        return (
                            <div key={exercise.id} className="space-y-3">
                                <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
                                    {exercise.name}
                                    <span className="text-xs font-normal text-[var(--muted-foreground)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                                        {sets.length} {t('workoutDetails.sets')}
                                    </span>
                                </h3>
                                <div className="space-y-2">
                                    {sets.map((set, idx) => (
                                        <div
                                            key={set.id}
                                            className={`
                                                flex items-center justify-between p-3 rounded-xl border
                                                ${set.type === 'warmup'
                                                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-600'
                                                    : 'bg-[var(--card)] border-[var(--border)] text-[var(--foreground)]'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`
                                                    text-xs font-bold w-6 text-center py-0.5 rounded
                                                    ${set.type === 'warmup' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}
                                                `}>
                                                    {set.type === 'warmup' ? 'W' : idx + 1}
                                                </span>
                                                <div className="font-mono text-sm">
                                                    <span className="font-bold text-lg">{set.weight}</span>
                                                    <span className="text-xs text-[var(--muted-foreground)] ml-1">{t('common.unit.kg')}</span>
                                                </div>
                                            </div>
                                            <div className="font-mono text-sm">
                                                <span className="font-bold text-lg">{set.reps}</span>
                                                <span className="text-xs text-[var(--muted-foreground)] ml-1">{t('common.unit.reps')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
