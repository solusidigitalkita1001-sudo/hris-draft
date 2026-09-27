import { useMemo } from 'react';
import dayjs from 'dayjs';
import { BarChart3 } from 'lucide-react';
import type { AttendanceReport } from '@/services/reports.service';
import type { AttendanceRecord } from '@/services/attendance.service';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey, TranslationParams } from '@/i18n/translations';
import { cn } from '@/utils/cn';
import { CardTitle, DashCard, EmptyHint } from './shared';

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const STATUS_META: Record<string, { label: TranslationKey; className: string }> = {
  PRESENT: { label: 'ops.dashboard.attendance.status.present', className: 'bg-success' },
  LATE: { label: 'ops.dashboard.attendance.status.late', className: 'bg-warning' },
  ABSENT: { label: 'ops.dashboard.attendance.status.absent', className: 'bg-danger' },
  EXCUSED: { label: 'ops.dashboard.attendance.status.excused', className: 'bg-muted-foreground/60' },
};

function statusMeta(status: string, t: Translate): { label: string; className: string } {
  const meta = STATUS_META[status];
  return meta
    ? { label: t(meta.label), className: meta.className }
    : { label: status, className: 'bg-muted-foreground/40' };
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
  const { t } = useI18n();
  if (report) return <CompanyComposition report={report} />;
  if (myRecords) return <PersonalHeatmap records={myRecords} />;
  return (
    <DashCard>
      <CardTitle>{t('ops.dashboard.attendance.title')}</CardTitle>
      <EmptyHint
        icon={<BarChart3 size={26} />}
        title={t('ops.dashboard.attendance.empty.title')}
        note={t('ops.dashboard.attendance.empty.note')}
      />
    </DashCard>
  );
}

function CompanyComposition({ report }: { report: AttendanceReport }) {
  const { t } = useI18n();
  const rows = report.byStatus.filter((s) => s.count > 0);
  const total = report.total || rows.reduce((sum, s) => sum + s.count, 0);

  return (
    <DashCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('ops.dashboard.attendance.title90')}</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">
          {t('ops.dashboard.attendance.summary90', { total, late: report.lateCount, rate: Math.round(report.lateRate) })}
        </span>
      </div>

      {total === 0 ? (
        <EmptyHint
          icon={<BarChart3 size={26} />}
          title={t('ops.dashboard.attendance.empty90')}
        />
      ) : (
        <>
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {rows.map((s) => (
              <span
                key={s.status}
                className={statusMeta(s.status, t).className}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${statusMeta(s.status, t).label}: ${s.count}`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {rows.map((s) => {
              const meta = statusMeta(s.status, t);
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
            {t('ops.dashboard.attendance.composition')}
          </p>
        </>
      )}
    </DashCard>
  );
}

const DAY_LABELS: TranslationKey[] = [
  'ops.dashboard.attendance.day.mon',
  'ops.dashboard.attendance.day.tue',
  'ops.dashboard.attendance.day.wed',
  'ops.dashboard.attendance.day.thu',
  'ops.dashboard.attendance.day.fri',
  'ops.dashboard.attendance.day.sat',
  'ops.dashboard.attendance.day.sun',
];

function PersonalHeatmap({ records }: { records: AttendanceRecord[] }) {
  const { t } = useI18n();
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
    if (status) className = statusMeta(status, t).className;
    else if (date.isAfter(today, 'day')) className = 'bg-muted/40';
    cells.push({
      key,
      className,
      title: `${date.format('D MMM')}${status ? ` · ${statusMeta(status, t).label}` : ''}`,
    });
  }

  const legend = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

  return (
    <DashCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('ops.dashboard.attendance.myTitle')}</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">{today.format('MMMM YYYY')}</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-center text-[9px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
            {t(d)}
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
            <span className={cn('h-2 w-2 rounded', statusMeta(status, t).className)} />
            {statusMeta(status, t).label}
          </span>
        ))}
      </div>
    </DashCard>
  );
}
