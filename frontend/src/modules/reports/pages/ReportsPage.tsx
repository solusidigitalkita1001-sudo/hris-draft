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

interface TabConfig { key: ReportTab; label: string; icon: React.ReactNode }

const TABS: TabConfig[] = [
  { key: 'headcount', label: 'Headcount', icon: <Users size={16} /> },
  { key: 'attendance', label: 'Attendance', icon: <Clock size={16} /> },
  { key: 'leave', label: 'Leave', icon: <CalendarDays size={16} /> },
  { key: 'payroll', label: 'Payroll', icon: <Banknote size={16} /> },
  { key: 'turnover', label: 'Turnover', icon: <TrendingUp size={16} /> },
  { key: 'recruitment', label: 'Recruitment', icon: <UserSquare2 size={16} /> },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Hadir', ABSENT: 'Absen', LATE: 'Terlambat', EXCUSED: 'Izin',
  PENDING: 'Pending', APPROVED: 'Disetujui', REJECTED: 'Ditolak',
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
      setError('companyId tidak tersedia');
      setLoading(false);
      return;
    }

    if (dayjs(endDate).isBefore(dayjs(startDate), 'day')) {
      setError('Tanggal tidak valid: endDate lebih kecil dari startDate');
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
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [companyId, endDate, getFetchKey, lastFetchKeyByTab, periodId, reportData, startDate]);

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
        const rows = [['Department', 'Count']];
        headcountData.byDepartment.forEach((d) => rows.push([d.departmentName, String(d.count)]));
        downloadCSV(rows, `headcount-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'attendance': {
        if (!attendanceData) return;
        const rows = [['Status', 'Count']];
        attendanceData.byStatus.forEach((s) => rows.push([STATUS_LABELS[s.status] || s.status, String(s.count)]));
        rows.push(['Terlambat', String(attendanceData.lateCount)]);
        downloadCSV(rows, `attendance-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'leave': {
        if (!leaveData) return;
        const rows = [['Leave Type', 'Requests', 'Total Days']];
        leaveData.byType.forEach((t) => rows.push([t.leaveTypeName, String(t.count), String(t.totalDays)]));
        downloadCSV(rows, `leave-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'payroll': {
        if (!payrollData) return;
        const rows = [['Period', 'Employees', 'Earnings', 'Deductions', 'Net Pay']];
        payrollData.runs.forEach((r) =>
          rows.push([r.name, String(r.totalEmployees), String(r.totalEarnings), String(r.totalDeductions), String(r.totalNetPay)])
        );
        downloadCSV(rows, `payroll-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'turnover': {
        if (!turnoverData) return;
        const rows = [['Month', 'Hires', 'Resignations']];
        turnoverData.monthly.forEach((m) =>
          rows.push([`${m.year}-${String(m.month).padStart(2, '0')}`, String(m.hires), String(m.resigns)])
        );
        downloadCSV(rows, `turnover-${now.format('YYYY-MM')}.csv`);
        break;
      }
      case 'recruitment': {
        if (!recruitmentData) return;
        const rows = [['Stage', 'Count']];
        recruitmentData.byStage.forEach((s) => rows.push([s.stage, String(s.count)]));
        downloadCSV(rows, `recruitment-${now.format('YYYY-MM')}.csv`);
        break;
      }
    }
  }, [activeTab, headcountData, attendanceData, leaveData, payrollData, turnoverData, recruitmentData, now]);

  // ─── Render ───────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Custom reports and analytics"
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
                    { value: '', label: 'All Periods' },
                    ...payrollPeriods.map((p) => ({ value: p.id, label: `${p.name} • ${p.status}` })),
                  ]}
                  placeholder="Filter period"
                  className="h-9 text-xs"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => void fetchReport(activeTab, true)}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={exportCSV} disabled={loading || !activeTabData}>
              <Download size={16} className="mr-2" /> Export CSV
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
            {tab.icon} {tab.label}
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
          <div className="text-sm text-muted-foreground">Loading reports...</div>
        </div>
      )}

      {/* ─── Content ─────────────────────────────────── */}
      {!loading && !error && !activeTabData && (
        <EmptyState icon={<BarChart3 size={40} />} message="Belum ada data untuk tab ini" />
      )}

      {!loading && !error && activeTabData && (
        <>
          {/* ═══ HEADCOUNT ═══ */}
          {activeTab === 'headcount' && headcountData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Employees" value={formatNumber(headcountData.total)} />
                <StatCard label="Departments" value={formatNumber(headcountData.byDepartment.length)} />
                {headcountData.byStatus.map((s: any) => (
                  <StatCard key={s.status} label={`Status: ${s.status}`} value={formatNumber(s.count)} />
                ))}
              </div>
              {headcountData.byDepartment.length === 0 ? (
                <EmptyState icon={<BarChart3 size={40} />} message="No employee data available" />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">Employees by Department</h3>
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
                <StatCard label="Total Records" value={formatNumber(attendanceData.total)} />
                <StatCard label="Late Count" value={formatNumber(attendanceData.lateCount)} sub={`${attendanceData.lateRate}% late rate`} />
              </div>
              {attendanceData.byStatus.length === 0 ? (
                <EmptyState icon={<PieChartIcon size={40} />} message="No attendance data for this period" />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                    <h3 className="text-sm font-medium mb-4">Attendance Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={attendanceData.byStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%" cy="50%"
                          outerRadius={100}
                          label={({ status, count }) => `${STATUS_LABELS[status] || status}: ${count}`}
                        >
                          {attendanceData.byStatus.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                    <h3 className="text-sm font-medium mb-4">Status Breakdown</h3>
                    <div className="space-y-3">
                      {attendanceData.byStatus.map((s: any, i: number) => (
                        <div key={s.status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-sm">{STATUS_LABELS[s.status] || s.status}</span>
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
                <StatCard label="Total Requests" value={formatNumber(leaveData.totalRequests)} />
                <StatCard label="Total Days" value={formatNumber(leaveData.totalDays)} />
                <StatCard label="Departments" value={formatNumber(leaveData.byDepartmentCount)} />
              </div>
              {leaveData.byType.length === 0 ? (
                <EmptyState icon={<CalendarDays size={40} />} message="No leave data for this period" />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">Leave Usage by Type</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={leaveData.byType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="leaveTypeName" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="totalDays" fill="#10b981" radius={[4, 4, 0, 0]} name="Total Days" />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Requests" />
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
                <StatCard label="Total Earnings" value={formatCurrency(payrollData.summary.totalEarnings)} />
                <StatCard label="Total Deductions" value={formatCurrency(payrollData.summary.totalDeductions)} />
                <StatCard label="Total Net Pay" value={formatCurrency(payrollData.summary.totalNetPay)} />
                <StatCard label="Total Employees" value={formatNumber(payrollData.summary.totalEmployees)} />
              </div>
              {payrollData.runs.length === 0 ? (
                <EmptyState icon={<Banknote size={40} />} message="No payroll data available" />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">Payroll Runs</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Period</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Employees</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Earnings</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Deductions</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Net Pay</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollData.runs.map((r: any) => (
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
                <StatCard label="Total Active" value={formatNumber(turnoverData.totalActive)} />
                <StatCard label="New Hires" value={formatNumber(turnoverData.newHires)} />
                <StatCard label="Resignations" value={formatNumber(turnoverData.resignations)} />
                <StatCard label="Turnover Rate" value={`${turnoverData.turnoverRate}%`} />
              </div>
              {turnoverData.monthly.length === 0 ? (
                <EmptyState icon={<TrendingUp size={40} />} message="No turnover data for this period" />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">Monthly Hires vs Resignations</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={turnoverData.monthly.map((m: any) => ({
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
                      <Line type="monotone" dataKey="hires" stroke="#10b981" strokeWidth={2} name="New Hires" />
                      <Line type="monotone" dataKey="resigns" stroke="#ef4444" strokeWidth={2} name="Resignations" />
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
                <StatCard label="Total Applications" value={formatNumber(recruitmentData.totalApplications)} />
                <StatCard label="Active Postings" value={formatNumber(recruitmentData.totalPostings)} />
                <StatCard label="Available Candidates" value={formatNumber(recruitmentData.totalCandidates)} />
              </div>
              {recruitmentData.byStage.length === 0 ? (
                <EmptyState icon={<UserSquare2 size={40} />} message="No recruitment data for this period" />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                  <h3 className="text-sm font-medium mb-4">Applications by Stage</h3>
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
