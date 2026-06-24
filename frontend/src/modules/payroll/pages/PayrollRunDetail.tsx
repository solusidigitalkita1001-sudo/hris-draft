import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { payrollService, type PayrollRun } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';

export function PayrollRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await payrollService.getPayrollRun(id);
      setRun(data);
    } catch (error) {
      console.error('Failed to fetch payroll run:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await payrollService.approvePayrollRun(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await payrollService.disbursePayrollRun(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to disburse:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Payroll run not found</p>
        <Button variant="link" onClick={() => navigate('/payroll/runs')}>Back to Payroll Runs</Button>
      </div>
    );
  }

  const totalEarnings = Number(run.totalEarnings);
  const totalDeductions = Number(run.totalDeductions);
  const totalNetPay = Number(run.totalNetPay);

  return (
    <div>
      <PageHeader
        title={run.name}
        description={`Run #${run.runNumber} · ${run.period?.name || ''}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/runs')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Employees</p>
          <p className="text-2xl font-semibold">{run.totalEmployees}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Earnings</p>
          <p className="text-2xl font-semibold">Rp {totalEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Deductions</p>
          <p className="text-2xl font-semibold text-red-600">Rp {totalDeductions.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Net Pay</p>
          <p className="text-2xl font-semibold text-emerald-600">Rp {totalNetPay.toLocaleString()}</p>
        </div>
      </div>

      {/* Actions */}
      {run.status === 'COMPLETED' && (
        <div className="flex gap-2 mb-6">
          <Button onClick={handleApprove} disabled={actionLoading}>
            <CheckCircle2 size={16} className="mr-2" />
            Approve Payroll
          </Button>
        </div>
      )}

      {run.status === 'APPROVED' && (
        <div className="flex gap-2 mb-6">
          <Button onClick={handleDisburse} disabled={actionLoading}>
            <Send size={16} className="mr-2" />
            Disburse Payroll
          </Button>
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 mb-6">
        <h3 className="text-sm font-medium mb-3">Status</h3>
        <div className="flex items-center gap-4">
          <StatusStep label="Draft" active={true} completed={run.status !== 'DRAFT'} />
          <div className="h-px flex-1 bg-border" />
          <StatusStep label="Processing" active={run.status === 'PROCESSING'} completed={['COMPLETED', 'APPROVED', 'DISBURSED'].includes(run.status)} />
          <div className="h-px flex-1 bg-border" />
          <StatusStep label="Completed" active={run.status === 'COMPLETED'} completed={['APPROVED', 'DISBURSED'].includes(run.status)} />
          <div className="h-px flex-1 bg-border" />
          <StatusStep label="Approved" active={run.status === 'APPROVED'} completed={run.status === 'DISBURSED'} />
          <div className="h-px flex-1 bg-border" />
          <StatusStep label="Disbursed" active={run.status === 'DISBURSED'} completed={false} />
        </div>
      </div>

      {/* Payslips Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium">Payslips ({run.payslips?.length || 0})</h3>
        </div>
        <div className="table-container">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employee</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Base Salary</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Earnings</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Deductions</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Net Pay</th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {run.payslips?.map((payslip) => (
                <tr
                  key={payslip.id}
                  className="table-row-hover cursor-pointer"
                  onClick={() => navigate(`/payroll/payslips/${payslip.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{payslip.employee?.fullName || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{payslip.employee?.employeeNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">Rp {Number(payslip.baseSalary).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-600">Rp {Number(payslip.totalEarnings).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-red-600">Rp {Number(payslip.totalDeductions).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">Rp {Number(payslip.netPay).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400">
                      {payslip.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!run.payslips || run.payslips.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                    No payslips generated yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusStep({ label, active, completed }: { label: string; active: boolean; completed: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${active ? 'text-primary font-medium' : completed ? 'text-emerald-600' : 'text-muted-foreground'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        completed ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950' :
        active ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400 dark:bg-gray-900'
      }`}>
        {completed ? <CheckCircle2 size={14} /> : <div className="w-2 h-2 rounded-full bg-current" />}
      </div>
      <span>{label}</span>
    </div>
  );
}
