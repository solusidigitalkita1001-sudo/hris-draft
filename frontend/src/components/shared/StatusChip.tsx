import type { ReactNode } from 'react';
import type { TranslationKey } from '@/i18n/translations';

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

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  PENDING: 'adm.status.pending',
  APPROVED: 'adm.status.approved',
  REJECTED: 'adm.status.rejected',
  CANCELLED: 'adm.status.cancelled',
  ACTIVE: 'adm.status.active',
  INACTIVE: 'adm.status.inactive',
  SUSPENDED: 'adm.status.suspended',
  PAID: 'adm.status.paid',
  COMPLETED: 'adm.status.completed',
  OVERDUE: 'adm.status.overdue',
  SKIPPED: 'adm.status.skipped',
};

/**
 * Label status terjemahan via kunci `adm.status.*`. Pemanggil meneruskan `t`
 * dari `useI18n()`; status tanpa kunci dikembalikan apa adanya.
 */
// eslint-disable-next-line react-refresh/only-export-components -- helper label status sengaja co-located dengan chip
export function statusLabel(status: string, t: (key: TranslationKey) => string): string {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
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
