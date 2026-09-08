import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { canAccess } from '@/lib/access-control';

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
  const { isAuthenticated, isBootstrapped, user, loadProfile } = useAuthStore();
  const location = useLocation();
  useEffect(() => {
    if (!isBootstrapped) void loadProfile();
  }, [isBootstrapped, loadProfile]);

  if (!isBootstrapped) {
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

  if (
    !canAccess(user, {
      requireAuth: true,
      requiredPermissions,
      requiredRoles,
    })
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
