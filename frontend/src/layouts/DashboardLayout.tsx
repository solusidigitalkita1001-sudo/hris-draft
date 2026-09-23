import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useUIStore } from '@/stores/ui.store';
import { useCompanyStore } from '@/stores/company.store';
import { cn } from '@/utils/cn';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { sidebarCollapsed } = useUIStore();
  // Remount all routed content when the active company changes. This discards
  // every page's component state (lists, detail/modal ids, forms) and re-runs
  // its data fetches under the new tenant, so no company-A state — nor a slow
  // company-A response resolving into an unmounted instance — can survive a
  // switch. Single highest-leverage guard against mixed-tenant UI (#10).
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);

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
            <div key={activeCompanyId ?? 'no-company'}>
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
