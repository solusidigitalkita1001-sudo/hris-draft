import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { DashCard, CardTitle } from './shared';

export interface QuickAction {
  label: string;
  note: string;
  icon: ReactNode;
  path: string;
}

/**
 * Kartu aksi cepat per persona (handoff: quick action tiles).
 * Tiap tile = ikon kotak tint + label + catatan + chevron.
 */
export function QuickActionsCard({
  title = 'Aksi cepat',
  actions,
  className,
  compact = false,
}: {
  title?: string;
  actions: QuickAction[];
  className?: string;
  /** Satu kolom — untuk kartu yang berbagi baris sempit agar label tidak terpotong. */
  compact?: boolean;
}) {
  const navigate = useNavigate();
  if (!actions.length) return null;

  return (
    <DashCard className={className}>
      <CardTitle>{title}</CardTitle>
      <div className={`mt-4 grid grid-cols-1 gap-2.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {actions.map((action) => (
          <button
            key={action.path}
            type="button"
            onClick={() => navigate(action.path)}
            className="group flex items-center gap-3 rounded-2xl bg-secondary px-3.5 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-card text-primary shadow-card">
              {action.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">{action.label}</span>
              <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">{action.note}</span>
            </span>
            <ChevronRight
              size={14}
              className="flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </DashCard>
  );
}
