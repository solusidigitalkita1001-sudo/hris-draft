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
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { useCompanyStore } from '@/stores/company.store';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '@/lib/errors';

const INTERVIEW_TYPE_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'ONLINE', labelKey: 'wf.rec.interviewForm.typeOnline' },
  { value: 'OFFLINE', labelKey: 'wf.rec.interviewForm.typeOffline' },
];

export function InterviewFormPage() {
  const { t } = useI18n();
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
        toast.error(t('wf.rec.interviewForm.loadRefsFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadReferences();
  }, [companyId, t]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === form.applicationId) || null,
    [applications, form.applicationId]
  );

  const applicationOptions = useMemo(
    () =>
      applications.map((application) => ({
        value: application.id,
        label: `${application.candidate?.firstName || ''} ${application.candidate?.lastName || ''} • ${application.jobPosting?.title || t('wf.rec.interviewForm.unknownPosting')}`.trim(),
      })),
    [applications, t]
  );

  const interviewerOptions = useMemo(
    () => [
      { value: '', label: t('wf.rec.interviewForm.noInterviewer') },
      ...employees.map((employee) => ({
        value: employee.id,
        label: `${employee.fullName} • ${employee.employeeNumber}`,
      })),
    ],
    [employees, t]
  );

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error(t('wf.rec.noActiveCompany'));
      return;
    }

    if (!form.applicationId || !selectedApplication?.candidate?.id) {
      toast.error(t('wf.rec.interviewForm.invalidApplication'));
      return;
    }

    if (!form.title.trim() || !form.scheduledAt) {
      toast.error(t('wf.rec.interviewForm.titleScheduleRequired'));
      return;
    }

    if (form.type === 'ONLINE' && !form.meetingLink.trim()) {
      toast.error(t('wf.rec.interviewForm.meetingLinkRequired'));
      return;
    }

    if (form.type === 'OFFLINE' && !form.location.trim()) {
      toast.error(t('wf.rec.interviewForm.locationRequired'));
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
      toast.success(t('wf.rec.interviewForm.createSuccess'));
      navigate('/recruitment/interviews');
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('wf.rec.interviewForm.createFailed')));
    } finally {
      setSaving(false);
    }
  }, [companyId, form, navigate, selectedApplication, t]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('wf.rec.interviews.schedule')}
        description={t('wf.rec.interviewForm.description')}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/interviews')}>
            <ArrowLeft size={16} className="mr-2" />
            {t('employees.detail.actions.back')}
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">{t('wf.rec.interviewForm.application')}</label>
            <Select2
              value={form.applicationId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, applicationId: value }))}
              options={applicationOptions}
              placeholder={t('wf.rec.interviewForm.selectApplication')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.interviewForm.interviewTitle')}</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={t('wf.rec.interviewForm.titlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.common.type')}</label>
            <Select2
              value={form.type}
              onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              options={INTERVIEW_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
              placeholder={t('wf.rec.interviewForm.selectType')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.interviewForm.scheduledAt')}</label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.interviewForm.durationMinutes')}</label>
            <Input
              type="number"
              min={15}
              step={15}
              value={form.durationMinutes}
              onChange={(e) => setForm((prev) => ({ ...prev, durationMinutes: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.interviewForm.interviewer')}</label>
            <Select2
              value={form.interviewerId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, interviewerId: value }))}
              options={interviewerOptions}
              placeholder={t('wf.rec.interviewForm.selectInterviewer')}
            />
          </div>

          {form.type === 'ONLINE' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('wf.rec.interviewForm.meetingLink')}</label>
              <Input
                value={form.meetingLink}
                onChange={(e) => setForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                placeholder={t('wf.rec.interviewForm.meetingLinkPlaceholder')}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('wf.common.location')}</label>
              <Input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder={t('wf.rec.interviewForm.locationPlaceholder')}
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
              {selectedApplication.jobPosting?.title || t('wf.rec.interviewForm.unknownPosting')} • {t('wf.rec.interviewForm.applicationStatus', { status: selectedApplication.status })}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">{t('wf.common.notes')}</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={t('wf.rec.interviewForm.notesPlaceholder')}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/interviews')}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? t('wf.common.saving') : t('wf.rec.interviewForm.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
