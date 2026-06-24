import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollService, type PayrollRun } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, ScrollText } from 'lucide-react';
import { formatDate } from '@/utils/format';

export function PayrollRunList() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await payrollService.getPayrollRuns(companyId);
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch payroll runs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = runs.filter(
    (r) => r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Payroll Runs"
        description="Process, approve, and manage payroll runs"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/payroll/runs/new')}>
              <Plus size={16} className="mr-2" />
              New Run
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search runs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Run</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Period</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employees</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Earnings</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Deductions</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Net Pay</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ScrollText size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No payroll runs yet</p>
                    <p className="text-xs text-muted-foreground">Create a payroll period and run payroll to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((run) => (
                <tr
                  key={run.id}
                  className="table-row-hover cursor-pointer"
                  onClick={() => navigate(`/payroll/runs/${run.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{run.name}</p>
                    <p className="text-xs text-muted-foreground">#{run.runNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{run.period?.name || '-'}</td>
                  <td className="px-4 py-3 text-center text-sm">{run.totalEmployees}</td>
                  <td className="px-4 py-3 text-right text-sm">Rp {Number(run.totalEarnings).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm">Rp {Number(run.totalDeductions).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">Rp {Number(run.totalNetPay).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(run.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
