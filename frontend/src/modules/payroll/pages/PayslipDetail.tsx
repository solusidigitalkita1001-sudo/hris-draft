import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { payrollService, type Payslip } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';

export function PayslipDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await payrollService.getPayslip(id);
      setPayslip(data);
    } catch (error) {
      console.error('Failed to fetch payslip:', error);
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

  if (!payslip) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Payslip not found</p>
        <Button variant="link" onClick={() => navigate('/payroll/runs')}>Back</Button>
      </div>
    );
  }

  const allowances = payslip.components.filter((c) => c.type === 'ALLOWANCE');
  const deductions = payslip.components.filter((c) => c.type === 'DEDUCTION');

  return (
    <div>
      <PageHeader
        title="Payslip"
        description={`${payslip.employee?.fullName || ''} · ${payslip.employee?.employeeNumber || ''}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer size={16} className="mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-2" />
              PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </div>
        }
      />

      {/* Payslip Card */}
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-border shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border text-center">
          <h2 className="text-lg font-semibold">PAYSLIP</h2>
          <p className="text-xs text-muted-foreground">
            {payslip.payrollRun?.period ? `${payslip.payrollRun.period.name}` : ''}
          </p>
        </div>

        {/* Employee Info */}
        <div className="px-6 py-4 border-b border-border grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Employee</p>
            <p className="font-medium">{payslip.employee?.fullName || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Employee ID</p>
            <p className="font-medium">{payslip.employee?.employeeNumber || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Base Salary</p>
            <p className="font-medium">Rp {Number(payslip.baseSalary).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              {payslip.status}
            </span>
          </div>
        </div>

        {/* Earnings */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium mb-3">Earnings</h3>
          <div className="space-y-2">
            {allowances.map((comp) => (
              <div key={comp.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{comp.name}</span>
                <span>Rp {Number(comp.amount).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-border">
              <span>Total Earnings</span>
              <span className="text-emerald-600">Rp {Number(payslip.totalEarnings).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium mb-3">Deductions</h3>
          <div className="space-y-2">
            {deductions.map((comp) => (
              <div key={comp.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{comp.name}</span>
                <span>Rp {Number(comp.amount).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-border">
              <span>Total Deductions</span>
              <span className="text-red-600">Rp {Number(payslip.totalDeductions).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Net Pay */}
        <div className="px-6 py-4">
          <div className="flex justify-between text-base font-semibold">
            <span>Net Pay</span>
            <span className="text-emerald-600">Rp {Number(payslip.netPay).toLocaleString()}</span>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-xl border-t border-border">
          <div className="grid grid-cols-5 gap-4 text-center text-xs">
            <div>
              <p className="font-medium">{payslip.workDays}</p>
              <p className="text-muted-foreground">Work Days</p>
            </div>
            <div>
              <p className="font-medium">{payslip.presentDays}</p>
              <p className="text-muted-foreground">Present</p>
            </div>
            <div>
              <p className="font-medium">{payslip.leaveDays}</p>
              <p className="text-muted-foreground">Leave</p>
            </div>
            <div>
              <p className="font-medium">{payslip.absentDays}</p>
              <p className="text-muted-foreground">Absent</p>
            </div>
            <div>
              <p className="font-medium">{payslip.overtimeHours}</p>
              <p className="text-muted-foreground">Overtime (h)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
