import type { ReactNode } from 'react';

/**
 * Kartu stat kecil radius 20 ala handoff (strip statistik di atas tabel).
 * `valueClassName` untuk warna semantik (text-success/warning/danger/primary).
 */
export function StatTile({
  label,
  value,
  note,
  valueClassName = 'text-foreground',
}: {
  label: string;
  value: ReactNode;
  note?: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className={`mt-2.5 text-2xl font-semibold leading-none tracking-[-1px] ${valueClassName}`}>
        {value}
      </p>
      {note && <p className="mt-2 truncate text-[10.5px] text-muted-foreground">{note}</p>}
    </div>
  );
}
