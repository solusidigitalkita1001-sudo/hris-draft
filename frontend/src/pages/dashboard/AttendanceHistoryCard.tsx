import { useMemo } from 'react';
import dayjs from 'dayjs';
import { BarChart3 } from 'lucide-react';
import type { AttendanceReport } from '@/services/reports.service';
import type { AttendanceRecord } from '@/services/attendance.service';
import { cn } from '@/utils/cn';
import { CardTitle, DashCard, EmptyHint } from './shared';

const STATUS_META: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Hadir', className: 'bg-success' },
  LATE: { label: 'Telat', className: 'bg-warning' },
  ABSENT: { label: 'Absen', className: 'bg-danger' },
  EXCUSED: { label: 'Izin', className: 'bg-muted-foreground/60' },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, className: 'bg-muted-foreground/40' };
}

/**
 * Kartu riwayat kehadiran.
 * - Operasional: ringkasan 90 hari dari laporan agregat (byStatus) — data harian
 *   tidak tersedia di endpoint laporan, jadi dirender sebagai bar komposisi, bukan heatmap karangan.
 * - Karyawan: heatmap pribadi bulan berjalan dari catatan absensi sendiri.
 */
export function AttendanceHistoryCard({
  report,
  myRecords,
}: {
  report: AttendanceReport | null;
  myRecords: AttendanceRecord[] | null;
}) {
  if (report) return <CompanyComposition report={report} />;
  if (myRecords) return <PersonalHeatmap records={myRecords} />;
  return (
    <DashCard>
      <CardTitle>Kehadiran</CardTitle>
      <EmptyHint
        icon={<BarChart3 size={26} />}
        title="Data kehadiran belum tersedia"
        note="Ringkasan kehadiran akan muncul di sini setelah ada catatan absensi."
      />
    </DashCard>
  );
}

function CompanyComposition({ report }: { report: AttendanceReport }) {
  const rows = report.byStatus.filter((s) => s.count > 0);
  const total = report.total || rows.reduce((sum, s) => sum + s.count, 0);

  return (
    <DashCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Kehadiran 90 hari</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">
          {total} catatan · telat {report.lateCount} ({Math.round(report.lateRate)}%)
        </span>
      </div>

      {total === 0 ? (
        <EmptyHint
          icon={<BarChart3 size={26} />}
          title="Belum ada catatan absensi pada 90 hari terakhir"
        />
      ) : (
        <>
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {rows.map((s) => (
              <span
                key={s.status}
                className={statusMeta(s.status).className}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${statusMeta(s.status).label}: ${s.count}`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {rows.map((s) => {
              const meta = statusMeta(s.status);
              const pct = Math.round((s.count / total) * 100);
              return (
                <div key={s.status} className="flex items-center gap-2.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded', meta.className)} />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground">{pct}%</span>
                  <span className="w-10 text-right text-[11.5px] font-semibold text-foreground">{s.count}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Komposisi status absensi seluruh karyawan dalam 90 hari terakhir.
          </p>
        </>
      )}
    </DashCard>
  );
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function PersonalHeatmap({ records }: { records: AttendanceRecord[] }) {
  const today = dayjs();
  const monthStart = today.startOf('month');
  const daysInMonth = today.daysInMonth();

  const byDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) {
      map.set(dayjs(r.date).format('YYYY-MM-DD'), r.status);
    }
    return map;
  }, [records]);

  // Offset agar kolom pertama = Senin (dayjs: 0 = Minggu)
  const leadingBlanks = (monthStart.day() + 6) % 7;

  const cells: Array<{ key: string; className: string; title?: string } | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = monthStart.date(d);
    const key = date.format('YYYY-MM-DD');
    const status = byDate.get(key);
    let className = 'bg-muted';
    if (status) className = statusMeta(status).className;
    else if (date.isAfter(today, 'day')) className = 'bg-muted/40';
    cells.push({
      key,
      className,
      title: `${date.locale('id').format('D MMM')}${status ? ` · ${statusMeta(status).label}` : ''}`,
    });
  }

  const legend = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

  return (
    <DashCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Kehadiran Saya</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">{today.locale('id').format('MMMM YYYY')}</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-center text-[9px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((cell, i) =>
          cell ? (
            <div key={cell.key} title={cell.title} className={cn('aspect-square rounded-md', cell.className)} />
          ) : (
            <div key={`blank-${i}`} />
          )
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        {legend.map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded', statusMeta(status).className)} />
            {statusMeta(status).label}
          </span>
        ))}
      </div>
    </DashCard>
  );
}
