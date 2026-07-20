import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { payrollService, type PayrollPeriod } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { ArrowLeft, Loader2, Play } from 'lucide-react';

export function PayrollRunCreate() {
  const navigate = useNavigate();
  const companyId = localStorage.getItem('companyId') || '';

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  const [periodId, setPeriodId] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPeriods = useCallback(async () => {
    if (!companyId) {
      setPeriods([]);
      setLoadingPeriods(false);
      return;
    }

    setLoadingPeriods(true);
    try {
      const data = await payrollService.getPayrollPeriods(companyId);
      setPeriods(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memuat payroll periods');
    } finally {
      setLoadingPeriods(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const selectablePeriods = useMemo(() => periods.filter((p) => p.status !== 'CLOSED'), [periods]);

  useEffect(() => {
    if (!periodId && selectablePeriods.length > 0) {
      setPeriodId(selectablePeriods[0].id);
    }
  }, [periodId, selectablePeriods]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!companyId) {
      toast.error('companyId tidak tersedia. Silakan login ulang.');
      return;
    }

    if (!periodId) {
      toast.error('Pilih payroll period terlebih dahulu');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Nama payroll run wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const created = await payrollService.createPayrollRun({
        companyId,
        periodId,
        name: trimmedName,
        notes: notes.trim() || undefined,
      });

      toast.success('Payroll run berhasil dibuat');
      navigate(`/payroll/runs/${created.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal membuat payroll run');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create Payroll Run"
        description="Pilih period lalu jalankan proses payroll"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/runs')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        }
      />

      <div className="max-w-2xl rounded-xl border border-border bg-white p-5 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payroll Period *</label>
              <Select2
                value={periodId}
                onValueChange={setPeriodId}
                disabled={loadingPeriods || selectablePeriods.length === 0}
                options={[
                  { value: '', label: selectablePeriods.length === 0 ? 'Tidak ada period' : 'Pilih period' },
                  ...selectablePeriods.map((p) => ({
                    value: p.id,
                    label: `${p.name} • ${dayjs(p.startDate).format('DD MMM YYYY')} - ${dayjs(p.endDate).format('DD MMM YYYY')} • ${p.status}`,
                  })),
                ]}
                placeholder="Pilih period"
              />
              {!companyId && (
                <p className="text-xs text-muted-foreground">companyId kosong. Biasanya ini terjadi kalau session belum terset.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Run *</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Payroll July 2026"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Catatan</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Opsional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/payroll/runs')} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting || loadingPeriods || !periodId}>
              {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
              {!submitting && <Play size={16} className="mr-2" />}
              {submitting ? 'Memproses...' : 'Create Run'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

