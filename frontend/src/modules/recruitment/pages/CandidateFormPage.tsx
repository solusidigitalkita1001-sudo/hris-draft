import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompanyStore } from '@/stores/company.store';
import { recruitmentService, type CandidatePayload } from '@/services/recruitment.service';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

export function CandidateFormPage() {
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
      toast.error('Company belum aktif');
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Nama depan dan nama belakang wajib diisi');
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
      toast.success('Candidate berhasil dibuat');
      navigate('/recruitment/candidates');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat candidate');
    } finally {
      setLoading(false);
    }
  }, [companyId, form, navigate]);

  return (
    <div>
      <PageHeader
        title="Add Candidate"
        description="Tambahkan kandidat baru ke talent pool recruitment."
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/candidates')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">First Name</label>
            <Input value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="John" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Last Name</label>
            <Input value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Doe" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={form.email || ''} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="john@candidate.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <Input value={form.phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="+62 812..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Company</label>
            <Input value={form.currentCompany || ''} onChange={(e) => setForm((prev) => ({ ...prev, currentCompany: e.target.value }))} placeholder="Current company" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Position</label>
            <Input value={form.currentPosition || ''} onChange={(e) => setForm((prev) => ({ ...prev, currentPosition: e.target.value }))} placeholder="Current role" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Source</label>
            <Input value={form.source || ''} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))} placeholder="LinkedIn, Referral, Website..." />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Catatan singkat kandidat"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/recruitment/candidates')}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Menyimpan...' : 'Buat Candidate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
