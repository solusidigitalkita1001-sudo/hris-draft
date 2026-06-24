import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeService, type Employee } from '@/services/employee.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, UserRound, Mail, Phone, Building2, Briefcase,
  CalendarDays, BadgeCheck,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/format';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await employeeService.getEmployee(id);
      setEmployee(data);
    } catch (error) {
      console.error('Failed to fetch employee:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Employee not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/employees')}>
          Back to Employees
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={employee.fullName}
        description={`#${employee.employeeNumber}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Personal Info */}
        <div className="space-y-6">
          {/* Avatar & Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
              {employee.avatar ? (
                <img src={employee.avatar} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <UserRound size={36} className="text-primary" />
              )}
            </div>
            <h2 className="text-lg font-semibold">{employee.fullName}</h2>
            <p className="text-sm text-muted-foreground">{employee.position?.name || '-'}</p>
            <div className="mt-4 space-y-2 text-left text-sm">
              {employee.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail size={14} /> {employee.email}
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone size={14} /> {employee.phone}
                </div>
              )}
            </div>
          </div>

          {/* Personal Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-3">Personal Details</h3>
            <div className="space-y-2 text-sm">
              {employee.gender && (
                <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span>{employee.gender}</span></div>
              )}
              {employee.religion && (
                <div className="flex justify-between"><span className="text-muted-foreground">Religion</span><span>{employee.religion}</span></div>
              )}
              {employee.maritalStatus && (
                <div className="flex justify-between"><span className="text-muted-foreground">Marital Status</span><span>{employee.maritalStatus}</span></div>
              )}
              {employee.idNumber && (
                <div className="flex justify-between"><span className="text-muted-foreground">ID Number</span><span>{employee.idNumber}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Center - Employment & Organization */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Building2 size={14} /> Department
              </div>
              <p className="text-sm font-medium">{employee.department?.name || '-'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Briefcase size={14} /> Position
              </div>
              <p className="text-sm font-medium">{employee.position?.name || '-'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays size={14} /> Join Date
              </div>
              <p className="text-sm font-medium">{employee.joinDate ? formatDate(employee.joinDate) : '-'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <BadgeCheck size={14} /> Type
              </div>
              <p className="text-sm font-medium">{employee.employmentType}</p>
            </div>
          </div>

          {/* Bank & Tax Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-3">Bank & Tax Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                <p>{employee.bankName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bank Account</p>
                <p className="font-mono">{employee.bankAccount || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Account Holder</p>
                <p>{employee.bankAccountHolder || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tax ID (NPWP)</p>
                <p className="font-mono">{employee.taxId || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">BPJS Ketenagakerjaan</p>
                <p className="font-mono">{employee.bpjsKetenagakerjaan || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">BPJS Kesehatan</p>
                <p className="font-mono">{employee.bpjsKesehatan || '-'}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          {employee.address && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Address</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{employee.address}</p>
            </div>
          )}

          {/* Created Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-2">Record Info</h3>
            <p className="text-xs text-muted-foreground">Created: {formatDateTime(employee.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
