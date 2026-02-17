import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseList } from '@/components/ExerciseList';
import { AddExerciseForm } from '@/components/AddExerciseForm';

export function ExerciseSelector({ onSelect, onCancel }: { onSelect: (exerciseId: number) => void, onCancel: () => void }) {
    const [view, setView] = useState<'list' | 'add'>('list');

    const content = (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-[var(--card)] w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">

                {view === 'list' ? (
                    <>
                        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)]/70">
                            <h2 className="text-lg font-bold text-[var(--foreground)]">Select Exercise</h2>
                            <button onClick={onCancel} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-medium">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <ExerciseList
                                onSelect={onSelect}
                                onAdd={() => setView('add')}
                            />
                        </div>
                    </>
                ) : (
                    <div className="p-4 bg-[var(--card)] h-full overflow-y-auto">
                        <AddExerciseForm
                            onCancel={() => setView('list')}
                            onComplete={() => setView('list')}
                        />
                    </div>
                )}
            </div>
            </div>
    );

    if (typeof document === 'undefined' || !document.body) {
        return content;
    }

    return createPortal(content, document.body);
}
