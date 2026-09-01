import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/utils/cn';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[260px]'
        )}
      >
        <TopNavigation />
        <main className="min-w-0 p-4 lg:p-6">
          <Suspense fallback={
            <div className="flex min-h-[40vh] items-center justify-center gap-3" role="status" aria-live="polite">
              <Loader2 className="animate-spin text-primary" size={20} aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Memuat halaman…</span>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
