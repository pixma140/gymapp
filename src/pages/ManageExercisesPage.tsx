import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { Exercise } from '@/db/db';
import { ArrowLeft, Trash2, Edit2, Save, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';

export function ManageExercisesPage() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const exercises = useLiveQuery(
        () => db.exercises
            .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
            .toArray(),
        [search]
    );

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editMuscleGroup, setEditMuscleGroup] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newMuscleGroup, setNewMuscleGroup] = useState('');

    const muscleGroups = [
        { id: 'chest', label: t('addExercise.muscle.chest') },
        { id: 'back', label: t('addExercise.muscle.back') },
        { id: 'legs', label: t('addExercise.muscle.legs') },
        { id: 'shoulders', label: t('addExercise.muscle.shoulders') },
        { id: 'arms', label: t('addExercise.muscle.arms') },
        { id: 'core', label: t('addExercise.muscle.core') },
        { id: 'cardio', label: t('addExercise.muscle.cardio') },
        { id: 'fullBody', label: t('addExercise.muscle.fullBody') },
    ];

    const startEdit = (ex: Exercise) => {
        setEditingId(ex.id);
        setEditName(ex.name);
        setEditMuscleGroup(ex.muscleGroup || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditMuscleGroup('');
    };

    const saveEdit = async () => {
        if (editingId && editName.trim()) {
            await db.exercises.update(editingId, {
                name: editName.trim(),
                muscleGroup: editMuscleGroup.trim() || undefined
            });
            cancelEdit();
        }
    };

    const deleteExercise = async (id: number) => {
        if (confirm(t('manageExercises.deleteConfirm'))) {
            await db.exercises.delete(id);
        }
    };

    const addExercise = async () => {
        if (!newName.trim()) return;
        await db.exercises.add({
            name: newName.trim(),
            muscleGroup: newMuscleGroup.trim() || undefined
        });
        setNewName('');
        setNewMuscleGroup('');
        setIsAdding(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            <header className="flex items-center gap-4">
                <button onClick={() => navigate('/settings')} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <ArrowLeft className="size-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{t('manageExercises.title')}</h1>
                </div>
                <button onClick={() => setIsAdding(!isAdding)} className="bg-blue-600 p-2 rounded-lg text-white">
                    <Plus className="size-5" />
                </button>
            </header>

            <input
                type="text"
                placeholder={t('manageExercises.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
            />

            {isAdding && (
                <div className="bg-[var(--card)] border border-[var(--primary)]/50 rounded-xl p-4 flex items-start gap-2 animate-in slide-in-from-top-2">
                    <div className="flex-1 space-y-3">
                        <input
                            autoFocus
                            placeholder={t('manageExercises.newPlaceholder')}
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                        />
                        <div>
                            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                                {t('addExercise.muscleGroupLabel')} <span className="text-[var(--muted-foreground)] font-normal normal-case">({t('common.optional')})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {muscleGroups.map(mg => (
                                    <button
                                        key={mg.id}
                                        type="button"
                                        onClick={() => setNewMuscleGroup(mg.label === newMuscleGroup ? '' : mg.label)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newMuscleGroup === mg.label
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                                            }`}
                                    >
                                        {mg.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={addExercise} className="p-2 bg-blue-600 text-white rounded-lg"><Save className="size-4" /></button>
                </div>
            )}

            <div className="space-y-2">
                {exercises?.map(ex => (
                    <div key={ex.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                        {editingId === ex.id ? (
                            <div className="flex-1 flex items-start gap-2">
                                <div className="flex-1 space-y-3">
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                                        placeholder={t('addExercise.namePlaceholder')}
                                    />
                                    <div>
                                        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                                            {t('addExercise.muscleGroupLabel')} <span className="text-[var(--muted-foreground)] font-normal normal-case">({t('common.optional')})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {muscleGroups.map(mg => (
                                                <button
                                                    key={mg.id}
                                                    type="button"
                                                    onClick={() => setEditMuscleGroup(mg.label === editMuscleGroup ? '' : mg.label)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editMuscleGroup === mg.label
                                                            ? 'bg-blue-600 border-blue-500 text-white'
                                                            : 'bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                                                        }`}
                                                >
                                                    {mg.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={saveEdit} className="p-2 bg-green-900/40 text-green-400 rounded-lg"><Save className="size-4" /></button>
                                    <button onClick={cancelEdit} className="p-2 bg-[var(--accent)] text-[var(--muted-foreground)] rounded-lg"><X className="size-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h3 className="font-bold text-[var(--foreground)]">{ex.name}</h3>
                                    <p className="text-xs text-[var(--muted-foreground)]">{ex.muscleGroup || t('manageExercises.general')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => startEdit(ex)} className="p-2 text-[var(--muted-foreground)] hover:text-[var(--primary)]"><Edit2 className="size-4" /></button>
                                    <button onClick={() => deleteExercise(ex.id)} className="p-2 text-[var(--muted-foreground)] hover:text-red-500"><Trash2 className="size-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
