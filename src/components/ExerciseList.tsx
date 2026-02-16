import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Search, Plus, Dumbbell, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function ExerciseList({ onSelect, onAdd }: { onSelect: (exerciseId: number) => void, onAdd: () => void }) {
    const [search, setSearch] = useState('');
    const exercises = useLiveQuery(() => {
        let collection = db.exercises.orderBy('name');
        if (search) {
            // Simple case-insensitive client-side filtering since Dexie string filtering is limited
            return collection.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase())).toArray();
        }
        return collection.toArray();
    }, [search]);

    if (!exercises) return <div className="text-zinc-500 text-center py-8">Loading exercises...</div>;

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Search exercises..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
            </div>

            {exercises.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50">
                    <div className="size-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Dumbbell className="size-6 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">
                        {search ? 'No matches found' : 'No exercises yet'}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-6">
                        {search ? 'Try a different search term or add a new one.' : 'Add your favorite exercises to get started.'}
                    </p>
                    <button
                        onClick={onAdd}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="size-4" />
                        Add "{search || 'New Exercise'}"
                    </button>
                </div>
            ) : (
                <div className="grid gap-2">
                    {exercises.map(exercise => (
                        <button
                            key={exercise.id}
                            onClick={() => onSelect(exercise.id)}
                            className="group flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-blue-500/50 hover:bg-zinc-800/80 transition-all text-left active:scale-[0.98]"
                        >
                            <div>
                                <h3 className="font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">{exercise.name}</h3>
                                {exercise.muscleGroup && (
                                    <span className="text-xs text-zinc-500 px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-900 mt-1 inline-block">
                                        {exercise.muscleGroup}
                                    </span>
                                )}
                            </div>
                            <ChevronRight className="size-5 text-zinc-600 group-hover:text-blue-500/50 transition-colors" />
                        </button>
                    ))}

                    <button
                        onClick={onAdd}
                        className="w-full py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all flex items-center justify-center gap-2 text-sm font-medium mt-2"
                    >
                        <Plus className="size-4" />
                        Can't find it? Add New
                    </button>
                </div>
            )}
        </div>
    );
}
