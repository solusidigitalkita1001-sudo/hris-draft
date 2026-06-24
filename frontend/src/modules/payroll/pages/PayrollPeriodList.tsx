import { useState, useEffect, useCallback } from 'react';
import { payrollService, type PayrollPeriod } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, CalendarDays } from 'lucide-react';
import { formatDate } from '@/utils/format';

export function PayrollPeriodList() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await payrollService.getPayrollPeriods(companyId);
      setPeriods(data);
    } catch (error) {
      console.error('Failed to fetch periods:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = periods.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Payroll Periods"
        description="Manage payroll periods and schedule"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              Add Period
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search periods..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Period Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Frequency</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Start Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">End Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Pay Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
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
                    <CalendarDays size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No payroll periods found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((period) => (
                <tr key={period.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{period.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{period.code}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{period.frequency}</td>
                  <td className="px-4 py-3 text-center text-sm">{formatDate(period.startDate)}</td>
                  <td className="px-4 py-3 text-center text-sm">{formatDate(period.endDate)}</td>
                  <td className="px-4 py-3 text-center text-sm">{formatDate(period.payDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      period.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : period.status === 'CLOSED'
                          ? 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    }`}>
                      {period.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
