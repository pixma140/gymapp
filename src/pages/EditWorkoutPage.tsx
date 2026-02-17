import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { ArrowLeft, Save, Plus, Calendar, Clock, Timer } from 'lucide-react';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { ExerciseSelector } from '@/components/ExerciseSelector';
import { ActiveExercise } from '@/components/ActiveExercise';
import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

export function EditWorkoutPage() {
    const { workoutId } = useParams();
    const navigate = useNavigate();
    const id = Number(workoutId);
    const { t } = useLanguage();

    const workout = useLiveQuery(() => db.workouts.get(id), [id]);
    const gym = useLiveQuery(() => workout ? db.gyms.get(workout.gymId) : undefined, [workout]);

    const [showExerciseSelector, setShowExerciseSelector] = useState(false);

    const {
        workoutSets,
        addSet,
        removeSet
    } = useWorkoutSession(undefined, id);

    // Group sets by exercise
    const exerciseIds = [...new Set(workoutSets?.map(s => s.exerciseId))];

    const [sessionExercises, setSessionExercises] = useState<number[]>([]);

    const displayedExercises = useLiveQuery(async () => {
        const setExIds = exerciseIds || [];
        const allIds = [...new Set([...setExIds, ...sessionExercises])];
        return allIds.length > 0 ? await db.exercises.where('id').anyOf(allIds).toArray() : [];
    }, [exerciseIds, sessionExercises]);

    const handleSave = () => {
        // Sets are already saved in DB by addSet/removeSet
        // Just navigate back
        navigate('/analysis');
    };

    if (!workout || !gym) return <div className="p-8 text-center text-[var(--muted-foreground)]">{t('editWorkout.loading')}</div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500 min-h-full flex flex-col pb-20 p-4 bg-[var(--background)] transition-colors duration-300">
            <header className="flex items-center justify-between bg-[var(--background)]/80 backdrop-blur-md p-4 -mx-4 sticky top-0 z-10 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                        <ArrowLeft className="size-6" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight truncate max-w-[200px]">{gym.name}</h1>
                        <div className="flex flex-col gap-0.5 mt-0.5 text-[var(--muted-foreground)] text-xs font-mono">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="size-3" />
                                <span>{new Date(workout.startTime).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="size-3" />
                                <span>
                                    {new Date(workout.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {workout.endTime && ` - ${new Date(workout.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                                {workout.endTime && (
                                    <>
                                        <span className="opacity-50">•</span>
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
                <button
                    onClick={handleSave}
                    className="bg-[var(--primary)] hover:opacity-90 text-[var(--primary-foreground)] px-4 py-1.5 rounded-full text-sm font-bold transition-all shadow-[0_0_15px_var(--primary)]/30 flex items-center gap-1"
                >
                    <Save className="size-4" />
                    {t('common.save')}
                </button>
            </header>

            <div className="flex-1 space-y-6">
                {displayedExercises?.map(exercise => (
                    <ActiveExercise
                        key={exercise.id}
                        exercise={exercise}
                        sets={workoutSets?.filter(s => s.exerciseId === exercise.id) || []}
                        onAddSet={(type, w, r) => addSet(exercise.id, type, w, r)}
                        onRemoveSet={removeSet}
                    />
                ))}

                <button
                    onClick={() => setShowExerciseSelector(true)}
                    className="w-full py-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--accent)] transition-all flex flex-col items-center justify-center gap-2"
                >
                    <div className="bg-[var(--background)] p-3 rounded-full border border-[var(--border)]">
                        <Plus className="size-6" />
                    </div>
                    <span className="font-medium">{t('workout.addExercise')}</span>
                </button>
            </div>

            {showExerciseSelector && (
                <ExerciseSelector
                    onCancel={() => setShowExerciseSelector(false)}
                    onSelect={(id) => {
                        setSessionExercises(prev => [...prev, id]);
                        setShowExerciseSelector(false);
                    }}
                />
            )}
        </div>
    );
}
