import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { employeeService, type Employee, type CareerTransaction } from '@/services/employee.service';
import { organizationService, type Branch, type Department, type Position } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  ArrowLeft, UserRound, Mail, Phone, Building2, Briefcase,
  CalendarDays, BadgeCheck, Sparkles, Plus, ArrowRightLeft, Loader2,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/format';

const CAREER_TRANSACTION_TYPES = [
  'PROMOTION',
  'DEMOTION',
  'MUTATION',
  'TRANSFER',
  'ROTATION',
  'ACTING_ASSIGNMENT',
  'STATUS_CHANGE',
] as const;

const CAREER_TRANSACTION_LABELS: Record<(typeof CAREER_TRANSACTION_TYPES)[number], string> = {
  PROMOTION: 'Promotion',
  DEMOTION: 'Demotion',
  MUTATION: 'Mutation',
  TRANSFER: 'Transfer',
  ROTATION: 'Rotation',
  ACTING_ASSIGNMENT: 'Acting Assignment',
  STATUS_CHANGE: 'Status Change',
};

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING'] as const;

function ChangeRow({ label, from, to }: { label: string; from?: string | null; to?: string | null }) {
  if (!from && !to) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <span className="truncate">{from || '-'}</span>
        <ArrowRightLeft size={12} className="shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{to || '-'}</span>
      </div>
    </div>
  );
}

