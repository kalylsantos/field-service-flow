import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, userRole, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Case 1: Route requires roles, but user has none (or fetch failed)
    if (allowedRoles && !userRole) {
        // User is authenticated but has no role.
        // We should probably redirect them to a "waiting for approval" or "contact admin" page?
        // For now, redirect to auth to force re-login or show unauthorized.
        return <Navigate to="/auth" replace />;
    }

    // Case 2: User has a role, but it's not allowed for this route
    if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
        // Redirect to legitimate dashboard based on actual role
        if (userRole === 'admin') {
            return <Navigate to="/admin" replace />;
        } else if (userRole === 'technician') {
            return <Navigate to="/technician" replace />;
        } else {
            return <Navigate to="/" replace />;
        }
    }

    return <>{children}</>;
}
