import type { ReactNode } from 'react';

/**
 * Chip status semantik sesuai DESIGN.md:
 * Menunggu = warning, Disetujui/Aktif/Lunas = success, Ditolak = danger.
 */
export type ChipTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

const TONE_CLASSES: Record<ChipTone, string> = {
  success: 'text-success bg-success-bg',
  warning: 'text-warning bg-warning-bg',
  danger: 'text-danger bg-danger-bg',
  neutral: 'text-muted-foreground bg-secondary',
  accent: 'text-primary bg-accent',
};

const STATUS_TONES: Record<string, ChipTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  ACTIVE: 'success',
  PAID: 'success',
  COMPLETED: 'success',
  REJECTED: 'danger',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
  SKIPPED: 'neutral',
};

// eslint-disable-next-line react-refresh/only-export-components -- helper mapping status→tone sengaja co-located dengan chip
export function statusTone(status: string): ChipTone {
  return STATUS_TONES[status] ?? 'neutral';
}

export function StatusChip({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Chip filter pill (Semua / Menunggu / Disetujui / ...) ala handoff. */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-[15px] py-2 text-[11.5px] font-medium transition-colors ${
        active
          ? 'border-transparent bg-primary text-primary-foreground shadow-primary-btn'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
