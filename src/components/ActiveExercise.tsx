import { useState } from 'react';
import type { Exercise, WorkoutSet } from '@/db/db';
import { Trash2, Plus, History } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function ActiveExercise({ exercise, sets, onAddSet, onRemoveSet }: {
    exercise: Exercise,
    sets: WorkoutSet[],
    onAddSet: (type: 'warmup' | 'working', weight: number, reps: number) => void,
    onRemoveSet: (id: number) => void
}) {
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [type, setType] = useState<'warmup' | 'working'>('working');
    const { t } = useLanguage();

    const handleAdd = () => {
        const w = weight.trim() === '' ? 0 : parseFloat(weight);
        const r = parseInt(reps);
        if (!isNaN(w) && !isNaN(r) && r > 0) {
            onAddSet(type, w, r);
        }
    };

    return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-[var(--foreground)]">{exercise.name}</h3>
                    <p className="text-[var(--muted-foreground)] text-sm">{exercise.muscleGroup || t('manageExercises.general')}</p>
                </div>
                <button className="text-[var(--primary)] text-sm flex items-center gap-1">
                    <History className="size-3" /> {t('exercise.history')}
                </button>
            </div>

            {/* Sets Table */}
            <div className="space-y-2">
                {sets.map((set, idx) => (
                    <div key={set.id} className={`flex items-center justify-between p-2 rounded-lg ${set.type === 'warmup' ? 'bg-[var(--background)] border border-dashed border-[var(--border)]' : 'bg-[var(--card)]'}`}>
                        <div className="flex gap-4 items-center">
                            <span className={`text-xs font-mono w-6 text-center py-0.5 rounded font-bold ${set.type === 'warmup' ? 'text-orange-400 bg-orange-900/20' : 'text-green-400 bg-green-900/20'}`}>
                                {set.type === 'warmup' ? 'W' : idx + 1}
                            </span>
                            <div className="text-[var(--foreground)] font-medium">
                                {set.weight} <span className="text-[var(--muted-foreground)] text-xs">{t('common.unit.kg')}</span>
                                <span className="text-[var(--muted-foreground)] mx-2">×</span>
                                {set.reps} <span className="text-[var(--muted-foreground)] text-xs">{t('common.unit.reps')}</span>
                            </div>
                        </div>
                        <button onClick={() => onRemoveSet(set.id)} className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors">
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Input Row */}
            <div className="flex gap-2 items-end pt-2 border-t border-[var(--border)]">
                <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">{t('exercise.weight')}</label>
                    <input
                        type="number"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className="w-full h-11 bg-[var(--input)] border border-[var(--border)] rounded-lg p-2 text-center text-[var(--foreground)] font-mono"
                        placeholder="0"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">{t('exercise.reps')}</label>
                    <input
                        type="number"
                        value={reps}
                        onChange={e => setReps(e.target.value)}
                        className="w-full h-11 bg-[var(--input)] border border-[var(--border)] rounded-lg p-2 text-center text-[var(--foreground)] font-mono"
                        placeholder="0"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <button
                        onClick={() => setType(type === 'working' ? 'warmup' : 'working')}
                        className={`h-11 w-20 rounded-lg text-[10px] font-bold uppercase border transition-colors ${type === 'warmup' ? 'border-orange-500/50 text-orange-400' : 'border-green-500/50 text-green-400'}`}
                    >
                        {type === 'warmup' ? t('exercise.type.warmup') : t('exercise.type.working')}
                    </button>
                </div>

                <button
                    onClick={handleAdd}
                    disabled={!reps || Number(reps) <= 0}
                    className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 text-white h-11 w-11 rounded-lg flex items-center justify-center transition-all active:scale-95"
                >
                    <Plus className="size-5" />
                </button>
            </div>
        </div>
    );
}
