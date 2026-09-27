import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/provider';
import { useCompanyStore } from '@/stores/company.store';
import { recruitmentService, type CandidatePayload } from '@/services/recruitment.service';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';

export function CandidateFormPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CandidatePayload>({
    companyId,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentCompany: '',
    currentPosition: '',
    source: '',
    notes: '',
  });

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error(t('wf.rec.noActiveCompany'));
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error(t('wf.rec.candidateForm.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      await recruitmentService.createCandidate({
        ...form,
        companyId,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        currentCompany: form.currentCompany?.trim() || undefined,
        currentPosition: form.currentPosition?.trim() || undefined,
        source: form.source?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      });
      toast.success(t('wf.rec.candidateForm.createSuccess'));
      navigate('/recruitment/candidates');
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('wf.rec.candidateForm.createFailed')));
    } finally {
      setLoading(false);
    }
  }, [companyId, form, navigate, t]);

  return (
    <div>
      <PageHeader
        title={t('wf.rec.candidates.add')}
        description={t('wf.rec.candidateForm.description')}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/candidates')}>
            <ArrowLeft size={16} className="mr-2" />
            {t('employees.detail.actions.back')}
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.employees.form.fields.firstName')}</label>
            <Input value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} placeholder={t('wf.rec.candidateForm.firstNamePlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.employees.form.fields.lastName')}</label>
            <Input value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder={t('wf.rec.candidateForm.lastNamePlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.common.email')}</label>
            <Input type="email" value={form.email || ''} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder={t('wf.rec.candidateForm.emailPlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.common.phone')}</label>
            <Input value={form.phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder={t('wf.rec.candidateForm.phonePlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.candidateForm.currentCompany')}</label>
            <Input value={form.currentCompany || ''} onChange={(e) => setForm((prev) => ({ ...prev, currentCompany: e.target.value }))} placeholder={t('wf.rec.candidateForm.currentCompanyPlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.candidateForm.currentPosition')}</label>
            <Input value={form.currentPosition || ''} onChange={(e) => setForm((prev) => ({ ...prev, currentPosition: e.target.value }))} placeholder={t('wf.rec.candidateForm.currentPositionPlaceholder')} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">{t('wf.rec.candidateForm.source')}</label>
            <Input value={form.source || ''} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))} placeholder={t('wf.rec.candidateForm.sourcePlaceholder')} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">{t('wf.common.notes')}</label>
          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={t('wf.rec.candidateForm.notesPlaceholder')}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/candidates')}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? t('wf.common.saving') : t('wf.rec.candidateForm.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
