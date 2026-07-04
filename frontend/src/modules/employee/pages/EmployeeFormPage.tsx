import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeService } from '@/services/employee.service';
import { organizationService, type Department, type Position, type Branch } from '@/services/organization.service';
import { workCalendarService, type ShiftFormula } from '@/services/work-calendar.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING'] as const;
const EMPLOYEE_CATEGORIES = ['OFFICE', 'FACTORY', 'FIELD', 'REMOTE'] as const;
type EmployeeCategory = typeof EMPLOYEE_CATEGORIES[number];

export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shiftFormulas, setShiftFormulas] = useState<ShiftFormula[]>([]);

  const [form, setForm] = useState({
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    gender: '',
    religion: '',
    maritalStatus: '',
    address: '',
    departmentId: '',
    positionId: '',
    branchId: '',
    employmentType: 'PERMANENT' as string,
    employeeCategory: 'OFFICE' as EmployeeCategory,
    shiftFormulaId: '',
    shiftStartDate: '',
    joinDate: '',
    bankName: '',
    bankAccount: '',
    bankAccountHolder: '',
    taxId: '',
    bpjsKetenagakerjaan: '',
    bpjsKesehatan: '',
  });

  const companyId = localStorage.getItem('companyId') || '';

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [deptData, posData, branchData, shiftFormulaData] = await Promise.all([
          organizationService.getDepartments(companyId),
          organizationService.getPositions(companyId),
          organizationService.getBranches(companyId),
          workCalendarService.findAllShiftFormulas(companyId),
        ]);
        setDepartments(deptData);
        setPositions(posData);
        setBranches(branchData);
        setShiftFormulas(shiftFormulaData);
      } catch (error) {
        console.error('Failed to fetch reference data:', error);
      }
    };
    fetchRefs();
  }, [companyId]);

  useEffect(() => {
    if (id) {
      const fetchEmployee = async () => {
        try {
          const emp = await employeeService.getEmployee(id);
          setForm({
            employeeNumber: emp.employeeNumber,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email || '',
            phone: emp.phone || '',
            idNumber: emp.idNumber || '',
            gender: emp.gender || '',
            religion: emp.religion || '',
            maritalStatus: emp.maritalStatus || '',
            address: emp.address || '',
            departmentId: emp.departmentId || '',
            positionId: emp.positionId || '',
            branchId: emp.branchId || '',
            employmentType: emp.employmentType,
            employeeCategory: emp.employeeCategory || 'OFFICE',
            shiftFormulaId: emp.shiftFormulaId || '',
            shiftStartDate: emp.shiftStartDate ? emp.shiftStartDate.split('T')[0] : '',
            joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : '',
            bankName: emp.bankName || '',
            bankAccount: emp.bankAccount || '',
            bankAccountHolder: emp.bankAccountHolder || '',
            taxId: emp.taxId || '',
            bpjsKetenagakerjaan: emp.bpjsKetenagakerjaan || '',
            bpjsKesehatan: emp.bpjsKesehatan || '',
          });
        } catch (error) {
          console.error('Failed to fetch employee:', error);
        }
      };
      fetchEmployee();
    }
  }, [id]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      if (field === 'employeeCategory' && value !== 'FACTORY') {
        return { ...prev, employeeCategory: value as EmployeeCategory, shiftFormulaId: '', shiftStartDate: '' };
      }

      if (field === 'employeeCategory') {
        return { ...prev, employeeCategory: value as EmployeeCategory };
      }

      return { ...prev, [field]: value } as typeof prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        companyId,
        joinDate: form.joinDate ? new Date(form.joinDate).toISOString() : undefined,
        shiftStartDate: form.shiftStartDate ? new Date(form.shiftStartDate).toISOString() : null,
        shiftFormulaId: form.shiftFormulaId || null,
      };

      if (isEdit) {
        await employeeService.updateEmployee(id!, payload);
      } else {
        await employeeService.createEmployee(payload);
      }
      navigate('/employees');
    } catch (error) {
      console.error('Failed to save employee:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        description={isEdit ? `Editing ${form.firstName} ${form.lastName}` : 'Create a new employee record'}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Info */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee Number *</label>
                  <Input value={form.employeeNumber} onChange={(e) => handleChange('employeeNumber', e.target.value)} required className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ID Number (KTP)</label>
                  <Input value={form.idNumber} onChange={(e) => handleChange('idNumber', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name *</label>
                  <Input value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} required className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name *</label>
                  <Input value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} required className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                  <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Gender</label>
                  <Select2
                    value={form.gender}
                    onValueChange={(value) => handleChange('gender', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Religion</label>
                  <Select2
                    value={form.religion}
                    onValueChange={(value) => handleChange('religion', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'Islam', label: 'Islam' },
                      { value: 'Christian', label: 'Christian' },
                      { value: 'Catholic', label: 'Catholic' },
                      { value: 'Hindu', label: 'Hindu' },
                      { value: 'Buddha', label: 'Buddha' },
                      { value: 'Other', label: 'Other' },
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Marital Status</label>
                  <Select2
                    value={form.maritalStatus}
                    onValueChange={(value) => handleChange('maritalStatus', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'Single', label: 'Single' },
                      { value: 'Married', label: 'Married' },
                      { value: 'Divorced', label: 'Divorced' },
                      { value: 'Widowed', label: 'Widowed' },
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Address</label>
                  <textarea value={form.address} onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Organization & Employment */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-4">Organization & Employment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
                  <Select2
                    value={form.departmentId}
                    onValueChange={(value) => handleChange('departmentId', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      ...departments.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Position</label>
                  <Select2
                    value={form.positionId}
                    onValueChange={(value) => handleChange('positionId', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      ...positions.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Branch</label>
                  <Select2
                    value={form.branchId}
                    onValueChange={(value) => handleChange('branchId', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      ...branches.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Employment Type</label>
                  <Select2
                    value={form.employmentType}
                    onValueChange={(value) => handleChange('employmentType', value)}
                    options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee Category</label>
                  <Select2
                    value={form.employeeCategory}
                    onValueChange={(value) => handleChange('employeeCategory', value)}
                    options={EMPLOYEE_CATEGORIES.map((category) => ({ value: category, label: category }))}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Join Date</label>
                  <Input type="date" value={form.joinDate} onChange={(e) => handleChange('joinDate', e.target.value)} className="h-9" />
                </div>
                {form.employeeCategory === 'FACTORY' && (
                  <>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Formula</label>
                      <Select2
                        value={form.shiftFormulaId}
                        onValueChange={(value) => handleChange('shiftFormulaId', value)}
                        options={[
                          { value: '', label: 'Select...' },
                          ...shiftFormulas.map((formula) => ({ value: formula.id, label: `${formula.code} - ${formula.name}` })),
                        ]}
                        placeholder="Select..."
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Start Date</label>
                      <Input type="date" value={form.shiftStartDate} onChange={(e) => handleChange('shiftStartDate', e.target.value)} className="h-9" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bank & Tax */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-4">Bank & Tax Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank Name</label>
                  <Select2
                    value={form.bankName}
                    onValueChange={(value) => handleChange('bankName', value)}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'BCA', label: 'BCA' },
                      { value: 'Mandiri', label: 'Mandiri' },
                      { value: 'BNI', label: 'BNI' },
                      { value: 'BRI', label: 'BRI' },
                      { value: 'BSI', label: 'BSI' },
                    ]}
                    placeholder="Select..."
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank Account</label>
                  <Input value={form.bankAccount} onChange={(e) => handleChange('bankAccount', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Holder</label>
                  <Input value={form.bankAccountHolder} onChange={(e) => handleChange('bankAccountHolder', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tax ID (NPWP)</label>
                  <Input value={form.taxId} onChange={(e) => handleChange('taxId', e.target.value)} className="h-9" placeholder="XX.XXX.XXX.X-XXX.XXX" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">BPJS Ketenagakerjaan</label>
                  <Input value={form.bpjsKetenagakerjaan} onChange={(e) => handleChange('bpjsKetenagakerjaan', e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">BPJS Kesehatan</label>
                  <Input value={form.bpjsKesehatan} onChange={(e) => handleChange('bpjsKesehatan', e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={() => navigate('/employees')}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
            {saving ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
