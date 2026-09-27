import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Link } from 'react-router-dom';
import { ChevronDown, List, Network, Users } from 'lucide-react';
import type { AttendanceRecord } from '@/services/attendance.service';
import type { MyReportingLine } from '@/services/employee.service';
import { cn } from '@/utils/cn';
import { CardTitle, DashCard, EmptyHint, InitialAvatar, StatusChip, type ChipTone } from './shared';
import { formatDuration } from './format';

// Skala timeline shift 07.00–18.00 (menit sejak 00.00)
const SCALE_START = 7 * 60;
const SCALE_END = 18 * 60;
const SCALE_SPAN = SCALE_END - SCALE_START;

type MemberState = 'done' | 'running' | 'late' | 'excused' | 'absent' | 'none';

interface Member {
  id: string;
  name: string;
  subtitle: string;
  checkIn: Dayjs | null;
  checkOut: Dayjs | null;
  state: MemberState;
  lateMinutes: number;
  workDuration: number | null;
}

const STATE_META: Record<MemberState, { chip: string; tone: ChipTone; dot: string; bar: string }> = {
  done: { chip: 'Selesai', tone: 'success', dot: 'bg-success', bar: 'bg-success' },
  running: { chip: 'Bekerja', tone: 'primary', dot: 'bg-primary', bar: 'bg-primary' },
  late: { chip: 'Telat', tone: 'warning', dot: 'bg-warning', bar: 'bg-warning' },
  excused: { chip: 'Izin', tone: 'neutral', dot: 'bg-muted-foreground', bar: '' },
  absent: { chip: 'Absen', tone: 'danger', dot: 'bg-danger', bar: '' },
  none: { chip: 'Belum absen', tone: 'neutral', dot: 'bg-muted-foreground', bar: '' },
};

function toMember(record: AttendanceRecord): Member {
  const checkIn = record.checkIn ? dayjs(record.checkIn) : null;
  const checkOut = record.checkOut ? dayjs(record.checkOut) : null;
  const late = record.lateMinutes ?? 0;

  let state: MemberState = 'none';
  if (record.status === 'EXCUSED') state = 'excused';
  else if (record.status === 'ABSENT') state = 'absent';
  else if (checkIn && checkOut) state = 'done';
  else if (checkIn && (late > 0 || record.status === 'LATE')) state = 'late';
  else if (checkIn) state = 'running';

  return {
    id: record.id,
    name: record.employee?.fullName || 'Karyawan',
    subtitle: record.employee?.employeeNumber || record.branch?.name || '—',
    checkIn,
    checkOut,
    state,
    lateMinutes: late,
    workDuration: record.workDuration ?? null,
  };
}

function minutesOf(t: Dayjs): number {
  return t.hour() * 60 + t.minute();
}

function barGeometry(member: Member): { left: number; width: number } | null {
  if (!member.checkIn) return null;
  const start = Math.max(minutesOf(member.checkIn), SCALE_START);
  const endRaw = member.checkOut ? minutesOf(member.checkOut) : minutesOf(dayjs());
  const end = Math.min(Math.max(endRaw, start + 8), SCALE_END);
  return {
    left: ((start - SCALE_START) / SCALE_SPAN) * 100,
    width: ((end - start) / SCALE_SPAN) * 100,
  };
}

function barNote(member: Member): string {
  switch (member.state) {
    case 'done':
      return `Selesai · ${formatDuration(member.workDuration ?? (member.checkIn && member.checkOut ? member.checkOut.diff(member.checkIn, 'minute') : null))}`;
    case 'late':
      return `Telat ${member.lateMinutes || '—'}m · sedang berjalan`;
    case 'running':
      return 'Sedang berjalan';
    case 'excused':
      return 'Izin / cuti hari ini';
    case 'absent':
      return 'Tidak hadir';
    default:
      return 'Belum ada catatan masuk';
  }
}

