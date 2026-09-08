import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Dumbbell, LineChart, User, Settings, AlertCircle, Timer } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { SyncStatus } from '@/components/SyncStatus';
import { cn } from '@/lib/utils';
import { useMeasurementReminder } from '@/hooks/useMeasurementReminder';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useLanguage } from '@/i18n/LanguageContext';

export function Layout() {
    const location = useLocation();
    const showReminder = useMeasurementReminder();
    const activeWorkout = useActiveWorkout();
    const { t } = useLanguage();
    const mainRef = useRef<HTMLElement>(null);

    // The <main> element is the scroll container and is reused across route
    // changes. Reset its scroll position on navigation so the new page's
    // content is visible from the top instead of staying scrolled where the
    // previous (e.g. long workout) page left it.
    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0, left: 0 });
    }, [location.pathname]);

    const navItems = [
        { path: '/', icon: Dumbbell, label: t('nav.training') },
        { path: '/analysis', icon: LineChart, label: t('nav.analysis') },
        { path: '/profile', icon: User, label: t('nav.profile'), alert: showReminder },
        { path: '/settings', icon: Settings, label: t('nav.settings') },
    ];

    // Check if we are on the workout page (by gymId) OR editing the active workout (by workoutId)
    // Route for workout page is /workout/:gymId
    // Route for edit/view is /workout/:workoutId/(edit|view)
    // Since we can't easily parse params here without matching route, we can do a heuristic
    const isWorkoutGymPage = activeWorkout && location.pathname === `/workout/${activeWorkout.gymId}`;
    const isWorkoutEditViewPage = activeWorkout && (
        location.pathname === `/workout/${activeWorkout.id}/edit` ||
        location.pathname === `/workout/${activeWorkout.id}/view`
    );

    const isOnWorkoutPage = isWorkoutGymPage || isWorkoutEditViewPage;

    return (
        <div className="flex flex-col h-dvh bg-[var(--background)] text-[var(--foreground)] font-sans transition-colors duration-300">
            <main ref={mainRef} className="flex-1 overflow-y-auto p-4 safe-area-top relative pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {activeWorkout && !isOnWorkoutPage && (
                    <Link
                        to={`/workout/${activeWorkout.gymId}`}
                        className="mb-4 bg-green-500/10 border border-green-500/50 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-4 backdrop-blur-md cursor-pointer hover:bg-green-500/20 transition-colors shadow-lg shadow-green-900/10"
                    >
                        <div className="bg-green-500 rounded-full p-1.5 animate-pulse">
                            <Timer className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-green-100 truncate">{t('layout.workoutActiveTitle')}</h4>
                            <p className="text-xs text-green-200/70 truncate">
                                {activeWorkout.gymName || t('common.unknownGym')} • {t('layout.tapToResume')}
                            </p>
                        </div>
                    </Link>
                )}

                {showReminder && (
                    <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-10 bg-blue-500/10 border border-blue-500/50 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-4 backdrop-blur-md">
                        <AlertCircle className="size-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-blue-100">{t('reminder.title')}</h4>
                            <p className="text-xs text-blue-200/70 mt-0.5">{t('reminder.subtitle')}</p>
                        </div>
                        <Link
                            to="/profile"
                            className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg"
                        >
                            {t('reminder.action')}
                        </Link>
                    </div>
                )}
                <SyncStatus />
                <Outlet />
            </main>
            <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
                <div className="flex justify-around items-center h-16">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <NavLink
                            key={path}
                            to={path}
                            end={path === '/'}
                            className={({ isActive }) => cn(
                                "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors active:scale-95",
                                isActive
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            )}
                        >
                            <Icon className="size-6 mb-1" strokeWidth={2.5} />
                            {label}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
