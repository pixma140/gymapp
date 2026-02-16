import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { MapPin, ChevronRight, Plus } from 'lucide-react';

export function GymList({ onSelect, onAdd }: { onSelect: (gymId: number) => void, onAdd: () => void }) {
    const gyms = useLiveQuery(() => db.gyms.orderBy('visitCount').reverse().toArray());

    if (!gyms) return <div className="text-zinc-500 text-center py-8">Loading gyms...</div>;

    return (
        <div className="space-y-4">
            {gyms.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50">
                    <div className="size-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="size-6 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">No gyms added</h3>
                    <p className="text-zinc-500 text-sm mb-6">Add your first gym to start tracking workouts.</p>
                    <button
                        onClick={onAdd}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="size-4" />
                        Add New Gym
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {gyms.map(gym => (
                        <button
                            key={gym.id}
                            onClick={() => onSelect(gym.id)}
                            className="group flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-blue-500/50 hover:bg-zinc-800/80 transition-all text-left active:scale-[0.98]"
                        >
                            <div className="flex-1 min-w-0 mr-4">
                                <h3 className="font-semibold text-lg text-zinc-100 truncate group-hover:text-blue-400 transition-colors">{gym.name}</h3>
                                {gym.location && (
                                    <div className="flex items-center text-zinc-500 text-sm mt-1">
                                        <MapPin className="size-3.5 mr-1.5 shrink-0" />
                                        <span className="truncate">{gym.location}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-zinc-500 text-xs">Visits</span>
                                    <span className="text-zinc-300 font-mono font-medium">{gym.visitCount}</span>
                                </div>
                                <ChevronRight className="size-5 text-zinc-600 group-hover:text-blue-500/50 transition-colors" />
                            </div>
                        </button>
                    ))}

                    <button
                        onClick={onAdd}
                        className="w-full py-4 rounded-xl border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all flex items-center justify-center gap-2 text-sm font-medium mt-2"
                    >
                        <Plus className="size-4" />
                        Add Another Gym
                    </button>
                </div>
            )}
        </div>
    );
}
