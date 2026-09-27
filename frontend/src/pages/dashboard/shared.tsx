import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { avatarColor, initialsOf } from './format';

/** Kartu dashboard standar (radius besar + border + shadow lembut). */
export function DashCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('bg-card border border-border rounded-card shadow-card p-5 sm:p-6 min-w-0', className)}>
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[15px] font-semibold tracking-[-0.3px] text-foreground">{children}</h3>
  );
}

export type ChipTone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

const CHIP_TONES: Record<ChipTone, string> = {
  success: 'text-success bg-success-bg',
  warning: 'text-warning bg-warning-bg',
  danger: 'text-danger bg-danger-bg',
  neutral: 'text-muted-foreground bg-secondary',
  primary: 'text-primary bg-accent',
};

export function StatusChip({
  tone,
  className,
  children,
}: {
  tone: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-semibold',
        CHIP_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function InitialAvatar({
  name,
  index = 0,
  size = 34,
  className,
}: {
  name?: string | null;
  index?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('flex items-center justify-center rounded-full font-semibold text-white shrink-0', className)}
      style={{
        width: size,
        height: size,
        background: avatarColor(index),
        fontSize: Math.max(9, Math.round(size * 0.3)),
      }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

export function EmptyHint({
  icon,
  title,
  note,
  action,
}: {
  icon?: ReactNode;
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <p className="text-xs font-medium text-foreground">{title}</p>
      {note && <p className="text-[11px] text-muted-foreground max-w-[280px]">{note}</p>}
      {action}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />;
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-card shadow-card p-5 sm:p-6', className)}>
      <SkeletonBlock className="h-4 w-1/3" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
