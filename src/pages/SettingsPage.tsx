import { useState } from 'react';
import { Database, Moon, Trash, Dumbbell, Earth, Bell, Palette, Github, LogOut, Shield } from 'lucide-react';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import type { Theme } from '@/context/ThemeContext';
import type { Language } from '@/i18n/translations';
import type { User } from '@/db/db';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { APP_COMMIT, APP_RELEASE_URL, APP_VERSION } from '@/lib/constants';
import { useSession } from '@/context/SessionContext';

export function SettingsPage() {
    const db = useDatabase();
    const user = useLiveQuery(() => db.users.orderBy('id').first());
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();
    const { theme, setTheme, mainColor, setColor } = useTheme();
    const { isAdmin, logout, discardLocalChanges } = useSession();
    const pendingCount = useLiveQuery(() => db.outbox.count(), [db]);
    const [discarding, setDiscarding] = useState(false);

    const colors = [
        { name: t('color.blue'), value: '#2563eb' },
        { name: t('color.green'), value: '#16a34a' },
        { name: t('color.red'), value: '#dc2626' },
        { name: t('color.orange'), value: '#ea580c' },
        { name: t('color.purple'), value: '#9333ea' },
        { name: t('color.pink'), value: '#db2777' },
        { name: t('color.cyan'), value: '#0891b2' },
        { name: t('color.yellow'), value: '#ca8a04' },
    ];

    const handleClearData = async () => {
        if (!confirm(t('sync.discardConfirm'))) return;
        setDiscarding(true);
        try { await discardLocalChanges(); } catch { /* Session error view offers a safe retry. */ }
        finally { setDiscarding(false); }
    };

    const handleFrequencyChange = async (freq: User['reminderFrequency']) => {
        if (!user) return;
        if (!freq) return;
        await applyOperation(db, 'profile.update', null, { reminderFrequency: freq });
    };

    const handleLogout = async () => {
        await logout();
        navigate('/auth', { replace: true });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pb-20 p-4 transition-colors duration-300">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{t('settings.title')}</h1>
                <p className="text-[var(--muted-foreground)] mt-1">{t('settings.subtitle')}</p>
            </header>

            <div className="space-y-4">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">

                    {/* Main Color Selector */}
                    <div className="w-full flex flex-col p-4 border-b border-[var(--border)] border-dashed gap-4">
                        <div className="flex items-center gap-3">
                            <Palette className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium text-[var(--foreground)]">{t('settings.accentColor')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.accentColor.desc')}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {colors.map((c) => (
                                <button
                                    key={c.value}
                                    onClick={() => setColor(c.value)}
                                    className={cn(
                                        "size-8 rounded-full transition-all hover:scale-110 active:scale-95 ring-2 ring-offset-2 ring-offset-[var(--background)]",
                                        mainColor === c.value ? "ring-[var(--foreground)] scale-110" : "ring-transparent opacity-80 hover:opacity-100"
                                    )}
                                    style={{ backgroundColor: c.value, boxShadow: mainColor === c.value ? `0 0 10px ${c.value}` : 'none' }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Theme Selector */}
                    <div className="w-full flex items-center justify-between p-4 border-b border-[var(--border)] border-dashed">
                        <div className="flex items-center gap-3">
                            <Moon className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium text-[var(--foreground)]">{t('settings.theme')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.theme.desc')}</p>
                            </div>
                        </div>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as Theme)}
                            className="bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs p-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        >
                            <option value="light">{t('theme.light')}</option>
                            <option value="dark">{t('theme.dark')}</option>
                            <option value="oled">{t('theme.oled')}</option>
                            <option value="system">{t('theme.system')}</option>
                        </select>
                    </div>

                    <div className="w-full flex items-center justify-between p-4 border-b border-[var(--border)] border-dashed">
                        <div className="flex items-center gap-3">
                            <Earth className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium text-[var(--foreground)]">{t('settings.language')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.language.desc')}</p>
                            </div>
                        </div>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs p-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        >
                            <option value="en">{t('language.english')}</option>
                            <option value="de">{t('language.german')}</option>
                        </select>
                    </div>

                    <div className="w-full flex items-center justify-between p-4 border-b border-[var(--border)] border-dashed">
                        <div className="flex items-center gap-3">
                            <Bell className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium text-[var(--foreground)]">{t('settings.reminders')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.reminders.desc')}</p>
                            </div>
                        </div>
                        <select
                            value={user?.reminderFrequency || 'never'}
                            onChange={(e) => handleFrequencyChange(e.target.value as User['reminderFrequency'])}
                            className="bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs p-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        >
                            <option value="never">{t('settings.reminders.never')}</option>
                            <option value="daily">{t('settings.reminders.daily')}</option>
                            <option value="weekly">{t('settings.reminders.weekly')}</option>
                            <option value="monthly">{t('settings.reminders.monthly')}</option>
                        </select>
                    </div>

                    {isAdmin && <Link to="/settings/gyms" className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] transition-colors border-b border-[var(--border)] border-dashed">
                        <div className="flex items-center gap-3">
                            <Dumbbell className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium text-[var(--foreground)]">{t('settings.manage_gyms')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.manage_gyms.desc')}</p>
                            </div>
                        </div>
                    </Link>}
                </div>

                {isAdmin && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                        <Link to="/admin" className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] transition-colors">
                            <div className="flex items-center gap-3">
                                <Shield className="size-5 text-[var(--muted-foreground)]" />
                                <div className="text-left">
                                    <h3 className="text-sm font-medium text-[var(--foreground)]">{t('admin.nav')}</h3>
                                    <p className="text-xs text-[var(--muted-foreground)]">{t('admin.nav.desc')}</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                )}

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                    <button
                        onClick={async () => {
                            const data = await db.transaction('r', db.tables, async () => ({
                                binding: db.binding,
                                pending: await db.outbox.toArray(),
                                users: await db.users.toArray(),
                                gyms: await db.gyms.toArray(),
                                workouts: await db.workouts.toArray(),
                                userMeasurements: await db.userMeasurements.toArray(),
                                syncMetadata: await db.syncMetadata.toArray(),
                                exportDate: new Date().toISOString(),
                                version: 1
                            }));

                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `gymapp-export-${new Date().toISOString().split('T')[0]}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }}
                        className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                    >
                        <div className="flex items-center gap-3">
                            <Database className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium">{t('settings.export')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.export.desc')}</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] transition-colors text-[var(--foreground)] border-t border-[var(--border)] border-dashed"
                    >
                        <div className="flex items-center gap-3">
                            <LogOut className="size-5 text-[var(--muted-foreground)]" />
                            <div className="text-left">
                                <h3 className="text-sm font-medium">{t('settings.logout')}</h3>
                                <p className="text-xs text-[var(--muted-foreground)]">{t('settings.logout.desc')}</p>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl overflow-hidden">
                    <button
                        onClick={handleClearData}
                        disabled={discarding || !pendingCount}
                        className="w-full flex items-center justify-between p-4 hover:bg-red-500/20 transition-colors text-red-500 disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <Trash className="size-5" />
                            <div className="text-left">
                                <h3 className="text-sm font-bold">{t('settings.reset')}</h3>
                                <p className="text-xs text-red-500/70">{t('settings.reset.desc')}</p>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="text-center text-xs text-[var(--muted-foreground)] pt-8">
                    <p className="font-mono">{t('settings.appVersion')} <Github className="size-3 inline-block mb-1" /> <a href="https://github.com/pixma140/gymapp" target="_blank" rel="noopener noreferrer">v{APP_VERSION}</a> - <a href={APP_RELEASE_URL} target="_blank" rel="noopener noreferrer">{APP_COMMIT}</a></p>
                    <p>{t('settings.madeBy')} <a href="https://pixma140.com" target="_blank" rel="noopener noreferrer">pixma140</a></p>
                </div>
            </div >
        </div >
    );
}
