import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { HeadcountReport, TurnoverReport } from '@/services/reports.service';
import { DashCard, CardTitle, EmptyHint } from './shared';

/*
 * Chart analitik persona admin/HR.
 * Warna seri lewat token --chart-1/--chart-2 (tervalidasi per mode terhadap
 * permukaan kartu). Satu sumbu per chart; teks memakai token teks, bukan
 * warna seri; grid recessive; bar tipis dengan ujung radius 4.
 */
const SERIES_1 = 'var(--chart-1)';
const SERIES_2 = 'var(--chart-2)';
const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 10.5 } as const;
const GRID_STROKE = 'hsl(var(--border))';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-field border border-border bg-card px-3 py-2 shadow-float">
      <p className="text-[10.5px] font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Headcount per departemen — bar horizontal, satu seri, top 6 + Lainnya. */
function HeadcountByDeptChart({ headcount }: { headcount: HeadcountReport }) {
  const sorted = [...headcount.byDepartment].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, 6);
  const restCount = sorted.slice(6).reduce((sum, row) => sum + row.count, 0);
  const rows = [
    ...top.map((row) => ({ name: row.departmentName, jumlah: row.count })),
    ...(restCount > 0 ? [{ name: 'Lainnya', jumlah: restCount }] : []),
  ];

  if (!rows.length) {
    return <EmptyHint icon={<BarChart3 size={28} aria-hidden="true" />} title="Belum ada data departemen" />;
  }

  return (
    <div style={{ height: Math.max(180, rows.length * 38) }} aria-label="Grafik headcount per departemen">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 0 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} strokeDasharray="2 4" />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
          <Bar
            dataKey="jumlah"
            name="Karyawan"
            fill={SERIES_1}
            barSize={14}
            radius={[0, 4, 4, 0]}
            label={{ position: 'right', fill: 'hsl(var(--foreground))', fontSize: 10.5, fontWeight: 600 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rekrutmen vs resign per bulan — dua seri, legend wajib. */
function HiringTrendChart({ turnover }: { turnover: TurnoverReport }) {
  const rows = turnover.monthly.map((row) => ({
    name: dayjs(`${row.year}-${String(row.month).padStart(2, '0')}-01`).locale('id').format('MMM'),
    Masuk: row.hires,
    Keluar: row.resigns,
  }));

  if (!rows.length) {
    return <EmptyHint icon={<BarChart3 size={28} aria-hidden="true" />} title="Belum ada data rekrutmen" />;
  }

  return (
    <div className="h-[220px]" aria-label="Grafik karyawan masuk vs keluar per bulan">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%" barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeDasharray="2 4" />
          <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}
          />
          <Bar dataKey="Masuk" fill={SERIES_1} barSize={12} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Keluar" fill={SERIES_2} barSize={12} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnalyticsRow({
  headcount,
  turnover,
}: {
  headcount: HeadcountReport | null;
  turnover: TurnoverReport | null;
}) {
  const navigate = useNavigate();
  if (!headcount && !turnover) return null;

  return (
    <div className="grid items-stretch gap-3.5 lg:grid-cols-2">
      {headcount && (
        <DashCard>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Headcount per Departemen</CardTitle>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="text-[11.5px] font-medium text-primary hover:underline"
            >
              Lihat laporan
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Total {headcount.total} karyawan aktif
          </p>
          <div className="mt-3">
            <HeadcountByDeptChart headcount={headcount} />
          </div>
        </DashCard>
      )}
      {turnover && (
        <DashCard>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Masuk vs Keluar (6 bulan)</CardTitle>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="text-[11.5px] font-medium text-primary hover:underline"
            >
              Lihat laporan
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {turnover.newHires} masuk · {turnover.resignations} keluar · turnover {turnover.turnoverRate}%
          </p>
          <div className="mt-3">
            <HiringTrendChart turnover={turnover} />
          </div>
        </DashCard>
      )}
    </div>
  );
}
