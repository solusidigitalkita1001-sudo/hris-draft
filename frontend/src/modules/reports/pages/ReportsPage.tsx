import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  reportsService,
  type AttendanceReport,
  type HeadcountReport,
  type LeaveReport,
  type PayrollReport,
  type RecruitmentReport,
  type TurnoverReport,
} from '@/services/reports.service';
import { payrollService, type PayrollPeriod } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useCompanyStore } from '@/stores/company.store';
import {
  Users, Clock, CalendarDays, Banknote, TrendingUp, UserSquare2,
  Download, RefreshCw, BarChart3, PieChart as PieChartIcon,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

// ─── Types ──────────────────────────────────────────────
type ReportTab = 'headcount' | 'attendance' | 'leave' | 'payroll' | 'turnover' | 'recruitment';
type ReportDataMap = {
  headcount: HeadcountReport;
  attendance: AttendanceReport;
  leave: LeaveReport;
  payroll: PayrollReport;
  turnover: TurnoverReport;
  recruitment: RecruitmentReport;
};

interface TabConfig { key: ReportTab; label: TranslationKey; icon: React.ReactNode }

const TABS: TabConfig[] = [
  { key: 'headcount', label: 'ops.reports.tabs.headcount', icon: <Users size={16} /> },
  { key: 'attendance', label: 'ops.reports.tabs.attendance', icon: <Clock size={16} /> },
  { key: 'leave', label: 'ops.reports.tabs.leave', icon: <CalendarDays size={16} /> },
  { key: 'payroll', label: 'ops.reports.tabs.payroll', icon: <Banknote size={16} /> },
  { key: 'turnover', label: 'ops.reports.tabs.turnover', icon: <TrendingUp size={16} /> },
  { key: 'recruitment', label: 'ops.reports.tabs.recruitment', icon: <UserSquare2 size={16} /> },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const STATUS_LABELS: Record<string, TranslationKey> = {
  PRESENT: 'ops.reports.status.present', ABSENT: 'ops.reports.status.absent', LATE: 'ops.reports.status.late', EXCUSED: 'ops.reports.status.excused',
  PENDING: 'ops.reports.status.pending', APPROVED: 'ops.reports.status.approved', REJECTED: 'ops.reports.status.rejected',
};

// ─── CSV Export Helper ──────────────────────────────────
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center py-12 gap-3 col-span-full">
      <div className="text-muted-foreground/40">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────
export function ReportsPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('headcount');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyId = activeCompany?.id || '';

  // Date filters (default: this month)
  const now = dayjs();
  const [startDate, setStartDate] = useState(now.startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(now.endOf('month').format('YYYY-MM-DD'));

  const [reportData, setReportData] = useState<Partial<ReportDataMap>>({});
  const [lastFetchKeyByTab, setLastFetchKeyByTab] = useState<Partial<Record<ReportTab, string>>>({});

  // Period filter for payroll
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');

  const loadPayrollPeriods = useCallback(async () => {
    if (!companyId) {
      setPayrollPeriods([]);
      return;
    }

    try {
      const data = await payrollService.getPayrollPeriods(companyId);
      setPayrollPeriods(data);
    } catch {
      setPayrollPeriods([]);
    }
  }, [companyId]);

  useEffect(() => {
    setReportData({});
    setLastFetchKeyByTab({});
    setError(null);
  }, [companyId]);

  const getFetchKey = useCallback((tab: ReportTab) => {
    if (tab === 'payroll') {
      return `${companyId}|${periodId || 'all-periods'}`;
    }

    return `${companyId}|${startDate}|${endDate}`;
  }, [companyId, endDate, periodId, startDate]);

  // ─── Fetch Data ──────────────────────────────────────
  const fetchReport = useCallback(async (tab: ReportTab, force = false) => {
    if (!companyId) {
      setError(t('ops.reports.errors.noCompany'));
      setLoading(false);
      return;
    }

    if (dayjs(endDate).isBefore(dayjs(startDate), 'day')) {
      setError(t('ops.reports.errors.invalidDateRange'));
      setLoading(false);
      return;
    }

    const fetchKey = getFetchKey(tab);
    if (!force && lastFetchKeyByTab[tab] === fetchKey && reportData[tab]) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: ReportDataMap[ReportTab];

      switch (tab) {
        case 'headcount':
          data = await reportsService.getHeadcount(companyId);
          break;
        case 'attendance':
          data = await reportsService.getAttendance(companyId, startDate, endDate);
          break;
        case 'leave':
          data = await reportsService.getLeave(companyId, startDate, endDate);
          break;
        case 'payroll':
          data = await reportsService.getPayroll(companyId, periodId || undefined);
          break;
        case 'turnover':
          data = await reportsService.getTurnover(companyId, startDate, endDate);
          break;
        case 'recruitment':
          data = await reportsService.getRecruitment(companyId, startDate, endDate);
          break;
      }

      setReportData((prev) => ({ ...prev, [tab]: data }));
      setLastFetchKeyByTab((prev) => ({ ...prev, [tab]: fetchKey }));
    } catch (e) {
      setError(apiErrorMessage(e, t('ops.reports.errors.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [companyId, endDate, getFetchKey, lastFetchKeyByTab, periodId, reportData, startDate, t]);

  useEffect(() => {
    void fetchReport(activeTab);
  }, [activeTab, fetchReport]);
  useEffect(() => { void loadPayrollPeriods(); }, [loadPayrollPeriods]);

  const headcountData = reportData.headcount;
  const attendanceData = reportData.attendance;
  const leaveData = reportData.leave;
  const payrollData = reportData.payroll;
  const turnoverData = reportData.turnover;
  const recruitmentData = reportData.recruitment;
  const activeTabData = reportData[activeTab];

  // ─── Export Handlers ──────────────────────────────────
  const exportCSV = useCallback(() => {
    switch (activeTab) {
      case 'headcount': {
        if (!headcountData) return;
        const rows = [[t('ops.reports.columns.department'), t('ops.reports.columns.count')]];
        headcountData.byDepartment.forEach((d) => rows.push([d.departmentName, String(d.count)]));
        downloadCSV(rows, `headcount-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'attendance': {
        if (!attendanceData) return;
        const rows = [[t('ops.reports.columns.status'), t('ops.reports.columns.count')]];
        attendanceData.byStatus.forEach((s) => rows.push([STATUS_LABELS[s.status] ? t(STATUS_LABELS[s.status]) : s.status, String(s.count)]));
        rows.push([t('ops.reports.status.late'), String(attendanceData.lateCount)]);
        downloadCSV(rows, `attendance-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'leave': {
        if (!leaveData) return;
        const rows = [[t('ops.reports.columns.leaveType'), t('ops.reports.columns.requests'), t('ops.reports.columns.totalDays')]];
        leaveData.byType.forEach((t) => rows.push([t.leaveTypeName, String(t.count), String(t.totalDays)]));
        downloadCSV(rows, `leave-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'payroll': {
        if (!payrollData) return;
        const rows = [[t('ops.reports.columns.period'), t('ops.reports.columns.employees'), t('ops.reports.columns.earnings'), t('ops.reports.columns.deductions'), t('ops.reports.columns.netPay')]];
        payrollData.runs.forEach((r) =>
          rows.push([r.name, String(r.totalEmployees), String(r.totalEarnings), String(r.totalDeductions), String(r.totalNetPay)])
        );
        downloadCSV(rows, `payroll-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'turnover': {
        if (!turnoverData) return;
        const rows = [[t('ops.reports.columns.month'), t('ops.reports.columns.hires'), t('ops.reports.columns.resignations')]];
        turnoverData.monthly.forEach((m) =>
          rows.push([`${m.year}-${String(m.month).padStart(2, '0')}`, String(m.hires), String(m.resigns)])
        );
        downloadCSV(rows, `turnover-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'recruitment': {
        if (!recruitmentData) return;
        const rows = [[t('ops.reports.columns.stage'), t('ops.reports.columns.count')]];
        recruitmentData.byStage.forEach((s) => rows.push([s.stage, String(s.count)]));
        downloadCSV(rows, `recruitment-${now.format('YYYY-MM')}.csv`);
        break;
      }
    }
  }, [activeTab, headcountData, attendanceData, leaveData, payrollData, turnoverData, recruitmentData, now, t]);

  // ─── Render ───────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title={t('ops.reports.title')}
        description={t('ops.reports.description')}
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 h-9 text-xs"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 h-9 text-xs"
            />
            {activeTab === 'payroll' && (
              <div className="w-56">
                <Select2
                  value={periodId}
                  onValueChange={setPeriodId}
                  options={[
                    { value: '', label: t('ops.reports.filters.allPeriods') },
                    ...payrollPeriods.map((p) => ({ value: p.id, label: `${p.name} • ${p.status}` })),
                  ]}
                  placeholder={t('ops.reports.filters.periodPlaceholder')}
                  className="h-9 text-xs"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => void fetchReport(activeTab, true)}>
              <RefreshCw size={16} className="mr-2" /> {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={exportCSV} disabled={loading || !activeTabData}>
              <Download size={16} className="mr-2" /> {t('ops.reports.actions.exportCsv')}
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon} {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 p-4 rounded-lg mb-6 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">{t('ops.reports.loading')}</div>
        </div>
      )}

      {/* ─── Content ─────────────────────────────────── */}
      {!loading && !error && !activeTabData && (
        <EmptyState icon={<BarChart3 size={40} />} message={t('ops.reports.empty.noTabData')} />
      )}

      {!loading && !error && activeTabData && (
        <>
          {/* ═══ HEADCOUNT ═══ */}
          {activeTab === 'headcount' && headcountData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('ops.reports.stats.totalEmployees')} value={formatNumber(headcountData.total)} />
                <StatCard label={t('ops.reports.stats.departments')} value={formatNumber(headcountData.byDepartment.length)} />
                {headcountData.byStatus.map((s) => (
                  <StatCard key={s.status} label={t('ops.reports.stats.statusLabel', { status: s.status })} value={formatNumber(s.count)} />
                ))}
              </div>
              {headcountData.byDepartment.length === 0 ? (
                <EmptyState icon={<BarChart3 size={40} />} message={t('ops.reports.empty.headcount')} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.employeesByDepartment')}</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={headcountData.byDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="departmentName" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ ATTENDANCE ═══ */}
          {activeTab === 'attendance' && attendanceData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('ops.reports.stats.totalRecords')} value={formatNumber(attendanceData.total)} />
                <StatCard label={t('ops.reports.stats.lateCount')} value={formatNumber(attendanceData.lateCount)} sub={t('ops.reports.stats.lateRate', { rate: attendanceData.lateRate })} />
              </div>
              {attendanceData.byStatus.length === 0 ? (
                <EmptyState icon={<PieChartIcon size={40} />} message={t('ops.reports.empty.attendance')} />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                    <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.attendanceDistribution')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={attendanceData.byStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%" cy="50%"
                          outerRadius={100}
                          label={({ status, count }) => `${STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status}: ${count}`}
                        >
                          {attendanceData.byStatus.map((_, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                    <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.statusBreakdown')}</h3>
                    <div className="space-y-3">
                      {attendanceData.byStatus.map((s, i: number) => (
                        <div key={s.status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-sm">{STATUS_LABELS[s.status] ? t(STATUS_LABELS[s.status]) : s.status}</span>
                          </div>
                          <span className="text-sm font-medium">{formatNumber(s.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ LEAVE ═══ */}
          {activeTab === 'leave' && leaveData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('ops.reports.stats.totalRequests')} value={formatNumber(leaveData.totalRequests)} />
                <StatCard label={t('ops.reports.stats.totalDays')} value={formatNumber(leaveData.totalDays)} />
                <StatCard label={t('ops.reports.stats.departments')} value={formatNumber(leaveData.byDepartmentCount)} />
              </div>
              {leaveData.byType.length === 0 ? (
                <EmptyState icon={<CalendarDays size={40} />} message={t('ops.reports.empty.leave')} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.leaveUsageByType')}</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={leaveData.byType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="leaveTypeName" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="totalDays" fill="#10b981" radius={[4, 4, 0, 0]} name={t('ops.reports.columns.totalDays')} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('ops.reports.columns.requests')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ PAYROLL ═══ */}
          {activeTab === 'payroll' && payrollData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('ops.reports.stats.totalEarnings')} value={formatCurrency(payrollData.summary.totalEarnings)} />
                <StatCard label={t('ops.reports.stats.totalDeductions')} value={formatCurrency(payrollData.summary.totalDeductions)} />
                <StatCard label={t('ops.reports.stats.totalNetPay')} value={formatCurrency(payrollData.summary.totalNetPay)} />
                <StatCard label={t('ops.reports.stats.totalEmployees')} value={formatNumber(payrollData.summary.totalEmployees)} />
              </div>
              {payrollData.runs.length === 0 ? (
                <EmptyState icon={<Banknote size={40} />} message={t('ops.reports.empty.payroll')} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.payrollRuns')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{t('ops.reports.columns.period')}</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{t('ops.reports.columns.employees')}</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{t('ops.reports.columns.earnings')}</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{t('ops.reports.columns.deductions')}</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{t('ops.reports.columns.netPay')}</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">{t('ops.reports.columns.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollData.runs.map((r) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3">{r.name}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(r.totalEmployees)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(Number(r.totalEarnings))}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(Number(r.totalDeductions))}</td>
                            <td className="py-2 px-3 text-right font-medium">{formatCurrency(Number(r.totalNetPay))}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TURNOVER ═══ */}
          {activeTab === 'turnover' && turnoverData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('ops.reports.stats.totalActive')} value={formatNumber(turnoverData.totalActive)} />
                <StatCard label={t('ops.reports.stats.newHires')} value={formatNumber(turnoverData.newHires)} />
                <StatCard label={t('ops.reports.stats.resignations')} value={formatNumber(turnoverData.resignations)} />
                <StatCard label={t('ops.reports.stats.turnoverRate')} value={`${turnoverData.turnoverRate}%`} />
              </div>
              {turnoverData.monthly.length === 0 ? (
                <EmptyState icon={<TrendingUp size={40} />} message={t('ops.reports.empty.turnover')} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.monthlyHiresVsResignations')}</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={turnoverData.monthly.map((m) => ({
                        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
                        hires: m.hires,
                        resigns: m.resigns,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="hires" stroke="#10b981" strokeWidth={2} name={t('ops.reports.stats.newHires')} />
                      <Line type="monotone" dataKey="resigns" stroke="#ef4444" strokeWidth={2} name={t('ops.reports.stats.resignations')} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ RECRUITMENT ═══ */}
          {activeTab === 'recruitment' && recruitmentData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t('ops.reports.stats.totalApplications')} value={formatNumber(recruitmentData.totalApplications)} />
                <StatCard label={t('ops.reports.stats.activePostings')} value={formatNumber(recruitmentData.totalPostings)} />
                <StatCard label={t('ops.reports.stats.availableCandidates')} value={formatNumber(recruitmentData.totalCandidates)} />
              </div>
              {recruitmentData.byStage.length === 0 ? (
                <EmptyState icon={<UserSquare2 size={40} />} message={t('ops.reports.empty.recruitment')} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">{t('ops.reports.charts.applicationsByStage')}</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={recruitmentData.byStage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
