import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { ArrowLeft, Plus, Timer } from 'lucide-react';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { ExerciseSelector } from '@/components/ExerciseSelector';
import { ActiveExercise } from '@/components/ActiveExercise';
import { useState } from 'react';

export function WorkoutPage() {
    const { gymId } = useParams();
    const navigate = useNavigate();
    const id = Number(gymId);
    const gym = useLiveQuery(() => db.gyms.get(id), [id]);
    const [showExerciseSelector, setShowExerciseSelector] = useState(false);

    const {
        workoutSets,
        addSet,
        removeSet,
        finishWorkout
    } = useWorkoutSession(id);

    // Group sets by exercise
    const exerciseIds = [...new Set(workoutSets?.map(s => s.exerciseId))];

    const [sessionExercises, setSessionExercises] = useState<number[]>([]);

    const displayedExercises = useLiveQuery(async () => {
        const setExIds = exerciseIds || [];
        const allIds = [...new Set([...setExIds, ...sessionExercises])];
        return allIds.length > 0 ? await db.exercises.where('id').anyOf(allIds).toArray() : [];
    }, [exerciseIds, sessionExercises]);

    const handleFinish = async () => {
        await finishWorkout();
        navigate('/analysis');
    };

    const handleOpenExerciseSelector = () => {
        setShowExerciseSelector(true);
    };

    if (!gym) return <div className="p-8 text-center text-zinc-500">Initializing workout...</div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500 min-h-full flex flex-col pb-20 p-4">
            <header className="flex items-center justify-between bg-zinc-900/50 backdrop-blur-md p-4 -mx-4 sticky top-0 z-10 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="size-6" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight truncate max-w-[200px]">{gym.name}</h1>
                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono">
                            <Timer className="size-3" />
                            <span>00:00</span>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleFinish}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-green-900/20"
                >
                    Finish
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
                    type="button"
                    onClick={handleOpenExerciseSelector}
                    onPointerUp={handleOpenExerciseSelector}
                    className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 transition-all flex flex-col items-center justify-center gap-2"
                >
                    <div className="bg-zinc-800 p-3 rounded-full">
                        <Plus className="size-6" />
                    </div>
                    <span className="font-medium">Add Exercise</span>
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
