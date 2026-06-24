import { useState, useEffect, useCallback } from 'react';
import { payrollService, type PayrollRun } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw, Banknote, Users, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PayrollDashboard() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await payrollService.getPayrollRuns(companyId);
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch payroll data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latestRun = runs[0];
  const totalApproved = runs.filter((r) => r.status === 'APPROVED' || r.status === 'DISBURSED').length;
  const totalDisbursed = runs.filter((r) => r.status === 'DISBURSED').length;

  return (
    <div>
      <PageHeader
        title="Payroll Dashboard"
        description="Overview of payroll activities"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <Banknote size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-semibold">
            {latestRun ? `Rp ${Number(latestRun.totalNetPay).toLocaleString()}` : '0'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Latest Net Pay Total</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <Users size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-semibold">{latestRun?.totalEmployees || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Employees Paid</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-semibold">{totalApproved}</p>
          <p className="text-xs text-muted-foreground mt-1">Payroll Runs Approved</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
              <ArrowUpRight size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-semibold">{totalDisbursed}</p>
          <p className="text-xs text-muted-foreground mt-1">Disbursed</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => navigate('/payroll/salary-components')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-border hover:border-primary/50 transition-colors text-left"
        >
          <h3 className="font-medium text-sm">Salary Components</h3>
          <p className="text-xs text-muted-foreground mt-1">Manage allowances and deductions</p>
        </button>
        <button
          onClick={() => navigate('/payroll/periods')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-border hover:border-primary/50 transition-colors text-left"
        >
          <h3 className="font-medium text-sm">Payroll Periods</h3>
          <p className="text-xs text-muted-foreground mt-1">Manage payroll schedule</p>
        </button>
        <button
          onClick={() => navigate('/payroll/runs')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-border hover:border-primary/50 transition-colors text-left"
        >
          <h3 className="font-medium text-sm">Payroll Runs</h3>
          <p className="text-xs text-muted-foreground mt-1">Process, approve, and disburse</p>
        </button>
      </div>

      {/* Recent Payroll Runs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">Recent Payroll Runs</h3>
        </div>
        <div className="table-container">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Run</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Period</th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employees</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Total Net</th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    No payroll runs yet. Start by creating a payroll period.
                  </td>
                </tr>
              ) : (
                runs.slice(0, 5).map((run) => (
                  <tr key={run.id} className="table-row-hover cursor-pointer" onClick={() => navigate(`/payroll/runs/${run.id}`)}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{run.name}</p>
                      <p className="text-xs text-muted-foreground">#{run.runNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{run.period?.name || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm">{run.totalEmployees}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      Rp {Number(run.totalNetPay).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={run.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
    PROCESSING: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    APPROVED: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    DISBURSED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.DRAFT}`}>
      {status}
    </span>
  );
}
