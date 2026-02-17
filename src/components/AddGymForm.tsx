import { useState } from 'react';
import { db } from '@/db/db';
import { MapPin, Save, X } from 'lucide-react';

export function AddGymForm({ onCancel, onComplete }: { onCancel: () => void, onComplete: () => void }) {
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await db.gyms.add({
                name: name.trim(),
                location: location.trim(),
                lastVisited: Date.now(),
                visitCount: 0
            });
            onComplete();
        } catch (err) {
            console.error("Failed to add gym", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-5 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[var(--foreground)]">Add New Gym</h3>
                <button type="button" onClick={onCancel} className="p-2 -mr-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-full hover:bg-[var(--accent)] transition-colors">
                    <X className="size-5" />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Gym Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                        placeholder="e.g. Gold's Gym"
                        autoFocus
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Location <span className="text-[var(--muted-foreground)] font-normal normal-case">(Optional)</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 pl-10 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                            placeholder="e.g. Venice Beach"
                        />
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                    </div>
                </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium transition-colors">Cancel</button>
                <button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                >
                    {isSubmitting ? 'Saving...' : (
                        <>
                            <Save className="size-4" />
                            Save Gym
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
