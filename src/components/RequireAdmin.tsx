import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/context/SessionContext';
export function RequireAdmin() {
    const { isAdmin } = useSession();
    return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}
