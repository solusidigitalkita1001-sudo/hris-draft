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
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';

export function PayrollRunCreate() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';

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
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.period.loadFailed')));
    } finally {
      setLoadingPeriods(false);
    }
  }, [companyId, t]);

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
      toast.error(t('fin.common.companyMissing'));
      return;
    }

    if (!periodId) {
      toast.error(t('fin.runCreate.errSelectPeriod'));
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t('fin.runCreate.errNameRequired'));
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

      toast.success(t('fin.runCreate.created'));
      navigate(`/payroll/runs/${created.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.runCreate.createFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('fin.runCreate.title')}
        description={t('fin.runCreate.description')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/runs')}>
            <ArrowLeft size={16} className="mr-2" />
            {t('fin.common.back')}
          </Button>
        }
      />

      <div className="max-w-2xl rounded-xl border border-border bg-white p-5 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fin.runCreate.periodLabel')} *</label>
              <Select2
                value={periodId}
                onValueChange={setPeriodId}
                disabled={loadingPeriods || selectablePeriods.length === 0}
                options={[
                  {
                    value: '',
                    label: selectablePeriods.length === 0 ? t('fin.runCreate.noPeriod') : t('fin.runCreate.selectPeriod'),
                  },
                  ...selectablePeriods.map((p) => ({
                    value: p.id,
                    label: `${p.name} • ${dayjs(p.startDate).format('DD MMM YYYY')} - ${dayjs(p.endDate).format('DD MMM YYYY')} • ${p.status}`,
                  })),
                ]}
                placeholder={t('fin.runCreate.selectPeriod')}
              />
              {!companyId && (
                <p className="text-xs text-muted-foreground">{t('fin.runCreate.companyEmptyHint')}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fin.runCreate.nameLabel')} *</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('fin.runCreate.namePlaceholder')}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fin.common.notes')}</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={t('fin.common.optional')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/payroll/runs')} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || loadingPeriods || !periodId}>
              {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
              {!submitting && <Play size={16} className="mr-2" />}
              {submitting ? t('fin.common.processing') : t('fin.runCreate.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
