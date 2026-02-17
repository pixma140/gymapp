import { useState, useEffect, useRef } from 'react';
import { db } from '@/db/db';
import type { User } from '@/db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, User as UserIcon } from 'lucide-react';

export function ProfilePage() {
    const user = useLiveQuery(() => db.users.orderBy('id').first());
    const [formData, setFormData] = useState<Partial<User>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const clearMessageTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (user) {
            setFormData(user);
        } else {
            // Initialize default user if not exists
            setFormData({ name: 'Guest User' });
        }
    }, [user]);

    useEffect(() => {
        return () => {
            if (clearMessageTimeout.current) {
                window.clearTimeout(clearMessageTimeout.current);
            }
        };
    }, []);

    const handleChange = (field: keyof User, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveMessage(null);
        if (clearMessageTimeout.current) {
            window.clearTimeout(clearMessageTimeout.current);
        }
        try {
            if (user?.id) {
                await db.users.update(user.id, formData);
            } else {
                await db.users.add(formData as User);
            }
            setSaveMessage('Profile saved.');
            clearMessageTimeout.current = window.setTimeout(() => {
                setSaveMessage(null);
            }, 2500);
        } catch (err) {
            console.error("Failed to save profile", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Profile</h1>
                <p className="text-[var(--muted-foreground)] mt-1">Manage your stats.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Avatar / Name Section */}
                <div className="flex flex-col items-center p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
                    <div className="size-20 bg-[var(--accent)] rounded-full flex items-center justify-center mb-4 border-2 border-[var(--border)]">
                        <UserIcon className="size-10 text-[var(--muted-foreground)]" />
                    </div>

                    <div className="w-full">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 text-center">Display Name</label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={e => handleChange('name', e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-center text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                            placeholder="Your Name"
                        />
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Weight */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Weight <span className="text-[var(--muted-foreground)]">(kg)</span></label>
                        <input
                            type="number"
                            value={formData.weight || ''}
                            onChange={e => handleChange('weight', parseFloat(e.target.value))}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] font-mono text-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                            placeholder="0.0"
                            step="0.1"
                        />
                    </div>

                    {/* Body Fat */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Body Fat <span className="text-[var(--muted-foreground)]">(%)</span></label>
                        <input
                            type="number"
                            value={formData.bodyFat || ''}
                            onChange={e => handleChange('bodyFat', parseFloat(e.target.value))}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] font-mono text-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                            placeholder="0.0"
                            step="0.1"
                        />
                    </div>

                    {/* Height */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Height <span className="text-[var(--muted-foreground)]">(cm)</span></label>
                        <input
                            type="number"
                            value={formData.height || ''}
                            onChange={e => handleChange('height', parseFloat(e.target.value))}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] font-mono text-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                            placeholder="0"
                        />
                    </div>

                    {/* Age */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Age</label>
                        <input
                            type="number"
                            value={formData.age || ''}
                            onChange={e => handleChange('age', parseInt(e.target.value))}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] font-mono text-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                            placeholder="0"
                        />
                    </div>

                    {/* Gender */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Gender</label>
                        <select
                            value={formData.gender || 'other'}
                            onChange={e => handleChange('gender', e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-blue-600 disabled:opacity-50 hover:bg-blue-500 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                    {isSaving ? 'Saving...' : (
                        <>
                            <Save className="size-5" />
                            Save Profile
                        </>
                        )}
                </button>
                {saveMessage && (
                    <p className="text-sm text-emerald-400 text-center animate-in fade-in duration-300">
                        {saveMessage}
                    </p>
                )}
            </form>
        </div>
    );
}
