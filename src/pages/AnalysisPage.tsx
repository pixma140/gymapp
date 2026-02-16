import { useState } from 'react';
import { WorkoutHistoryList } from '@/components/WorkoutHistoryList';
import { ProgressChart } from '@/components/ProgressChart';
import { BodyProgressChart } from '@/components/BodyProgressChart';
import { Tabs } from '@/components/Tabs';

export function AnalysisPage() {
    const [activeTab, setActiveTab] = useState('workout');

    const tabs = [
        { id: 'workout', label: 'Workout Analysis' },
        { id: 'body', label: 'Body Analysis' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-white">Analysis</h1>
                <p className="text-zinc-400 mt-1">Track your progress.</p>
            </header>

            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'workout' ? (
                <div className="space-y-8">
                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-white">Progress</h2>
                        <ProgressChart />
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-white">Recent Workouts</h2>
                        <WorkoutHistoryList />
                    </section>
                </div>
            ) : (
                <div className="space-y-8">
                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-white">Body Metrics</h2>
                        <p className="text-sm text-zinc-500">Track your weight and body fat over time.</p>
                        <BodyProgressChart />
                    </section>
                </div>
            )}
        </div>
    );
}
