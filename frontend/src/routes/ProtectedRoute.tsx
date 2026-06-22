import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Array<{ resource: string; action: string }>;
  requiredRoles?: string[];
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requiredRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, loadProfile } = useAuthStore();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated && localStorage.getItem('hrms_access_token')) {
        await loadProfile();
      }
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permissions
  if (requiredPermissions && user) {
    const hasAllPermissions = requiredPermissions.every(({ resource, action }) => {
      if (user.roles.includes('SUPER_ADMIN')) return true;
      const required = `${resource}:${action}`;
      return user.permissions.includes(required) || user.permissions.includes(`${resource}:*`);
    });

    if (!hasAllPermissions) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check roles
  if (requiredRoles && user) {
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
