import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeService } from '@/services/employee.service';
import { organizationService, type Department, type Position, type Branch } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING'] as const;

export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

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
        const [deptData, posData, branchData] = await Promise.all([
          organizationService.getDepartments(companyId),
          organizationService.getPositions(companyId),
          organizationService.getBranches(companyId),
        ]);
        setDepartments(deptData);
        setPositions(posData);
        setBranches(branchData);
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
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        companyId,
        joinDate: form.joinDate ? new Date(form.joinDate).toISOString() : undefined,
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
                  <select value={form.gender} onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Religion</label>
                  <select value={form.religion} onChange={(e) => handleChange('religion', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    <option value="Islam">Islam</option>
                    <option value="Christian">Christian</option>
                    <option value="Catholic">Catholic</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Marital Status</label>
                  <select value={form.maritalStatus} onChange={(e) => handleChange('maritalStatus', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
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
                  <select value={form.departmentId} onChange={(e) => handleChange('departmentId', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Position</label>
                  <select value={form.positionId} onChange={(e) => handleChange('positionId', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Branch</label>
                  <select value={form.branchId} onChange={(e) => handleChange('branchId', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Employment Type</label>
                  <select value={form.employmentType} onChange={(e) => handleChange('employmentType', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    {EMPLOYMENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Join Date</label>
                  <Input type="date" value={form.joinDate} onChange={(e) => handleChange('joinDate', e.target.value)} className="h-9" />
                </div>
              </div>
            </div>

            {/* Bank & Tax */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-4">Bank & Tax Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank Name</label>
                  <select value={form.bankName} onChange={(e) => handleChange('bankName', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground">
                    <option value="">Select...</option>
                    <option value="BCA">BCA</option>
                    <option value="Mandiri">Mandiri</option>
                    <option value="BNI">BNI</option>
                    <option value="BRI">BRI</option>
                    <option value="BSI">BSI</option>
                  </select>
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