function CareerTransactionDialog({
  open,
  onClose,
  onSubmit,
  saving,
  branches,
  departments,
  positions,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    effectiveDate: string;
    transactionType: CareerTransaction['transactionType'];
    toBranchId?: string | null;
    toDepartmentId?: string | null;
    toPositionId?: string | null;
    toEmploymentType?: string | null;
    referenceNumber?: string;
    reason?: string;
    notes?: string;
  }) => Promise<void>;
  saving: boolean;
  branches: Branch[];
  departments: Department[];
  positions: Position[];
  employee: Employee | null;
}) {
  const [form, setForm] = useState({
    effectiveDate: new Date().toISOString().split('T')[0],
    transactionType: 'PROMOTION' as CareerTransaction['transactionType'],
    toBranchId: '',
    toDepartmentId: '',
    toPositionId: '',
    toEmploymentType: '',
    referenceNumber: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    if (!open || !employee) return;
    setForm({
      effectiveDate: new Date().toISOString().split('T')[0],
      transactionType: 'PROMOTION',
      toBranchId: employee.branchId || '',
      toDepartmentId: employee.departmentId || '',
      toPositionId: employee.positionId || '',
      toEmploymentType: employee.employmentType || '',
      referenceNumber: '',
      reason: '',
      notes: '',
    });
  }, [open, employee]);

  if (!open || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Career Transaction</p>
            <h3 className="mt-1 text-lg font-semibold">{employee.fullName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Simpan perubahan jabatan, department, branch, atau employment type.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              effectiveDate: new Date(form.effectiveDate).toISOString(),
              transactionType: form.transactionType,
              toBranchId: form.toBranchId || null,
              toDepartmentId: form.toDepartmentId || null,
              toPositionId: form.toPositionId || null,
              toEmploymentType: form.toEmploymentType || null,
              referenceNumber: form.referenceNumber || undefined,
              reason: form.reason || undefined,
              notes: form.notes || undefined,
            });
          }}
          className="p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Transaction Type</label>
              <Select2
                value={form.transactionType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, transactionType: value as CareerTransaction['transactionType'] }))}
                options={CAREER_TRANSACTION_TYPES.map((type) => ({
                  value: type,
                  label: CAREER_TRANSACTION_LABELS[type],
                }))}
                placeholder="Pilih transaksi"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Effective Date</label>
              <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))} required className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To Branch</label>
              <Select2
                value={form.toBranchId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toBranchId: value }))}
                options={[
                  { value: '', label: 'No branch' },
                  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
                placeholder="Pilih branch"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To Department</label>
              <Select2
                value={form.toDepartmentId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toDepartmentId: value }))}
                options={[
                  { value: '', label: 'No department' },
                  ...departments.map((department) => ({ value: department.id, label: department.name })),
                ]}
                placeholder="Pilih department"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To Position</label>
              <Select2
                value={form.toPositionId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toPositionId: value }))}
                options={[
                  { value: '', label: 'No position' },
                  ...positions.map((position) => ({ value: position.id, label: position.name })),
                ]}
                placeholder="Pilih position"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To Employment Type</label>
              <Select2
                value={form.toEmploymentType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toEmploymentType: value }))}
                options={[
                  { value: '', label: 'No change' },
                  ...EMPLOYMENT_TYPES.map((type) => ({ value: type, label: type })),
                ]}
                placeholder="Pilih employment type"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Reference Number</label>
              <Input value={form.referenceNumber} onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))} placeholder="SK/HR/2026/001" className="h-10" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Reason</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Alasan promosi / mutasi / perubahan status"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Catatan tambahan"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
              {saving ? 'Menyimpan...' : 'Simpan Transaction'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [transactions, setTransactions] = useState<CareerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const requestedEmployeeIdRef = useRef<string | null>(null);
  const requestedCompanyIdRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [employeeData, careerData] = await Promise.all([
        employeeService.getEmployee(id),
        employeeService.getCareerTransactions(id),
      ]);
      setEmployee(employeeData);
      setTransactions(careerData);
    } catch (error) {
      console.error('Failed to fetch employee:', error);
      toast.error('Gagal memuat data employee');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (requestedEmployeeIdRef.current === id) return;
    requestedEmployeeIdRef.current = id;
    fetchData();
  }, [fetchData, id]);

  useEffect(() => {
    const companyId = employee?.companyId || '';
    if (!companyId) return;
    if (requestedCompanyIdRef.current === companyId) return;
    requestedCompanyIdRef.current = companyId;

    const fetchRefs = async () => {
      try {
        const [departmentData, positionData, branchData] = await Promise.all([
          organizationService.getDepartments(companyId),
          organizationService.getPositions(companyId),
          organizationService.getBranches(companyId),
        ]);
        setDepartments(departmentData);
        setPositions(positionData);
        setBranches(branchData);
      } catch (error) {
        console.error('Failed to fetch organization refs:', error);
      }
    };

    fetchRefs();
  }, [employee?.companyId]);

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
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={16} className="mr-2" />
              Career Transaction
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </div>
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

          {/* Career Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Career Transactions</h3>
                <p className="text-xs text-muted-foreground">Riwayat promosi, mutasi, demosi, transfer, dan perubahan status.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus size={16} className="mr-2" />
                Add
              </Button>
            </div>

            {transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada career transaction untuk employee ini.
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                            <Sparkles size={12} className="mr-1" />
                            {CAREER_TRANSACTION_LABELS[transaction.transactionType]}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDate(transaction.effectiveDate)}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium">{transaction.referenceNumber || 'Tanpa nomor referensi'}</p>
                        {transaction.reason && (
                          <p className="mt-1 text-sm text-muted-foreground">{transaction.reason}</p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Dibuat {formatDateTime(transaction.createdAt)}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      <ChangeRow label="Branch" from={transaction.fromBranch?.name} to={transaction.toBranch?.name} />
                      <ChangeRow label="Department" from={transaction.fromDepartment?.name} to={transaction.toDepartment?.name} />
                      <ChangeRow label="Position" from={transaction.fromPosition?.name} to={transaction.toPosition?.name} />
                      <ChangeRow label="Employment Type" from={transaction.fromEmploymentType} to={transaction.toEmploymentType} />
                    </div>

                    {transaction.notes && (
                      <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {transaction.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CareerTransactionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employee={employee}
        saving={savingTransaction}
        branches={branches}
        departments={departments}
        positions={positions}
        onSubmit={async (payload) => {
          if (!id) return;
          try {
            setSavingTransaction(true);
            await employeeService.createCareerTransaction(id, payload);
            toast.success('Career transaction berhasil disimpan');
            setDialogOpen(false);
            await fetchData();
          } catch (error) {
            console.error('Failed to create career transaction:', error);
            toast.error('Gagal menyimpan career transaction');
          } finally {
            setSavingTransaction(false);
          }
        }}
      />
    </div>
  );
}
