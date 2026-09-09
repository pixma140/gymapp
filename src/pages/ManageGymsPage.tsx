import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import type { Gym } from '@/db/db';
import { Trash2, Edit2, Save, X, Plus, MapPin } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function ManageGymsPage() {
    const db = useDatabase();
    const { t } = useLanguage();
    const gyms = useLiveQuery(() => db.gyms.filter(gym => !gym.archived).toArray());
    const [failed, setFailed] = useState(false);
    const perform = async (operation: () => Promise<unknown>) => {
        setFailed(false);
        try { await operation(); } catch { setFailed(true); }
    };
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLocation, setNewLocation] = useState('');

    const startEdit = (gym: Gym) => {
        setEditingId(gym.id);
        setEditName(gym.name);
        setEditLocation(gym.location || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditLocation('');
    };

    const saveEdit = async () => {
        if (editingId && editName.trim()) {
            await applyOperation(db, 'gym.update', editingId, {
                name: editName.trim(),
                location: editLocation.trim()
            });
            cancelEdit();
        }
    };

    const deleteGym = async (id: string) => {
        if (confirm(t('gyms.archiveConfirm'))) {
            await applyOperation(db, 'gym.archive', id, { archived: true });
        }
    };

    const addGym = async () => {
        if (!newName.trim()) return;

        await applyOperation(db, 'gym.create', null, {
            name: newName.trim(),
            location: newLocation.trim()
        });
        setNewName('');
        setNewLocation('');
        setIsAdding(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            {failed && <p role="alert">{t('sync.operationFailed')}</p>}
            <header className="flex items-center gap-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{t('manageGyms.title')}</h1>
                </div>
                <button aria-label={t('gyms.addNew')} onClick={() => setIsAdding(!isAdding)} className="bg-blue-600 p-2 rounded-lg text-white">
                    <Plus className="size-5" />
                </button>
            </header>

            <div className="space-y-3">
                {isAdding && (
                    <div className="bg-[var(--card)] border border-[var(--primary)]/50 rounded-xl p-4 flex items-start gap-2 animate-in slide-in-from-top-2">
                        <div className="flex-1 space-y-2">
                            <input
                                autoFocus
                                placeholder={t('addGym.namePlaceholder')}
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                            />
                            <div className="relative">
                                <input
                                    placeholder={t('addGym.locationPlaceholder')}
                                    value={newLocation}
                                    onChange={e => setNewLocation(e.target.value)}
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 pl-9 text-[var(--foreground)]"
                                />
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                            </div>
                        </div>
                        <button aria-label={t('common.save')} onClick={() => void perform(addGym)} className="p-2 bg-blue-600 text-white rounded-lg"><Save className="size-4" /></button>
                    </div>
                )}
                {gyms?.map(gym => (
                    <div key={gym.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
                        {editingId === gym.id ? (
                            <div className="flex-1 flex items-start gap-2">
                                <div className="flex-1 space-y-2">
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                                        placeholder={t('addGym.namePlaceholder')}
                                    />
                                    <input
                                        value={editLocation}
                                        onChange={e => setEditLocation(e.target.value)}
                                        className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)]"
                                        placeholder={t('addGym.locationPlaceholder')}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button aria-label={t('common.save')} onClick={() => void perform(saveEdit)} className="p-2 bg-green-900/40 text-green-400 rounded-lg"><Save className="size-4" /></button>
                                    <button aria-label={t('common.cancel')} onClick={cancelEdit} className="p-2 bg-[var(--accent)] text-[var(--muted-foreground)] rounded-lg"><X className="size-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h3 className="font-bold text-[var(--foreground)]">{gym.name}</h3>
                                    <p className="text-xs text-[var(--muted-foreground)]">{gym.location || t('manageGyms.noLocation')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button aria-label={t('common.edit')} onClick={() => startEdit(gym)} className="p-2 text-[var(--muted-foreground)] hover:text-[var(--primary)]"><Edit2 className="size-4" /></button>
                                    <button aria-label={t('gyms.archive')} onClick={() => void perform(() => deleteGym(gym.id))} className="p-2 text-[var(--muted-foreground)] hover:text-red-500"><Trash2 className="size-4" /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {gyms?.length === 0 && <p className="text-[var(--muted-foreground)] text-center py-8">{t('manageGyms.empty')}</p>}
            </div>
        </div>
    );
}
