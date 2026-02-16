import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useState } from 'react';

export function ProgressChart() {
    const [exerciseId, setExerciseId] = useState<number | null>(null);

    const exercises = useLiveQuery(() => db.exercises.toArray());

    const data = useLiveQuery(async () => {
        if (!exerciseId) return [];

        // Get all sets for this exercise
        const sets = await db.workoutSets
            .where('exerciseId').equals(exerciseId)
            .filter(s => s.type === 'working')
            .sortBy('timestamp');

        // Aggregate by workout/date - simplified: just plotting all sets for now or max per day?
        // Let's plot Max Weight per date.

        const byDate = new Map<string, { date: string, maxWeight: number, totalVolume: number }>();

        sets.forEach(set => {
            const date = new Date(set.timestamp).toLocaleDateString();
            const current = byDate.get(date) || { date, maxWeight: 0, totalVolume: 0 };

            current.maxWeight = Math.max(current.maxWeight, set.weight);
            current.totalVolume += (set.weight * set.reps);
            byDate.set(date, current);
        });

        return Array.from(byDate.values());
    }, [exerciseId]);

    if (!exercises) return <div className="text-zinc-500">Loading charts...</div>;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {exercises.map(ex => (
                    <button
                        key={ex.id}
                        onClick={() => setExerciseId(ex.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${exerciseId === ex.id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                    >
                        {ex.name}
                    </button>
                ))}
            </div>

            {exerciseId ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-64 w-full">
                    {data && data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line type="monotone" dataKey="maxWeight" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                            No data for this exercise yet.
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                    Select an exercise to view progress.
                </div>
            )}
        </div>
    );
}
