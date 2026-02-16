import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Edit2 } from 'lucide-react';

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

    if (!workouts) return <div className="text-zinc-500 text-center py-8">Loading ...</div>;

    return (
        <div className="space-y-4">
            {workouts.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50">
                    <p className="text-zinc-500">No completed workouts yet.</p>
                </div>
            ) : (
                workouts.map(workout => (
                    <div key={workout.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex justify-between items-center group hover:border-blue-500/30 transition-colors">
                        <div>
                            <h3 className="font-semibold text-white">{workout.gymName}</h3>
                            <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
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
                            >
                                <Edit2 className="size-4" />
                            </Link>
                            <ChevronRight className="size-5 text-[var(--muted-foreground)]" />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
