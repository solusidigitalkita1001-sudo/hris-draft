import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import { Clock } from 'lucide-react';

interface MyTodaySlim {
  record: {
    checkIn?: string | null;
    checkOut?: string | null;
    branch?: { name?: string } | null;
  } | null;
  context?: {
    shift?: { startTime?: string | null; endTime?: string | null } | null;
    branch?: { name?: string } | null;
  } | null;
}

/**
 * Kartu status absen di dasar sidebar (handoff):
 * - expand  → kartu "Sudah absen hari ini / Masuk HH.mm · lokasi / progress"
 * - collapse → badge ikon jam + dot hijau + jam masuk
 * Gagal fetch / belum tertaut employee → kartu disembunyikan.
 */
export function SidebarAttendanceCard({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuthStore();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const [today, setToday] = useState<MyTodaySlim | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.employeeId || !activeCompanyId) {
      setToday(null);
      return;
    }
    api
      .get('/attendance/me/today')
      .then((r) => {
        if (!cancelled) setToday(r.data.data as MyTodaySlim);
      })
      .catch(() => {
        if (!cancelled) setToday(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.employeeId, activeCompanyId]);

  const checkIn = today?.record?.checkIn ? dayjs(today.record.checkIn) : null;
  if (!today) return null;

  const location = today.record?.branch?.name ?? today.context?.branch?.name;
  const workedMinutes = checkIn ? Math.max(0, dayjs().diff(checkIn, 'minute')) : 0;
  const workedLabel = `${Math.floor(workedMinutes / 60)}j ${String(workedMinutes % 60).padStart(2, '0')}m`;
  const shiftMinutes = (() => {
    const shift = today.context?.shift;
    if (!shift?.startTime || !shift?.endTime) return 8 * 60;
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    const total = eh * 60 + em - (sh * 60 + sm);
    return total > 0 ? total : 8 * 60;
  })();
  const progress = checkIn ? Math.min(100, Math.round((workedMinutes / shiftMinutes) * 100)) : 0;

  if (collapsed) {
    return (
      <div
        className="flex flex-none flex-col items-center gap-1.5 rounded-2xl border border-sidebar-border bg-sidebar-hover py-3"
        title={checkIn ? `Sudah absen · masuk ${checkIn.format('HH.mm')}` : 'Belum absen hari ini'}
      >
        <span className="relative flex h-[30px] w-[30px] items-center justify-center rounded-[11px] bg-accent">
          <Clock size={15} className="text-primary" aria-hidden="true" />
          <span
            className={`absolute -right-0.5 -top-0.5 h-[9px] w-[9px] rounded-full border-2 border-sidebar ${checkIn ? 'bg-[#4ADE80]' : 'bg-muted-foreground/40'}`}
          />
        </span>
        <span className="text-[9px] font-semibold tracking-[0.2px] text-sidebar-muted">
          {checkIn ? checkIn.format('HH.mm') : '--.--'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-none flex-col gap-2 rounded-[18px] border border-sidebar-border bg-sidebar-hover p-[15px]">
      <div className="flex items-center gap-2">
        <span className={`h-[7px] w-[7px] flex-none rounded-full ${checkIn ? 'bg-[#4ADE80]' : 'bg-muted-foreground/40'}`} />
        <span className="text-[10.5px] font-medium text-sidebar-foreground">
          {checkIn ? 'Sudah absen hari ini' : 'Belum absen hari ini'}
        </span>
      </div>
      {checkIn ? (
        <>
          <p className="text-[10px] leading-relaxed text-sidebar-muted">
            Masuk {checkIn.format('HH.mm')}
            {location ? ` · ${location}` : ''}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[9.5px] text-sidebar-muted">
            {workedLabel} dari {Math.floor(shiftMinutes / 60)}j shift
          </p>
        </>
      ) : (
        <p className="text-[10px] leading-relaxed text-sidebar-muted">Jangan lupa clock in begitu mulai bekerja.</p>
      )}
    </div>
  );
}
