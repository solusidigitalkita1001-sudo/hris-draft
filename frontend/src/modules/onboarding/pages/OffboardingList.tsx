import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboardingService, type Resignation } from '@/services/onboarding.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, LogOut, UserRound, X } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const STYLES: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  COMPLETED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

const STATUS_LABEL: Record<string, TranslationKey> = {
  SUBMITTED: 'ops.offboarding.status.submitted',
  APPROVED: 'ops.offboarding.status.approved',
  REJECTED: 'ops.offboarding.status.rejected',
  COMPLETED: 'ops.offboarding.status.completed',
};

export function OffboardingList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [resignations, setResignations] = useState<Resignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    reason: '',
    resignationDate: '',
  });

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setResignations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await onboardingService.getResignations(companyId);
      setResignations(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.employeeId || !formData.resignationDate) return;
    setSubmitting(true);
    try {
      await onboardingService.createResignation({
        employeeId: formData.employeeId,
        reason: formData.reason,
        resignDate: formData.resignationDate,
        companyId,
      });
      setShowModal(false);
      setFormData({ employeeId: '', reason: '', resignationDate: '' });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = () => {
    setFormData({ employeeId: '', reason: '', resignationDate: '' });
    setShowModal(true);
  };

  return (
    <div>
      <PageHeader title={t('ops.offboarding.list.title')} description={t('ops.offboarding.list.description')}
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />{t('common.refresh')}</Button>
          <Button size="sm" onClick={openModal}><Plus size={16} className="mr-2" />{t('ops.offboarding.list.newResignation')}</Button></>} />
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ops.offboarding.fields.employee')}</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ops.offboarding.fields.resignDate')}</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ops.offboarding.fields.lastWorkingDay')}</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ops.offboarding.fields.status')}</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ops.offboarding.fields.created')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            : resignations.length === 0 ? <tr><td colSpan={5} className="text-center py-12"><div className="flex flex-col items-center gap-2"><LogOut size={32} className="text-muted-foreground/40" /><p className="text-sm text-muted-foreground">{t('ops.offboarding.list.empty')}</p></div></td></tr>
            : resignations.map((r) => (
              <tr key={r.id} className="table-row-hover cursor-pointer" onClick={() => navigate(`/offboarding/${r.id}`)}>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><UserRound size={16} className="text-muted-foreground" /><p className="text-sm font-medium">{r.employee?.fullName || '-'}</p></div></td>
                <td className="px-4 py-3 text-sm">{formatDate(r.resignDate)}</td>
                <td className="px-4 py-3 text-sm">{formatDate(r.lastWorkingDate)}</td>
                <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[r.status] || ''}`}>{STATUS_LABEL[r.status] ? t(STATUS_LABEL[r.status]) : r.status}</span></td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Resignation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('ops.offboarding.list.newResignation')}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('ops.offboarding.form.employeeId')}</label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('ops.offboarding.form.employeeIdPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('ops.offboarding.form.resignationDate')}</label>
                <input
                  type="date"
                  name="resignationDate"
                  value={formData.resignationDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('ops.offboarding.fields.reason')}</label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder={t('ops.offboarding.form.reasonPlaceholder')}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !formData.employeeId || !formData.resignationDate}>
                {submitting ? t('ops.offboarding.form.submitting') : t('ops.offboarding.form.submit')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
