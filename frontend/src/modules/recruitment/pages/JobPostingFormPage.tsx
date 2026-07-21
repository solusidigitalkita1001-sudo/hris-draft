import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useCompanyStore } from '@/stores/company.store';
import { organizationService, type Department, type Position } from '@/services/organization.service';
import { recruitmentService, type JobPostingPayload } from '@/services/recruitment.service';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'FULL_TIME' },
  { value: 'PART_TIME', label: 'PART_TIME' },
  { value: 'CONTRACT', label: 'CONTRACT' },
  { value: 'INTERNSHIP', label: 'INTERNSHIP' },
  { value: 'FREELANCE', label: 'FREELANCE' },
];

export function JobPostingFormPage() {
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const companyId = activeCompany?.id || '';
  const [form, setForm] = useState<JobPostingPayload>({
    companyId,
    departmentId: undefined,
    positionId: undefined,
    title: '',
    code: '',
    employmentType: 'FULL_TIME',
    location: '',
    minSalary: undefined,
    maxSalary: undefined,
    currency: 'IDR',
    description: '',
    requirements: '',
    responsibilities: '',
    vacancies: 1,
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, companyId }));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;

    const loadReferences = async () => {
      try {
        const [departmentData, positionData] = await Promise.all([
          organizationService.getDepartments(companyId),
          organizationService.getPositions(companyId),
        ]);
        setDepartments(departmentData);
        setPositions(positionData);
      } catch (error) {
        console.error(error);
        toast.error('Gagal memuat referensi recruitment');
      }
    };

    void loadReferences();
  }, [companyId]);

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!form.title.trim() || !form.code.trim()) {
      toast.error('Title dan code wajib diisi');
      return;
    }

    if (form.maxSalary !== undefined && form.minSalary !== undefined && form.maxSalary < form.minSalary) {
      toast.error('Max salary harus lebih besar atau sama dengan min salary');
      return;
    }

    setLoading(true);
    try {
      const payload: JobPostingPayload = {
        ...form,
        companyId,
        departmentId: form.departmentId || undefined,
        positionId: form.positionId || undefined,
        location: form.location?.trim() || undefined,
        currency: form.currency?.trim() || 'IDR',
        description: form.description?.trim() || undefined,
        requirements: form.requirements?.trim() || undefined,
        responsibilities: form.responsibilities?.trim() || undefined,
      };

      const created = await recruitmentService.createJobPosting(payload);
      toast.success('Job posting berhasil dibuat');
      navigate(`/recruitment/postings/${created.id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat job posting');
    } finally {
      setLoading(false);
    }
  }, [companyId, form, navigate]);

  return (
    <div>
      <PageHeader
        title="New Job Posting"
        description="Buat lowongan baru yang siap dipublish ke pipeline rekrutmen."
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Senior Frontend Engineer" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="REC-FE-001" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Department</label>
            <Select2
              value={form.departmentId || ''}
              onValueChange={(value) => setForm((prev) => ({ ...prev, departmentId: value || undefined }))}
              options={[{ value: '', label: 'Tanpa departemen' }, ...departments.map((item) => ({ value: item.id, label: item.name }))]}
              placeholder="Pilih departemen"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Position</label>
            <Select2
              value={form.positionId || ''}
              onValueChange={(value) => setForm((prev) => ({ ...prev, positionId: value || undefined }))}
              options={[{ value: '', label: 'Tanpa posisi' }, ...positions.map((item) => ({ value: item.id, label: item.name }))]}
              placeholder="Pilih posisi"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Employment Type</label>
            <Select2
              value={form.employmentType}
              onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}
              options={EMPLOYMENT_TYPE_OPTIONS}
              placeholder="Pilih tipe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Input value={form.location || ''} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Jakarta / Hybrid" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Vacancies</label>
            <Input type="number" min={1} value={String(form.vacancies)} onChange={(e) => setForm((prev) => ({ ...prev, vacancies: Number(e.target.value || 1) }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Currency</label>
            <Input value={form.currency || 'IDR'} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} placeholder="IDR" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Min Salary</label>
            <Input type="number" min={0} value={form.minSalary ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, minSalary: e.target.value ? Number(e.target.value) : undefined }))} placeholder="10000000" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Salary</label>
            <Input type="number" min={0} value={form.maxSalary ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, maxSalary: e.target.value ? Number(e.target.value) : undefined }))} placeholder="15000000" />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Deskripsi singkat role"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Requirements</label>
            <textarea
              value={form.requirements || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))}
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Requirement utama kandidat"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Responsibilities</label>
            <textarea
              value={form.responsibilities || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, responsibilities: e.target.value }))}
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Responsibility utama role"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment')}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Menyimpan...' : 'Buat Job Posting'}
          </Button>
        </div>
      </div>
    </div>
  );
}
