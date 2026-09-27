import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { useNavigate } from 'react-router-dom';
import { LogIn, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/errors';
import { canAccess, hasAnyRole, EMPLOYEE_SELF_SERVICE_ROLES, OPERATIONAL_ROLES } from '@/lib/access-control';
import { reportsService, type AttendanceReport, type DashboardSummary } from '@/services/reports.service';
import { workflowEngineService, type WorkflowInstanceStep } from '@/services/workflow-engine.service';
import { leaveService, type LeaveBalance } from '@/services/leave.service';
import { employeeService, type MyReportingLine } from '@/services/employee.service';
import { attendanceService, type AttendanceRecord, type MyAttendanceToday } from '@/services/attendance.service';
import { CardSkeleton, SkeletonBlock } from './dashboard/shared';
import { PersonalTodayCard, StatStrip } from './dashboard/StatStrip';
import { ApprovalPendingCard } from './dashboard/ApprovalPendingCard';
import { LeaveBalanceCard } from './dashboard/LeaveBalanceCard';
import { TeamCard } from './dashboard/TeamCard';
import { AttendanceHistoryCard } from './dashboard/AttendanceHistoryCard';
import { RecentActivityCard } from './dashboard/RecentActivityCard';

interface DashboardData {
  summary: DashboardSummary | null;
  summaryError: string | null;
  /** null = tidak berhak / gagal (kartu disembunyikan, tanpa error merah). */
  approvals: WorkflowInstanceStep[] | null;
  balances: LeaveBalance[];
  reportingLine: MyReportingLine | null;
  teamRecords: AttendanceRecord[] | null;
  attendanceReport: AttendanceReport | null;
  myMonthRecords: AttendanceRecord[] | null;
  myToday: MyAttendanceToday | null;
}

const EMPTY_DATA: DashboardData = {
  summary: null,
  summaryError: null,
  approvals: null,
  balances: [],
  reportingLine: null,
  teamRecords: null,
  attendanceReport: null,
  myMonthRecords: null,
  myToday: null,
};

async function settle<T>(promise: Promise<T> | null): Promise<{ value: T | null; error: unknown | null }> {
  if (!promise) return { value: null, error: null };
  try {
    return { value: await promise, error: null };
  } catch (error) {
    return { value: null, error };
  }
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { activeCompanyId, activeCompany } = useCompanyStore();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  const companyId = activeCompanyId || '';
  const isOperational = hasAnyRole(user, OPERATIONAL_ROLES);
  const canAttendance = canAccess(user, {
    requiredPermissions: [{ resource: 'attendance', action: 'read' }],
    requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const today = dayjs().format('YYYY-MM-DD');

    const [summary, approvals, balances, reportingLine, teamRecords, report, myMonth, myToday] = await Promise.all([
      settle(companyId ? reportsService.getDashboardSummary(companyId) : null),
      settle(companyId ? workflowEngineService.findMyApprovals(companyId) : null),
      settle(user?.employeeId ? leaveService.getBalances(user.employeeId) : null),
      settle(user?.employeeId ? employeeService.getMyReportingLine() : null),
      settle(isOperational && companyId ? attendanceService.getRecords(companyId, { date: today }) : null),
      settle(
        isOperational && companyId
          ? reportsService.getAttendance(companyId, dayjs().subtract(90, 'day').format('YYYY-MM-DD'), today)
          : null
      ),
      settle(
        !isOperational && canAttendance
          ? attendanceService.getMyAttendance({ month: dayjs().format('YYYY-MM'), limit: 31 })
          : null
      ),
      settle(!isOperational && canAttendance ? attendanceService.getMyToday() : null),
    ]);

    setData({
      summary: summary.value,
      // Error ringkasan hanya ditampilkan untuk user operasional; karyawan biasa
      // mendapat fallback kartu absensi pribadi tanpa banner merah (degradasi anggun).
      summaryError:
        summary.error && isOperational ? apiErrorMessage(summary.error, 'Gagal memuat ringkasan dashboard') : null,
      approvals: approvals.error ? null : approvals.value,
      balances: balances.value ?? [],
      reportingLine: reportingLine.value,
      teamRecords: teamRecords.error ? null : teamRecords.value,
      attendanceReport: report.error ? null : report.value,
      myMonthRecords: myMonth.value?.items ?? null,
      myToday: myToday.value,
    });
    setLoading(false);
  }, [companyId, user?.employeeId, isOperational, canAttendance]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = (user?.name || user?.email || 'Anda').split(' ')[0];
  const todayLabel = dayjs().locale('id').format('dddd, D MMMM YYYY');

  const showStatStrip = !!data.summary;
  const showPersonalToday = !data.summary && !isOperational && !!data.myToday;
  const showApprovals = data.approvals !== null;
  const showActivity = !!data.summary;

  return (
    <div>
      {/* Header sapaan */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.9px] text-foreground">
            {t('dashboard.welcome', { name: firstName })}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {todayLabel} · ringkasan aktivitas Anda hari ini.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canAttendance && (
            <Button size="sm" className="shadow-primary-btn" onClick={() => navigate('/attendance')}>
              <LogIn size={14} className="mr-2" />
              Clock in
            </Button>
          )}
        </div>
      </div>

      {data.summaryError && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-danger-bg px-4 py-3 text-xs text-danger">
          <span>{data.summaryError}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* 1. Strip statistik / kartu absensi pribadi */}
          {showStatStrip && data.summary && (
            <StatStrip
              summary={data.summary}
              companyName={activeCompany?.name}
              labels={{
                totalEmployees: t('dashboard.stats.totalEmployees'),
                departments: t('dashboard.stats.departments'),
                presentToday: t('dashboard.stats.presentToday'),
                onLeave: t('dashboard.stats.onLeave'),
              }}
            />
          )}
          {showPersonalToday && data.myToday && <PersonalTodayCard today={data.myToday} />}

          {/* 2. Approval Menunggu + Saldo Cuti (tinggi sejajar) */}
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-stretch">
            {showApprovals && (
              <ApprovalPendingCard
                approvals={data.approvals ?? []}
                title={t('dashboard.pendingApprovals')}
                emptyLabel={t('dashboard.noPendingApprovals')}
              />
            )}
            <LeaveBalanceCard balances={data.balances} />
          </div>

          {/* 3. Tim Saya */}
          <TeamCard
            reportingLine={data.reportingLine}
            records={data.teamRecords}
            isOperational={isOperational}
            selfEmployeeId={user?.employeeId}
          />

          {/* 4. Kehadiran + Aktivitas Terbaru */}
          <div className={`grid items-start gap-3.5 ${showActivity ? 'lg:grid-cols-2' : ''}`}>
            <AttendanceHistoryCard report={data.attendanceReport} myRecords={data.myMonthRecords} />
            {showActivity && data.summary && (
              <RecentActivityCard
                items={data.summary.recentActivity}
                title={t('dashboard.recentActivity')}
                emptyLabel={t('dashboard.noRecentActivity')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[22px] border border-border bg-card p-5 shadow-card">
            <SkeletonBlock className="h-3.5 w-2/3" />
            <SkeletonBlock className="mt-5 h-8 w-1/3" />
            <SkeletonBlock className="mt-3 h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
      <CardSkeleton lines={4} />
      <div className="grid gap-3.5 lg:grid-cols-2">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
