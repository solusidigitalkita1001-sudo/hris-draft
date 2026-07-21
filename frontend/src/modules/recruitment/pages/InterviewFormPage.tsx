import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  recruitmentService,
  type InterviewPayload,
  type JobApplication,
} from '@/services/recruitment.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { useCompanyStore } from '@/stores/company.store';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const INTERVIEW_TYPE_OPTIONS = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
];

export function InterviewFormPage() {
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    applicationId: '',
    interviewerId: '',
    type: 'ONLINE',
    title: '',
    scheduledAt: '',
    durationMinutes: '60',
    location: '',
    meetingLink: '',
    notes: '',
  });

  useEffect(() => {
    if (!companyId) {
      setApplications([]);
      setEmployees([]);
      setLoading(false);
      return;
    }

    const loadReferences = async () => {
      setLoading(true);
      try {
        const [applicationData, employeeData] = await Promise.all([
          recruitmentService.getApplications(companyId),
          employeeService.getEmployees({ companyId, page: 1, limit: 200 }),
        ]);

        setApplications(
          applicationData.filter((application) =>
            ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER'].includes(application.status)
          )
        );
        setEmployees(employeeData.data);
      } catch (error) {
        console.error(error);
        toast.error('Gagal memuat referensi interview');
      } finally {
        setLoading(false);
      }
    };

    void loadReferences();
  }, [companyId]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === form.applicationId) || null,
    [applications, form.applicationId]
  );

  const applicationOptions = useMemo(
    () =>
      applications.map((application) => ({
        value: application.id,
        label: `${application.candidate?.firstName || ''} ${application.candidate?.lastName || ''} • ${application.jobPosting?.title || 'Unknown Posting'}`.trim(),
      })),
    [applications]
  );

  const interviewerOptions = useMemo(
    () => [
      { value: '', label: 'Tanpa interviewer spesifik' },
      ...employees.map((employee) => ({
        value: employee.id,
        label: `${employee.fullName} • ${employee.employeeNumber}`,
      })),
    ],
    [employees]
  );

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!form.applicationId || !selectedApplication?.candidate?.id) {
      toast.error('Pilih application yang valid');
      return;
    }

    if (!form.title.trim() || !form.scheduledAt) {
      toast.error('Title dan jadwal interview wajib diisi');
      return;
    }

    if (form.type === 'ONLINE' && !form.meetingLink.trim()) {
      toast.error('Meeting link wajib diisi untuk interview online');
      return;
    }

    if (form.type === 'OFFLINE' && !form.location.trim()) {
      toast.error('Lokasi wajib diisi untuk interview offline');
      return;
    }

    setSaving(true);
    try {
      const payload: InterviewPayload = {
        applicationId: form.applicationId,
        candidateId: selectedApplication.candidate.id,
        interviewerId: form.interviewerId || undefined,
        companyId,
        type: form.type,
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : 60,
        location: form.type === 'OFFLINE' ? form.location.trim() || undefined : undefined,
        meetingLink: form.type === 'ONLINE' ? form.meetingLink.trim() || undefined : undefined,
        notes: form.notes.trim() || undefined,
      };

      await recruitmentService.createInterview(payload);
      toast.success('Interview berhasil dijadwalkan');
      navigate('/recruitment/interviews');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat interview');
    } finally {
      setSaving(false);
    }
  }, [companyId, form, navigate, selectedApplication]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Schedule Interview"
        description="Atur interview kandidat dari application yang masih aktif di pipeline."
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/interviews')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Application</label>
            <Select2
              value={form.applicationId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, applicationId: value }))}
              options={applicationOptions}
              placeholder="Pilih application"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Interview Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="HR Screening Interview"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select2
              value={form.type}
              onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              options={INTERVIEW_TYPE_OPTIONS}
              placeholder="Pilih tipe interview"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Scheduled At</label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Duration (minutes)</label>
            <Input
              type="number"
              min={15}
              step={15}
              value={form.durationMinutes}
              onChange={(e) => setForm((prev) => ({ ...prev, durationMinutes: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Interviewer</label>
            <Select2
              value={form.interviewerId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, interviewerId: value }))}
              options={interviewerOptions}
              placeholder="Pilih interviewer"
            />
          </div>

          {form.type === 'ONLINE' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Meeting Link</label>
              <Input
                value={form.meetingLink}
                onChange={(e) => setForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                placeholder="https://meet.google.com/..."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Meeting Room 3 / Kantor Jakarta"
              />
            </div>
          )}
        </div>

        {selectedApplication && (
          <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3">
            <p className="text-sm font-medium">
              {selectedApplication.candidate?.firstName} {selectedApplication.candidate?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedApplication.jobPosting?.title || 'Unknown Posting'} • Status application {selectedApplication.status}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Catatan interviewer atau agenda interview."
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/interviews')}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Jadwalkan Interview'}
          </Button>
        </div>
      </div>
    </div>
  );
}
