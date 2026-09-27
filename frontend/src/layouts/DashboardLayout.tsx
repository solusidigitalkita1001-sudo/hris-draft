import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useUIStore } from '@/stores/ui.store';
import { useCompanyStore } from '@/stores/company.store';
import { cn } from '@/utils/cn';
import { Suspense, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { sidebarCollapsed } = useUIStore();
  // Class animasi DILEPAS setelah selesai: nilai transform yang tertahan
  // (walau identity) menjadikan elemen containing block dan mematahkan
  // position:fixed pada sidebar/bottom-nav/modal di dalamnya.
  const [entering, setEntering] = useState(true);
  // Remount all routed content when the active company changes. This discards
  // every page's component state (lists, detail/modal ids, forms) and re-runs
  // its data fetches under the new tenant, so no company-A state — nor a slow
  // company-A response resolving into an unmounted instance — can survive a
  // switch. Single highest-leverage guard against mixed-tenant UI (#10).
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);

  return (
    <div
      className={cn('min-h-screen bg-background', entering && 'anim-shell-enter')}
      onAnimationEnd={(e) => {
        if (e.animationName === 'shell-enter') setEntering(false);
      }}
    >
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300 ease-[cubic-bezier(.22,.9,.3,1)]',
          // Sidebar "Melayang": lebar panel (246/78) + margin kiri 14px
          sidebarCollapsed ? 'lg:ml-[92px]' : 'lg:ml-[260px]'
        )}
      >
        <TopNavigation />
        <main className="min-w-0 p-4 pb-24 lg:p-7 lg:pb-7">
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
