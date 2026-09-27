import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import type { LeaveBalance } from '@/services/leave.service';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/utils/cn';
import { CardTitle, DashCard, EmptyHint } from './shared';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3; // px busur antar segmen
const DONUT_COLORS = ['hsl(var(--primary))', '#5D87B4', '#8FABC8', '#B3C6DA'];

interface Segment {
  id: string;
  label: string;
  remaining: number;
  used: number;
  total: number;
  year: number;
  color: string;
  dash: number;
  offset: number;
}

/** Kartu "Saldo Cuti" — donut SVG 132px interaktif + legend tappable. */
export function LeaveBalanceCard({ balances }: { balances: LeaveBalance[] }) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);

  const segments = useMemo<Segment[]>(() => {
    const rows = balances.filter((b) => b.totalDays > 0 || b.remainingDays > 0);
    const totalRemaining = rows.reduce((sum, b) => sum + Math.max(0, b.remainingDays), 0);
    let cursor = 0;
    return rows.map((b, i) => {
      const remaining = Math.max(0, b.remainingDays);
      const share = totalRemaining > 0 ? remaining / totalRemaining : 0;
      const arc = Math.max(share * CIRCUMFERENCE - (rows.length > 1 ? SEGMENT_GAP : 0), 0);
      const seg: Segment = {
        id: b.id,
        label: b.leaveType?.name || b.leaveType?.code || t('ops.dashboard.leave.typeFallback'),
        remaining,
        used: b.usedDays,
        total: b.totalDays,
        year: b.year,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
        dash: arc,
        offset: -cursor,
      };
      cursor += share * CIRCUMFERENCE;
      return seg;
    });
  }, [balances, t]);

  if (!segments.length) {
    return (
      <DashCard className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t('ops.dashboard.leave.title')}</CardTitle>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <EmptyHint
            icon={<CalendarDays size={26} />}
            title={t('ops.dashboard.leave.emptyTitle')}
            note={t('ops.dashboard.leave.emptyNote')}
            action={(
              <Button asChild size="sm" className="mt-1">
                <Link to="/self-service">{t('ops.dashboard.leave.apply')}</Link>
              </Button>
            )}
          />
        </div>
      </DashCard>
    );
  }

  const active = segments[Math.min(activeIndex, segments.length - 1)];
  const hasRemaining = segments.some((s) => s.remaining > 0);

  return (
    <DashCard className="flex-1 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t('ops.dashboard.leave.title')}</CardTitle>
        <Link to="/self-service" className="text-[11.5px] font-medium text-primary hover:underline whitespace-nowrap">
          {t('ops.dashboard.leave.apply')}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={RADIUS} fill="none" strokeWidth="15" className="stroke-muted" />
            {hasRemaining && segments.map((seg, i) => (
              seg.dash > 0 && (
                <circle
                  key={seg.id}
                  cx="66"
                  cy="66"
                  r={RADIUS}
                  fill="none"
                  stroke={seg.color}
                  strokeLinecap="round"
                  strokeWidth={i === activeIndex ? 15 : 10}
                  strokeDasharray={`${seg.dash} ${CIRCUMFERENCE - seg.dash}`}
                  strokeDashoffset={seg.offset}
                  opacity={i === activeIndex ? 1 : 0.85}
                  className="transition-all duration-300"
                />
              )
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] leading-none font-semibold tracking-[-1px] text-foreground">
              {active.remaining}
            </span>
            <span className="mt-1 max-w-[90px] truncate text-[10.5px] text-muted-foreground">
              {t('ops.dashboard.leave.daysRemaining')}
            </span>
          </div>
        </div>

        <div className="flex min-w-[150px] flex-1 basis-[150px] flex-col gap-1.5">
          {segments.map((seg, i) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors',
                i === activeIndex ? 'bg-secondary' : 'hover:bg-secondary/60'
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded" style={{ background: seg.color }} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{seg.label}</span>
              <span className="text-[11.5px] font-semibold text-foreground">{t('ops.dashboard.leave.daysShort', { count: seg.remaining })}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
        {t('ops.dashboard.leave.usageSummary', { label: active.label, used: active.used, total: active.total, year: active.year })}
      </p>
    </DashCard>
  );
}
