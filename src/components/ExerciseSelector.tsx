import { useState } from 'react';
import { ExerciseList } from '@/components/ExerciseList';
import { AddExerciseForm } from '@/components/AddExerciseForm';

export function ExerciseSelector({ onSelect, onCancel }: { onSelect: (exerciseId: number) => void, onCancel: () => void }) {
    const [view, setView] = useState<'list' | 'add'>('list');

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-zinc-950 w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">

                {view === 'list' ? (
                    <>
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                            <h2 className="text-lg font-bold text-white">Select Exercise</h2>
                            <button onClick={onCancel} className="text-zinc-400 hover:text-white text-sm font-medium">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <ExerciseList
                                onSelect={onSelect}
                                onAdd={() => setView('add')}
                            />
                        </div>
                    </>
                ) : (
                    <div className="p-4 bg-zinc-900 h-full overflow-y-auto">
                        <AddExerciseForm
                            onCancel={() => setView('list')}
                            onComplete={() => setView('list')}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
