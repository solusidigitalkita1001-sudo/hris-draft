import dayjs from 'dayjs';
import { LogIn, LogOut, Timer } from 'lucide-react';
import type { DashboardSummary } from '@/services/reports.service';
import type { MyAttendanceToday } from '@/services/attendance.service';
import { DashCard, StatusChip, type ChipTone } from './shared';
import { formatDuration } from './format';

interface StatStripProps {
  summary: DashboardSummary;
  companyName?: string | null;
  labels: {
    totalEmployees: string;
    departments: string;
    presentToday: string;
    onLeave: string;
  };
}

/** Strip 4 statistik perusahaan (baris paling atas dashboard). */
export function StatStrip({ summary, companyName, labels }: StatStripProps) {
  const items: Array<{
    label: string;
    value: number;
    tag: string;
    tone: ChipTone;
    sub: string;
  }> = [
    {
      label: labels.totalEmployees,
      value: summary.stats.totalEmployees,
      tag: 'Aktif',
      tone: 'primary',
      sub: companyName || 'Semua unit',
    },
    {
      label: labels.departments,
      value: summary.stats.totalDepartments,
      tag: 'Struktur',
      tone: 'neutral',
      sub: 'Departemen aktif',
    },
    {
      label: labels.presentToday,
      value: summary.stats.presentToday,
      tag: 'Hari ini',
      tone: 'success',
      sub: dayjs().locale('id').format('D MMM YYYY'),
    },
    {
      label: labels.onLeave,
      value: summary.stats.onLeaveToday,
      tag: 'Cuti',
      tone: 'warning',
      sub: 'Disetujui, sedang berjalan',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
      {items.map((item) => (
        <DashCard key={item.label} className="rounded-[22px] p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-muted-foreground truncate">{item.label}</span>
            <StatusChip tone={item.tone} className="text-[10.5px] font-medium">{item.tag}</StatusChip>
          </div>
          <p className="mt-4 text-[30px] leading-none font-semibold tracking-[-1.4px] text-foreground">
            {item.value}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground truncate">{item.sub}</p>
        </DashCard>
      ))}
    </div>
  );
}

/** Fallback untuk karyawan biasa: ringkasan absensi pribadi hari ini (Masuk / Pulang / Jam Kerja). */
export function PersonalTodayCard({ today }: { today: MyAttendanceToday }) {
  const record = today.record;
  const schedule = today.context?.schedule;

  const checkIn = record?.checkIn ? dayjs(record.checkIn).format('HH.mm') : '—';
  const checkOut = record?.checkOut ? dayjs(record.checkOut).format('HH.mm') : '—';
  const duration =
    record?.workDuration != null
      ? formatDuration(record.workDuration)
      : record?.checkIn && !record.checkOut
        ? formatDuration(dayjs(today.serverTime).diff(dayjs(record.checkIn), 'minute'))
        : '—';

  const status: { label: string; tone: 'success' | 'warning' | 'neutral' } = record?.checkOut
    ? { label: 'Selesai', tone: 'success' }
    : record?.checkIn
      ? record.lateMinutes
        ? { label: `Telat ${record.lateMinutes}m`, tone: 'warning' }
        : { label: 'Sedang bekerja', tone: 'success' }
      : { label: 'Belum absen', tone: 'neutral' };

  const cells = [
    { icon: LogIn, label: 'Masuk', value: checkIn },
    { icon: LogOut, label: 'Pulang', value: checkOut },
    { icon: Timer, label: 'Jam Kerja', value: duration },
  ];

  return (
    <DashCard className="rounded-[22px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11.5px] text-muted-foreground">Absensi saya hari ini</span>
          {schedule?.workStart && schedule.workEnd && (
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              Jadwal {schedule.workStart}–{schedule.workEnd}
            </p>
          )}
        </div>
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-2xl bg-secondary px-3 py-3 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <cell.icon size={12} />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.8px]">{cell.label}</span>
            </div>
            <p className="mt-2 text-[22px] leading-none font-semibold tracking-[-0.8px] text-foreground truncate">
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
