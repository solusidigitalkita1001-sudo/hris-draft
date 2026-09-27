import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  LogIn,
  Receipt,
  RefreshCw,
  Settings,
  Shield,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey, TranslationParams } from '@/i18n/translations';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/errors';
import { canAccess, EMPLOYEE_SELF_SERVICE_ROLES } from '@/lib/access-control';
import type { AuthUser } from '@/services/auth.service';
import {
  reportsService,
  type AttendanceReport,
  type DashboardSummary,
  type HeadcountReport,
  type TurnoverReport,
} from '@/services/reports.service';
import { workflowEngineService, type WorkflowInstanceStep } from '@/services/workflow-engine.service';
import { leaveService, type LeaveBalance, type LeaveRequest } from '@/services/leave.service';
import { employeeService, type MyReportingLine } from '@/services/employee.service';
import { attendanceService, type AttendanceRecord, type MyAttendanceToday } from '@/services/attendance.service';
import { CardSkeleton, SkeletonBlock } from './dashboard/shared';
import { PersonalTodayCard, StatStrip } from './dashboard/StatStrip';
import { ApprovalPendingCard } from './dashboard/ApprovalPendingCard';
import { LeaveBalanceCard } from './dashboard/LeaveBalanceCard';
import { TeamCard } from './dashboard/TeamCard';
import { AttendanceHistoryCard } from './dashboard/AttendanceHistoryCard';
import { RecentActivityCard } from './dashboard/RecentActivityCard';
import { QuickActionsCard, type QuickAction } from './dashboard/QuickActionsCard';
import { MyRequestsCard } from './dashboard/MyRequestsCard';
import { AnalyticsRow } from './dashboard/AnalyticsRow';

/**
 * Persona dashboard: kartu yang tampil mengikuti kebutuhan role.
 * - admin   : oversight perusahaan + administrasi (users/roles/audit/settings)
 * - hr      : workforce (stat, approval, kehadiran 90 hari, shortcut HR)
 * - manager : approval tim + kehadiran tim + kartu pribadi
 * - employee: pribadi (absen hari ini, saldo cuti, pengajuan, shortcut ESS)
 * Prioritas saat multi-role: admin > hr > manager > employee.
 */
type DashboardPersona = 'admin' | 'hr' | 'manager' | 'employee';

