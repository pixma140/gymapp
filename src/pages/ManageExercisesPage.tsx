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
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');

    const startEdit = (ex: Exercise) => {
        setEditingId(ex.id);
        setEditName(ex.name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEdit = async () => {
        if (editingId && editName.trim()) {
            await db.exercises.update(editingId, { name: editName });
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
        await db.exercises.add({ name: newName });
        setNewName('');
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
                <div className="bg-[var(--card)] border border-[var(--primary)]/50 rounded-xl p-4 flex gap-2 animate-in slide-in-from-top-2">
                    <input
                        autoFocus
                        placeholder={t('manageExercises.newPlaceholder')}
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                    />
                    <button onClick={addExercise} className="p-2 bg-blue-600 text-white rounded-lg"><Save className="size-4" /></button>
                </div>
            )}

            <div className="space-y-2">
                {exercises?.map(ex => (
                    <div key={ex.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                        {editingId === ex.id ? (
                            <div className="flex-1 flex gap-2">
                                <input
                                    autoFocus
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                                />
                                <button onClick={saveEdit} className="p-2 bg-green-900/40 text-green-400 rounded-lg"><Save className="size-4" /></button>
                                <button onClick={cancelEdit} className="p-2 bg-[var(--accent)] text-[var(--muted-foreground)] rounded-lg"><X className="size-4" /></button>
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
