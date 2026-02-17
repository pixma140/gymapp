import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Edit2, Trash2 } from 'lucide-react';

export function WorkoutHistoryList() {
    const workouts = useLiveQuery(async () => {
        const allWorkouts = await db.workouts.orderBy('startTime').reverse().toArray();
        // Enrich with gym name
        const gymIds = [...new Set(allWorkouts.map(w => w.gymId))];
        const gyms = await db.gyms.where('id').anyOf(gymIds).toArray();
        const gymMap = new Map(gyms.map(g => [g.id, g.name]));

        return allWorkouts.map(w => ({
            ...w,
            gymName: gymMap.get(w.gymId) || 'Unknown Gym'
        }));
    });

    if (!workouts) return <div className="text-[var(--muted-foreground)] text-center py-8">Loading ...</div>;

    return (
        <div className="space-y-4">
            {workouts.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]">
                    <p className="text-[var(--muted-foreground)]">No completed workouts yet.</p>
                </div>
            ) : (
                workouts.map(workout => (
                    <div key={workout.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex justify-between items-center group hover:border-[var(--primary)]/40 transition-colors">
                        <div>
                            <h3 className="font-semibold text-[var(--foreground)]">{workout.gymName}</h3>
                            <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)] mt-1">
                                <div className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {new Date(workout.startTime).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {new Date(workout.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                to={`/workout/${workout.id}/edit`}
                                className="p-2 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                                title="Edit workout"
                            >
                                <Edit2 className="size-4" />
                            </Link>
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    if (window.confirm('Are you sure you want to delete this workout?')) {
                                        await db.transaction('rw', db.workouts, db.workoutSets, async () => {
                                            await db.workoutSets.where('workoutId').equals(workout.id!).delete();
                                            await db.workouts.delete(workout.id!);
                                        });
                                    }
                                }}
                                className="p-2 rounded-full hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                                title="Delete workout"
                            >
                                <Trash2 className="size-4" />
                            </button>
                            <Link
                                to={`/workout/${workout.id}/view`}
                                className="p-2 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                title="View details"
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
