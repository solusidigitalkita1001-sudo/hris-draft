import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-destructive mb-4">403</h1>
        <h2 className="text-xl font-semibold mb-2">Access denied</h2>
        <p className="text-muted-foreground mb-6">
          You do not have permission to access this page.
        </p>
        <Link to="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
