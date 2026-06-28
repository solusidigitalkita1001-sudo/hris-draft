import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeService, type Employee } from '@/services/employee.service';
import { organizationService, type Department } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Plus, Search, RefreshCw, Users, ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { formatDate } from '@/utils/format';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  PROBATION: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  RESIGNED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  TERMINATED: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  CONTRACT_END: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function EmployeeListPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';

      const [empResult, deptData] = await Promise.all([
        employeeService.getEmployees({
          companyId,
          departmentId: deptFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: 20,
        }),
        organizationService.getDepartments(companyId),
      ]);

      setEmployees(empResult.data);
      setTotalPages(empResult.totalPages);
      setDepartments(deptData);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  }, [deptFilter, statusFilter, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [deptFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee master data"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/employees/new')}>
              <Plus size={16} className="mr-2" />
              Add Employee
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select2
          value={deptFilter}
          onValueChange={setDeptFilter}
          options={[
            { value: '', label: 'All Departments' },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          className="h-9 text-xs"
        />

        <div className="flex gap-1">
          {['', 'ACTIVE', 'PROBATION', 'RESIGNED', 'TERMINATED', 'CONTRACT_END'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employee</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Number</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Department</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Position</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Join Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No employees found</p>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr
                  key={emp.id}
                  className="table-row-hover cursor-pointer"
                  onClick={() => navigate(`/employees/${emp.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {emp.avatar ? (
                          <img src={emp.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <UserRound size={16} className="text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{emp.fullName}</p>
                        {emp.email && (
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{emp.employeeNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{emp.position?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{emp.employmentType}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={emp.employmentStatus} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {emp.joinDate ? formatDate(emp.joinDate) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
