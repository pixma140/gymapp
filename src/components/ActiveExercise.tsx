import { useState } from 'react';
import type { Exercise, WorkoutSet } from '@/db/db';
import { Trash2, Plus, History } from 'lucide-react';

export function ActiveExercise({ exercise, sets, onAddSet, onRemoveSet }: {
    exercise: Exercise,
    sets: WorkoutSet[],
    onAddSet: (type: 'warmup' | 'working', weight: number, reps: number) => void,
    onRemoveSet: (id: number) => void
}) {
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [type, setType] = useState<'warmup' | 'working'>('working');

    const handleAdd = () => {
        const w = parseFloat(weight);
        const r = parseInt(reps);
        if (!isNaN(w) && !isNaN(r)) {
            onAddSet(type, w, r);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-white">{exercise.name}</h3>
                    <p className="text-zinc-500 text-sm">{exercise.muscleGroup || 'General'}</p>
                </div>
                <button className="text-blue-400 text-sm flex items-center gap-1">
                    <History className="size-3" /> History
                </button>
            </div>

            {/* Sets Table */}
            <div className="space-y-2">
                {sets.map((set, idx) => (
                    <div key={set.id} className={`flex items-center justify-between p-2 rounded-lg ${set.type === 'warmup' ? 'bg-zinc-950/50 border border-dashed border-zinc-800' : 'bg-zinc-800/50'}`}>
                        <div className="flex gap-4 items-center">
                            <span className="text-zinc-500 text-xs font-mono w-4">{idx + 1}</span>
                            <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${set.type === 'warmup' ? 'text-orange-400 bg-orange-900/20' : 'text-green-400 bg-green-900/20'}`}>
                                {set.type === 'warmup' ? 'W' : 'WKG'}
                            </span>
                            <div className="text-zinc-200 font-medium">
                                {set.weight} <span className="text-zinc-500 text-xs">kg</span>
                                <span className="text-zinc-600 mx-2">×</span>
                                {set.reps} <span className="text-zinc-500 text-xs">reps</span>
                            </div>
                        </div>
                        <button onClick={() => onRemoveSet(set.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Input Row */}
            <div className="flex gap-2 items-end pt-2 border-t border-zinc-800">
                <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500">Weight</label>
                    <input
                        type="number"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center text-white font-mono"
                        placeholder="0"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500">Reps</label>
                    <input
                        type="number"
                        value={reps}
                        onChange={e => setReps(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center text-white font-mono"
                        placeholder="0"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <button
                        onClick={() => setType(type === 'working' ? 'warmup' : 'working')}
                        className={`p-2 rounded-lg text-xs font-bold uppercase border transition-colors ${type === 'warmup' ? 'border-orange-500/50 text-orange-400' : 'border-green-500/50 text-green-400'}`}
                    >
                        {type === 'warmup' ? 'Warmup' : 'Working'}
                    </button>
                </div>

                <button
                    onClick={handleAdd}
                    disabled={!weight || !reps}
                    className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 text-white p-3 rounded-lg flex items-center justify-center transition-all active:scale-95"
                >
                    <Plus className="size-5" />
                </button>
            </div>
        </div>
    );
}
