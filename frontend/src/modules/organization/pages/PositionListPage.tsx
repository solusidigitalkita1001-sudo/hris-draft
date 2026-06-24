import { useState, useEffect, useCallback } from 'react';
import { organizationService, type Position, type Department } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Briefcase } from 'lucide-react';

export function PositionListPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const [posData, deptData] = await Promise.all([
        organizationService.getPositions(companyId, deptFilter || undefined),
        organizationService.getDepartments(companyId),
      ]);
      setPositions(posData);
      setDepartments(deptData);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setLoading(false);
    }
  }, [deptFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = positions.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Manage job positions and grade levels"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              Add Position
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Position</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Department</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Grade</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Briefcase size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No positions found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((pos) => (
                <tr key={pos.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                        <Briefcase size={16} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-sm font-medium">{pos.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{pos.code}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {pos.departmentId ? deptMap.get(pos.departmentId) || '-' : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {pos.gradeLevel != null ? `Level ${pos.gradeLevel}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      pos.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                    }`}>
                      {pos.status}
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
