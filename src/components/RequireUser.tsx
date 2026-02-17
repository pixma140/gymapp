import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Navigate, Outlet } from 'react-router-dom';

export function RequireUser() {
    const userCount = useLiveQuery(() => db.users.count());

    // Wait for query to resolve
    if (userCount === undefined) {
        return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;
    }

    if (userCount === 0) {
        return <Navigate to="/onboarding" replace />;
    }

    return <Outlet />;
}
