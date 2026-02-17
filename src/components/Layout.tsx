import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Dumbbell, LineChart, User, Settings, AlertCircle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMeasurementReminder } from '@/hooks/useMeasurementReminder';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useLanguage } from '@/i18n/LanguageContext';

export function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const showReminder = useMeasurementReminder();
    const activeWorkout = useActiveWorkout();
    const { t } = useLanguage();

    const navItems = [
        { path: '/', icon: Dumbbell, label: t('nav.training') },
        { path: '/analysis', icon: LineChart, label: t('nav.analysis') },
        { path: '/profile', icon: User, label: t('nav.profile'), alert: showReminder },
        { path: '/settings', icon: Settings, label: t('nav.settings') },
    ];

    const handleResumeWorkout = () => {
        if (activeWorkout) {
            navigate(`/workout/${activeWorkout.gymId}`);
        }
    };

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
        <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] font-sans transition-colors duration-300">
            <main className="flex-1 overflow-y-auto p-4 safe-area-top relative pb-20">
                {activeWorkout && !isOnWorkoutPage && (
                    <div
                        onClick={handleResumeWorkout}
                        className="mb-4 bg-green-500/10 border border-green-500/50 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-4 backdrop-blur-md cursor-pointer hover:bg-green-500/20 transition-colors shadow-lg shadow-green-900/10"
                    >
                        <div className="bg-green-500 rounded-full p-1.5 animate-pulse">
                            <Timer className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-green-100 truncate">Workout session active</h4>
                            <p className="text-xs text-green-200/70 truncate">
                                {activeWorkout.gymName || 'Unknown Gym'} • Tap to resume
                            </p>
                        </div>
                    </div>
                )}

                {showReminder && (
                    <div className="absolute top-4 left-4 right-4 z-10 bg-blue-500/10 border border-blue-500/50 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-4 backdrop-blur-md">
                        <AlertCircle className="size-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-blue-100">Time to update your stats!</h4>
                            <p className="text-xs text-blue-200/70 mt-0.5">It's been a while since your last measurement.</p>
                        </div>
                        <Link to="/profile" className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg">
                            Update
                        </Link>
                    </div>
                )}
                <Outlet />
            </main>
            <nav className="border-t border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-lg safe-area-bottom">
                <div className="flex justify-around items-center h-16">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <Link
                            key={path}
                            to={path}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors active:scale-95",
                                location.pathname === path
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            )}
                        >
                            <Icon className="size-6 mb-1" strokeWidth={2.5} />
                            {label}
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