function SupervisorCard({ line }: { line: MyReportingLine }) {
  const boss = line.primarySupervisor;
  if (!boss) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-accent px-3.5 py-3">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-card text-primary">
          <Users size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Atasan langsung belum diatur</p>
          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
            {line.reportsToPosition ? `Posisi tujuan: ${line.reportsToPosition.name}` : 'Struktur pelaporan belum lengkap'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent px-3.5 py-3">
      <InitialAvatar name={boss.fullName} index={0} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-foreground">{boss.fullName}</span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.6px] text-primary">
            Atasan
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
          {boss.position?.name || boss.department?.name || boss.employeeNumber}
        </p>
      </div>
    </div>
  );
}

interface TeamCardProps {
  reportingLine: MyReportingLine | null;
  records: AttendanceRecord[] | null;
  isOperational: boolean;
  selfEmployeeId?: string;
}

/** Kartu "Tim Saya" — atasan langsung + kehadiran anggota hari ini (mode Daftar / Bagan). */
export function TeamCard({ reportingLine, records, isOperational, selfEmployeeId }: TeamCardProps) {
  const [view, setView] = useState<'list' | 'chart'>('list');
  const [filter, setFilter] = useState<'all' | 'present' | 'pending'>('all');
  const [showAll, setShowAll] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);

  const members = useMemo(() => {
    if (!records) return [];
    return records
      .filter((r) => !selfEmployeeId || r.employeeId !== selfEmployeeId)
      .map(toMember)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records, selfEmployeeId]);

  const hasTeamData = isOperational && members.length > 0;

  const counts = useMemo(() => {
    const present = members.filter((m) => m.checkIn).length;
    const late = members.filter((m) => m.state === 'late').length;
    const excused = members.filter((m) => m.state === 'excused').length;
    const pending = members.filter((m) => !m.checkIn).length;
    return { total: members.length, present, late, excused, pending };
  }, [members]);

  const filtered = useMemo(() => {
    if (filter === 'present') return members.filter((m) => m.checkIn);
    if (filter === 'pending') return members.filter((m) => !m.checkIn);
    return members;
  }, [members, filter]);

  const visible = showAll ? filtered : filtered.slice(0, 3);
  const hiddenCount = filtered.length - 3;

  // Saat mode Bagan dibuka, posisikan scroll ke tengah agar node atasan terlihat.
  useEffect(() => {
    if (view === 'chart' && orgRef.current) {
      const el = orgRef.current;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [view, members.length]);

  const ratio = counts.total > 0 ? counts.present / counts.total : 0;
  const ringCircumference = 2 * Math.PI * 31;

  return (
    <DashCard className="rounded-card p-5 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Tim Saya</CardTitle>
            {hasTeamData && (
              <span className="rounded-full bg-accent px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.5px] text-primary">
                Live
              </span>
            )}
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {hasTeamData
              ? `${counts.total} anggota tercatat · ${counts.present} hadir · ${counts.late} telat · ${counts.pending} belum absen`
              : 'Atasan langsung dan struktur pelaporan Anda'}
          </p>
        </div>

        {hasTeamData && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex gap-0.5 rounded-[14px] bg-secondary p-[3px]">
              {([
                { key: 'list', label: 'Daftar', icon: List },
                { key: 'chart', label: 'Bagan', icon: Network },
              ] as const).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-[11px] px-3 py-1.5 text-[11px] transition-colors',
                    view === v.key ? 'bg-card font-semibold text-foreground shadow-card' : 'font-medium text-muted-foreground'
                  )}
                >
                  <v.icon size={13} />
                  {v.label}
                </button>
              ))}
            </div>
            {view === 'list' && (
              <div className="flex gap-0.5 rounded-[14px] bg-secondary p-[3px]">
                {([
                  { key: 'all', label: 'Semua' },
                  { key: 'present', label: 'Hadir' },
                  { key: 'pending', label: 'Belum' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'rounded-[11px] px-3 py-1.5 text-[11px] transition-colors',
                      filter === f.key ? 'bg-card font-semibold text-foreground shadow-card' : 'font-medium text-muted-foreground'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <Link to="/attendance" className="whitespace-nowrap text-[11.5px] font-medium text-primary hover:underline">
              Rekap tim
            </Link>
          </div>
        )}
      </div>

      {/* Mode Bagan */}
      {hasTeamData && view === 'chart' && (
        <div ref={orgRef} className="mt-4 overflow-x-auto pb-1.5">
          <div className="flex min-w-max flex-col items-center">
            {/* Node atasan */}
            <div className="flex min-w-[230px] items-center gap-3 rounded-[18px] border border-border bg-accent px-4 py-3">
              {reportingLine?.primarySupervisor ? (
                <>
                  <InitialAvatar name={reportingLine.primarySupervisor.fullName} index={0} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-nowrap text-[12.5px] font-semibold text-foreground">
                      {reportingLine.primarySupervisor.fullName}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-[10.5px] text-muted-foreground">
                      {reportingLine.primarySupervisor.position?.name || 'Atasan langsung'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-card text-primary">
                    <Users size={16} />
                  </span>
                  <p className="whitespace-nowrap text-[12.5px] font-semibold text-foreground">Struktur tim</p>
                </>
              )}
            </div>
            <div className="h-[18px] w-0.5 bg-border" />
            {/* Rail + node anggota */}
            <div className="relative pt-[18px]">
              <div className="absolute left-[83px] right-[83px] top-0 h-0.5 bg-border" />
              <div className="flex gap-2.5">
                {members.slice(0, 8).map((m, i) => {
                  const meta = STATE_META[m.state];
                  return (
                    <div key={m.id} className="flex w-[166px] shrink-0 flex-col items-center">
                      <div className="-mt-[18px] h-[18px] w-0.5 bg-border" />
                      <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3.5">
                        <span className="relative shrink-0">
                          <InitialAvatar name={m.name} index={i} size={40} />
                          <span className={cn('absolute -bottom-px -right-px h-[11px] w-[11px] rounded-full border-2 border-card', meta.dot)} />
                        </span>
                        <div className="w-full text-center">
                          <p className="truncate text-[11.5px] font-semibold text-foreground">{m.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{m.subtitle}</p>
                        </div>
                        <div className="flex w-full justify-center gap-2.5 border-t border-border pt-2">
                          <div className="text-center">
                            <p className="text-[8.5px] text-muted-foreground">Masuk</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-foreground">
                              {m.checkIn ? m.checkIn.format('HH.mm') : '—'}
                            </p>
                          </div>
                          <div className="w-px bg-border" />
                          <div className="text-center">
                            <p className="text-[8.5px] text-muted-foreground">Pulang</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-foreground">
                              {m.checkOut ? m.checkOut.format('HH.mm') : '—'}
                            </p>
                          </div>
                        </div>
                        <StatusChip tone={meta.tone} className="text-[8.5px]">{meta.chip}</StatusChip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode Daftar */}
      {(!hasTeamData || view === 'list') && (
        <div className="mt-3.5 grid items-start gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))' }}>
          {/* Kolom kiri: ringkasan + atasan */}
          <div className="flex min-w-0 flex-col gap-2.5">
            {hasTeamData && (
              <div className="flex items-center gap-3.5 rounded-[18px] bg-secondary px-4 py-3">
                <div className="relative h-16 w-16 shrink-0">
                  <svg width="64" height="64" viewBox="0 0 78 78" className="-rotate-90">
                    <circle cx="39" cy="39" r="31" fill="none" strokeWidth="9" className="stroke-muted" />
                    <circle
                      cx="39"
                      cy="39"
                      r="31"
                      fill="none"
                      strokeWidth="9"
                      strokeLinecap="round"
                      stroke="hsl(var(--primary))"
                      strokeDasharray={`${ratio * ringCircumference} ${ringCircumference}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[15px] font-semibold leading-none tracking-[-0.6px] text-foreground">
                      {counts.present}/{counts.total}
                    </span>
                    <span className="mt-0.5 text-[8.5px] text-muted-foreground">hadir</span>
                  </span>
                </div>
                <div className="grid min-w-0 flex-1 gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                  {[
                    { label: 'Hadir', n: counts.present - counts.late, dot: 'bg-success' },
                    { label: 'Telat', n: counts.late, dot: 'bg-warning' },
                    { label: 'Izin / cuti', n: counts.excused, dot: 'bg-muted-foreground' },
                    { label: 'Belum absen', n: counts.pending, dot: 'bg-danger' },
                  ].map((c) => (
                    <div key={c.label} className="flex min-w-0 items-center gap-1.5">
                      <span className={cn('h-[7px] w-[7px] shrink-0 rounded', c.dot)} />
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">{c.label}</span>
                      <span className="text-[11px] font-semibold text-foreground">{c.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reportingLine ? (
              <SupervisorCard line={reportingLine} />
            ) : (
              <div className="rounded-2xl bg-secondary px-3.5 py-3 text-[11px] text-muted-foreground">
                Struktur pelaporan Anda belum tersedia.
              </div>
            )}

            {!hasTeamData && (
              <p className="px-1 text-[10.5px] text-muted-foreground">
                {isOperational
                  ? 'Belum ada catatan kehadiran tim untuk hari ini.'
                  : 'Detail kehadiran anggota tim hanya tersedia untuk atasan dan HR.'}
              </p>
            )}
          </div>

          {/* Kolom kanan: daftar anggota */}
          {hasTeamData && (
            <div className="min-w-0">
              <div className="flex items-center justify-between px-0.5 pb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">Anggota</span>
                <span className="hidden text-[9.5px] text-muted-foreground sm:block">07.00 &nbsp;·&nbsp; 12.00 &nbsp;·&nbsp; 18.00</span>
              </div>
              {visible.length === 0 && (
                <EmptyHint title="Tidak ada anggota pada filter ini" note="Ubah filter untuk melihat anggota lain." />
              )}
              {visible.map((m, i) => {
                const meta = STATE_META[m.state];
                const bar = barGeometry(m);
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-0.5 py-2.5">
                    <span className="relative shrink-0">
                      <InitialAvatar name={m.name} index={i} size={34} />
                      <span className={cn('absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-card', meta.dot)} />
                    </span>
                    <div className="min-w-0 flex-1 basis-[120px]">
                      <p className="truncate text-xs font-medium text-foreground">{m.name}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{m.subtitle}</p>
                    </div>
                    <div className="flex min-w-0 flex-1 basis-[140px] flex-col gap-1">
                      <div className="relative h-[7px] overflow-hidden rounded bg-muted">
                        {bar && meta.bar && (
                          <span
                            className={cn('absolute bottom-0 top-0 rounded transition-all duration-500', meta.bar)}
                            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                          />
                        )}
                      </div>
                      <p className="truncate text-[9.5px] text-muted-foreground">{barNote(m)}</p>
                    </div>
                    <div className="ml-auto flex flex-none items-center gap-3">
                      <div className="min-w-[38px] text-right">
                        <p className="text-[9px] text-muted-foreground">Masuk</p>
                        <p className={cn('mt-0.5 text-[11.5px] font-semibold', m.state === 'late' ? 'text-warning' : 'text-foreground')}>
                          {m.checkIn ? m.checkIn.format('HH.mm') : '—'}
                        </p>
                      </div>
                      <div className="min-w-[38px] text-right">
                        <p className="text-[9px] text-muted-foreground">Pulang</p>
                        <p className="mt-0.5 text-[11.5px] font-semibold text-foreground">
                          {m.checkOut ? m.checkOut.format('HH.mm') : '—'}
                        </p>
                      </div>
                      <StatusChip tone={meta.tone} className="text-[9px]">{meta.chip}</StatusChip>
                    </div>
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-secondary py-2 text-[11px] font-medium text-primary transition-colors hover:bg-secondary/70"
                >
                  {showAll ? 'Tampilkan lebih sedikit' : `Lihat ${hiddenCount} anggota lainnya`}
                  <ChevronDown size={12} className={cn('transition-transform duration-200', showAll && 'rotate-180')} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </DashCard>
  );
}
