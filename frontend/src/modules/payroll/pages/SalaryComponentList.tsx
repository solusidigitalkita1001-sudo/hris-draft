import { useState, useEffect, useCallback } from 'react';
import { payrollService, type SalaryComponent } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Wallet, Percent } from 'lucide-react';

export function SalaryComponentList() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await payrollService.getSalaryComponents(companyId);
      setComponents(data);
    } catch (error) {
      console.error('Failed to fetch salary components:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = components.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Salary Components"
        description="Manage salary components such as allowances, deductions, and benefits"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              Add Component
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Component</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Method</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Amount/Rate</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Taxable</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Active</th>
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
                    <Wallet size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No salary components found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((comp) => (
                <tr key={comp.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        {comp.type === 'ALLOWANCE' ? (
                          <Wallet size={16} className="text-primary" />
                        ) : (
                          <Percent size={16} className="text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{comp.name}</p>
                        <p className="text-xs text-muted-foreground">{comp.description || comp.calculationMethod}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{comp.code}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.type === 'ALLOWANCE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                    }`}>
                      {comp.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{comp.calculationMethod}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    {comp.calculationMethod === 'PERCENTAGE'
                      ? `${comp.ratePercent}%`
                      : comp.amount
                        ? `Rp ${Number(comp.amount).toLocaleString()}`
                        : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.isTaxable
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                    }`}>
                      {comp.isTaxable ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                    }`}>
                      {comp.isActive ? 'Active' : 'Inactive'}
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
