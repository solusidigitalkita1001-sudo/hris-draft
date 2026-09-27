import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Modal standar redesign: kartu radius 26, animasi popIn ringan,
 * tutup via backdrop, tombol X, dan Escape. Aksesibilitas dasar:
 * role="dialog" + aria-modal.
 */
export function AppModal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,15,26,0.55)] p-4 backdrop-blur-[3px] animate-in fade-in-0 duration-150 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} max-h-[88vh] overflow-y-auto rounded-card border border-border bg-card p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] animate-in fade-in-0 zoom-in-95 duration-200`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.5px] text-foreground">{title}</h2>
            {description && (
              <p className="mt-1 text-[11.5px] text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
