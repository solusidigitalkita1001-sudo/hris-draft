import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useCompanyStore } from '@/stores/company.store';
import { recruitmentService, type Candidate, type JobPosting } from '@/services/recruitment.service';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

export function ApplicationCreatePage() {
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
        toast.error('Gagal memuat data application');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [companyId, id]);

  const handleSubmit = useCallback(async () => {
    if (!id || !companyId) {
      toast.error('Context application tidak valid');
      return;
    }

    if (!candidateId) {
      toast.error('Pilih candidate dulu');
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
      toast.success('Application berhasil dibuat');
      navigate(`/recruitment/postings/${id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat application');
    } finally {
      setSubmitting(false);
    }
  }, [candidateId, companyId, coverLetter, expectedSalary, id, navigate, notes]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Create Application"
        description={posting ? `Tambahkan kandidat ke lowongan ${posting.title}` : 'Tambahkan kandidat ke lowongan'}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate(id ? `/recruitment/postings/${id}` : '/recruitment')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Candidate</label>
            <Select2
              value={candidateId}
              onValueChange={setCandidateId}
              options={candidates.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.firstName} ${candidate.lastName}${candidate.currentPosition ? ` • ${candidate.currentPosition}` : ''}`,
              }))}
              placeholder="Pilih candidate aktif"
            />
            <p className="text-xs text-muted-foreground">
              Candidate belum ada? Tambahkan dulu dari menu kandidat.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Expected Salary</label>
            <Input type="number" min={0} value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="12000000" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cover Letter</label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ringkasan cover letter kandidat"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Catatan internal rekrutmen"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(id ? `/recruitment/postings/${id}` : '/recruitment')}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Buat Application'}
          </Button>
        </div>
      </div>
    </div>
  );
}
