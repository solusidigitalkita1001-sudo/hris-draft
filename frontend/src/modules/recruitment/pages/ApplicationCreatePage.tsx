import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useI18n } from '@/i18n/provider';
import { useCompanyStore } from '@/stores/company.store';
import { recruitmentService, type Candidate, type JobPosting } from '@/services/recruitment.service';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';

export function ApplicationCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [candidateId, setCandidateId] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id || !companyId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [postingData, candidateData] = await Promise.all([
          recruitmentService.getJobPosting(id),
          recruitmentService.getCandidates(companyId),
        ]);
        setPosting(postingData);
        setCandidates(candidateData.filter((candidate) => candidate.status === 'ACTIVE'));
      } catch (error) {
        console.error(error);
        toast.error(t('wf.rec.applicationForm.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [companyId, id, t]);

  const handleSubmit = useCallback(async () => {
    if (!id || !companyId) {
      toast.error(t('wf.rec.applicationForm.invalidContext'));
      return;
    }

    if (!candidateId) {
      toast.error(t('wf.rec.applicationForm.candidateRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await recruitmentService.createApplication({
        jobPostingId: id,
        candidateId,
        companyId,
        expectedSalary: expectedSalary ? Number(expectedSalary) : undefined,
        coverLetter: coverLetter.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(t('wf.rec.applicationForm.createSuccess'));
      navigate(`/recruitment/postings/${id}`);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('wf.rec.applicationForm.createFailed')));
    } finally {
      setSubmitting(false);
    }
  }, [candidateId, companyId, coverLetter, expectedSalary, id, navigate, notes, t]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('wf.rec.applicationForm.title')}
        description={posting ? t('wf.rec.applicationForm.descriptionWithPosting', { title: posting.title }) : t('wf.rec.applicationForm.description')}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate(id ? `/recruitment/postings/${id}` : '/recruitment')}>
            <ArrowLeft size={16} className="mr-2" />
            {t('employees.detail.actions.back')}
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.applicationForm.candidate')}</label>
            <Select2
              value={candidateId}
              onValueChange={setCandidateId}
              options={candidates.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.firstName} ${candidate.lastName}${candidate.currentPosition ? ` • ${candidate.currentPosition}` : ''}`,
              }))}
              placeholder={t('wf.rec.applicationForm.selectCandidate')}
            />
            <p className="text-xs text-muted-foreground">
              {t('wf.rec.applicationForm.candidateHint')}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.applicationForm.expectedSalary')}</label>
            <Input type="number" min={0} value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="12000000" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.rec.applicationForm.coverLetter')}</label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('wf.rec.applicationForm.coverLetterPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('wf.common.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('wf.rec.applicationForm.notesPlaceholder')}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(id ? `/recruitment/postings/${id}` : '/recruitment')}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('wf.common.saving') : t('wf.rec.applicationForm.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
