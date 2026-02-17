import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GymList } from '@/components/GymList';
import { AddGymForm } from '@/components/AddGymForm';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';

export function TrainingPage() {
    const [view, setView] = useState<'list' | 'add'>('list');
    const navigate = useNavigate();
    const activeWorkout = useActiveWorkout();

    const handleGymSelect = (gymId: number) => {
        if (activeWorkout) {
            if (activeWorkout.gymId === gymId) {
                navigate(`/workout/${gymId}`);
            } else {
                // Prevent starting new workout if one exists
                if (window.confirm(`You have an active workout at ${activeWorkout.gymName || 'another gym'}. You must finish it before starting a new one. Go to active workout?`)) {
                    navigate(`/workout/${activeWorkout.gymId}`);
                }
            }
        } else {
            navigate(`/workout/${gymId}`);
        }
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
