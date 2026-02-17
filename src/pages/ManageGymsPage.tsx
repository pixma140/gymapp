import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { Gym } from '@/db/db';
import { ArrowLeft, Trash2, Edit2, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ManageGymsPage() {
    const navigate = useNavigate();
    const gyms = useLiveQuery(() => db.gyms.toArray());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const startEdit = (gym: Gym) => {
        setEditingId(gym.id);
        setEditName(gym.name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEdit = async () => {
        if (editingId && editName.trim()) {
            await db.gyms.update(editingId, { name: editName });
            cancelEdit();
        }
    };

    const deleteGym = async (id: number) => {
        if (confirm("Delete this gym? This will NOT delete workout history associated with it, but functionality might be affected.")) {
            await db.gyms.delete(id);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            <header className="flex items-center gap-4">
                <button onClick={() => navigate('/settings')} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <ArrowLeft className="size-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Manage Gyms</h1>
                </div>
            </header>

            <div className="space-y-3">
                {gyms?.map(gym => (
                    <div key={gym.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                        {editingId === gym.id ? (
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
                                    <h3 className="font-bold text-[var(--foreground)]">{gym.name}</h3>
                                    <p className="text-xs text-[var(--muted-foreground)]">{gym.location || 'No location'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => startEdit(gym)} className="p-2 text-[var(--muted-foreground)] hover:text-[var(--primary)]"><Edit2 className="size-4" /></button>
                                    <button onClick={() => deleteGym(gym.id)} className="p-2 text-[var(--muted-foreground)] hover:text-red-500"><Trash2 className="size-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {gyms?.length === 0 && <p className="text-[var(--muted-foreground)] text-center py-8">No gyms added yet.</p>}
            </div>
        </div>
    );
}
