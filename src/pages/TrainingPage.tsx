import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GymList } from '@/components/GymList';
import { AddGymForm } from '@/components/AddGymForm';

export function TrainingPage() {
    const [view, setView] = useState<'list' | 'add'>('list');
    const navigate = useNavigate();

    const handleGymSelect = (gymId: number) => {
        navigate(`/workout/${gymId}`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-white">Training</h1>
                <p className="text-zinc-400 mt-1">
                    {view === 'add' ? 'Add a new location' : 'Select a gym to start'}
                </p>
            </header>

            <div className="grid gap-4">
                {view === 'list' && (
                    <GymList
                        onSelect={handleGymSelect}
                        onAdd={() => setView('add')}
                    />
                )}

                {view === 'add' && (
                    <AddGymForm
                        onCancel={() => setView('list')}
                        onComplete={() => setView('list')}
                    />
                )}
            </div>
        </div>
    );
}