function personaOf(user: AuthUser | null): DashboardPersona {
  const roles = user?.roles ?? [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN') || roles.includes('COMPANY_ADMIN')) return 'admin';
  if (roles.includes('HR_MANAGER') || roles.includes('HR_STAFF')) return 'hr';
  if (roles.includes('MANAGER')) return 'manager';
  return 'employee';
}

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
  myRequests: LeaveRequest[];
  headcount: HeadcountReport | null;
  turnover: TurnoverReport | null;
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
  myRequests: [],
  headcount: null,
  turnover: null,
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
  const persona = personaOf(user);
  const canAttendance = canAccess(user, {
    requiredPermissions: [{ resource: 'attendance', action: 'read' }],
    requiredRoles: EMPLOYEE_SELF_SERVICE_ROLES,
  });

  // Kebutuhan data per persona — permintaan yang pasti 403 tidak dikirim.
  const wantsCompanyStats = persona === 'admin' || persona === 'hr';
  const wantsApprovals = persona !== 'employee';
  const wantsTeamToday = persona !== 'employee';
  const wantsPersonal = !!user?.employeeId && canAttendance;
  const wantsMyRequests = (persona === 'employee' || persona === 'manager') && !!user?.employeeId;

  const load = useCallback(async () => {
    setLoading(true);
    const today = dayjs().format('YYYY-MM-DD');

    const [summary, approvals, balances, reportingLine, teamRecords, report, myMonth, myToday, myRequests, headcount, turnover] =
      await Promise.all([
        settle(wantsCompanyStats && companyId ? reportsService.getDashboardSummary(companyId) : null),
        settle(wantsApprovals && companyId ? workflowEngineService.findMyApprovals(companyId) : null),
        settle(user?.employeeId ? leaveService.getBalances(user.employeeId) : null),
        settle(user?.employeeId ? employeeService.getMyReportingLine() : null),
        settle(wantsTeamToday && companyId ? attendanceService.getRecords(companyId, { date: today }) : null),
        settle(
          wantsCompanyStats && companyId
            ? reportsService.getAttendance(companyId, dayjs().subtract(90, 'day').format('YYYY-MM-DD'), today)
            : null
        ),
        settle(
          !wantsCompanyStats && wantsPersonal
            ? attendanceService.getMyAttendance({ month: dayjs().format('YYYY-MM'), limit: 31 })
            : null
        ),
        settle(wantsPersonal ? attendanceService.getMyToday() : null),
        settle(wantsMyRequests && companyId ? leaveService.getRequests(companyId) : null),
        settle(wantsCompanyStats && companyId ? reportsService.getHeadcount(companyId) : null),
        settle(
          wantsCompanyStats && companyId
            ? reportsService.getTurnover(
                companyId,
                dayjs().subtract(5, 'month').startOf('month').format('YYYY-MM-DD'),
                dayjs().endOf('month').format('YYYY-MM-DD')
              )
            : null
        ),
      ]);

    setData({
      summary: summary.value,
      // Banner error ringkasan hanya untuk persona yang memang berhak melihat
      // statistik perusahaan; persona lain terdegradasi tanpa banner merah.
      summaryError:
        summary.error && wantsCompanyStats
          ? apiErrorMessage(summary.error, t('ops.dashboard.page.summaryError'))
          : null,
      approvals: approvals.error ? null : approvals.value,
      balances: balances.value ?? [],
      reportingLine: reportingLine.value,
      teamRecords: teamRecords.error ? null : teamRecords.value,
      attendanceReport: report.error ? null : report.value,
      myMonthRecords: myMonth.value?.items ?? null,
      myToday: myToday.value,
      myRequests: (myRequests.value ?? [])
        .filter((request) => request.employeeId === user?.employeeId)
        .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()),
      headcount: headcount.error ? null : headcount.value,
      turnover: turnover.error ? null : turnover.value,
    });
    setLoading(false);
  }, [companyId, user?.employeeId, wantsCompanyStats, wantsApprovals, wantsTeamToday, wantsPersonal, wantsMyRequests, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = (user?.name || user?.email || t('ops.dashboard.page.you')).split(' ')[0];
  const todayLabel = dayjs().format('dddd, D MMMM YYYY');

  const quickActions = buildQuickActions(persona, t);
  const personaSubtitle: Record<DashboardPersona, string> = {
    admin: t('ops.dashboard.page.subtitle.admin'),
    hr: t('ops.dashboard.page.subtitle.hr'),
    manager: t('ops.dashboard.page.subtitle.manager'),
    employee: t('ops.dashboard.page.subtitle.employee'),
  };

  const showApprovals = data.approvals !== null;
  const showLeaveBalance = !!user?.employeeId;
  const showTeam = persona !== 'admin' || !!user?.employeeId || (data.teamRecords?.length ?? 0) > 0;

  return (
    <div>
      {/* Header sapaan */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.9px] text-foreground">
            {t('dashboard.welcome', { name: firstName })}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {todayLabel} · {personaSubtitle[persona]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          {wantsPersonal && (
            <Button size="sm" className="shadow-primary-btn" onClick={() => navigate('/attendance')}>
              <LogIn size={14} className="mr-2" />
              {t('ops.dashboard.page.clockIn')}
            </Button>
          )}
        </div>
      </div>

      {data.summaryError && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-danger-bg px-4 py-3 text-xs text-danger">
          <span>{data.summaryError}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">
            {t('ops.dashboard.page.retry')}
          </button>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* ── Baris teratas: yang paling dibutuhkan persona ── */}
          {wantsCompanyStats && data.summary && (
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
          {!wantsCompanyStats && data.myToday && <PersonalTodayCard today={data.myToday} />}

          {/* ── Aksi cepat (khusus manager; karyawan cukup lewat sidebar) ── */}
          {persona === 'manager' && <QuickActionsCard actions={quickActions} />}

          {/* ── Baris kartu berpasangan (tinggi sejajar) ── */}
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-stretch">
            {showApprovals && (
              <ApprovalPendingCard
                approvals={data.approvals ?? []}
                title={t('dashboard.pendingApprovals')}
                emptyLabel={t('dashboard.noPendingApprovals')}
              />
            )}
            {persona === 'employee' && <MyRequestsCard requests={data.myRequests} />}
            {showLeaveBalance && <LeaveBalanceCard balances={data.balances} />}
            {persona === 'admin' && (
              <QuickActionsCard title={t('ops.dashboard.page.adminActionsTitle')} actions={quickActions} className="flex-1" compact />
            )}
            {persona === 'hr' && (
              <QuickActionsCard title={t('ops.dashboard.page.hrActionsTitle')} actions={quickActions} className="flex-1" compact />
            )}
          </div>

          {/* ── Analitik workforce (admin & HR) ── */}
          {wantsCompanyStats && <AnalyticsRow headcount={data.headcount} turnover={data.turnover} />}

          {/* ── Tim ── */}
          {showTeam && (
            <TeamCard
              reportingLine={data.reportingLine}
              records={data.teamRecords}
              isOperational={persona !== 'employee'}
              selfEmployeeId={user?.employeeId}
            />
          )}

          {/* ── Data historis ── */}
          <div
            className={`grid items-start gap-3.5 ${
              wantsCompanyStats && data.summary ? 'lg:grid-cols-2' : ''
            }`}
          >
            <AttendanceHistoryCard report={data.attendanceReport} myRecords={data.myMonthRecords} />
            {wantsCompanyStats && data.summary && (
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

function buildQuickActions(
  persona: DashboardPersona,
  t: (key: TranslationKey, params?: TranslationParams) => string
): QuickAction[] {
  switch (persona) {
    case 'employee':
      return [
        { label: t('ops.dashboard.quickActions.applyLeave'), note: t('ops.dashboard.quickActions.applyLeaveNote'), icon: <CalendarDays size={15} />, path: '/self-service' },
        { label: t('ops.dashboard.quickActions.myPayslips'), note: t('ops.dashboard.quickActions.myPayslipsNote'), icon: <Receipt size={15} />, path: '/my-payslips' },
        { label: t('ops.dashboard.quickActions.loans'), note: t('ops.dashboard.quickActions.loansNote'), icon: <Banknote size={15} />, path: '/employee-loans' },
        { label: t('ops.dashboard.quickActions.ewa'), note: t('ops.dashboard.quickActions.ewaNote'), icon: <Wallet size={15} />, path: '/ewa' },
      ];
    case 'manager':
      return [
        { label: t('ops.dashboard.quickActions.teamApprovals'), note: t('ops.dashboard.quickActions.teamApprovalsNote'), icon: <ClipboardCheck size={15} />, path: '/workflow-engine' },
        { label: t('ops.dashboard.quickActions.attendance'), note: t('ops.dashboard.quickActions.attendanceTeamNote'), icon: <Clock size={15} />, path: '/attendance' },
        { label: t('ops.dashboard.quickActions.applyLeave'), note: t('ops.dashboard.quickActions.applyLeavePersonalNote'), icon: <CalendarDays size={15} />, path: '/self-service' },
        { label: t('ops.dashboard.quickActions.myPayslips'), note: t('ops.dashboard.quickActions.myPayslipsNote'), icon: <Receipt size={15} />, path: '/my-payslips' },
      ];
    case 'hr':
      return [
        { label: t('ops.dashboard.quickActions.employees'), note: t('ops.dashboard.quickActions.employeesNote'), icon: <Users size={15} />, path: '/employees' },
        { label: t('ops.dashboard.quickActions.attendance'), note: t('ops.dashboard.quickActions.attendanceHrNote'), icon: <Clock size={15} />, path: '/attendance' },
        { label: t('ops.dashboard.quickActions.leave'), note: t('ops.dashboard.quickActions.leaveNote'), icon: <CalendarDays size={15} />, path: '/leave' },
        { label: t('ops.dashboard.quickActions.payroll'), note: t('ops.dashboard.quickActions.payrollNote'), icon: <Banknote size={15} />, path: '/payroll' },
      ];
    case 'admin':
      return [
        { label: t('ops.dashboard.quickActions.users'), note: t('ops.dashboard.quickActions.usersNote'), icon: <Users size={15} />, path: '/admin/users' },
        { label: t('ops.dashboard.quickActions.roles'), note: t('ops.dashboard.quickActions.rolesNote'), icon: <Shield size={15} />, path: '/admin/roles' },
        { label: t('ops.dashboard.quickActions.auditLog'), note: t('ops.dashboard.quickActions.auditLogNote'), icon: <FileText size={15} />, path: '/admin/audit' },
        { label: t('ops.dashboard.quickActions.workflow'), note: t('ops.dashboard.quickActions.workflowNote'), icon: <Workflow size={15} />, path: '/admin/workflows' },
        { label: t('ops.dashboard.quickActions.reports'), note: t('ops.dashboard.quickActions.reportsNote'), icon: <FileText size={15} />, path: '/reports' },
        { label: t('ops.dashboard.quickActions.settings'), note: t('ops.dashboard.quickActions.settingsNote'), icon: <Settings size={15} />, path: '/admin/settings' },
      ];
  }
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
