import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { benefitService, type BenefitPlan } from '@/services/benefit.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

/** Nilai tipe & status berasal dari server; hanya labelnya diterjemahkan. */
const PLAN_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  'Health Insurance': 'fin.benefit.typeHealthInsurance',
  Dental: 'fin.benefit.typeDental',
  Vision: 'fin.benefit.typeVision',
  'Life Insurance': 'fin.benefit.typeLifeInsurance',
  Retirement: 'fin.benefit.typeRetirement',
  Transportation: 'fin.benefit.typeTransportation',
  Meal: 'fin.benefit.typeMeal',
  Education: 'fin.benefit.typeEducation',
  Wellness: 'fin.benefit.typeWellness',
  Other: 'fin.benefit.typeOther',
};

const ENROLLMENT_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  ACTIVE: 'common.active',
  INACTIVE: 'common.inactive',
  PENDING: 'fin.status.pending',
  CANCELLED: 'fin.status.cancelled',
};

export function BenefitPlanDetail() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<BenefitPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await benefitService.getPlan(id);
      setPlan(data);
    } catch (error) {
      console.error('Failed to fetch benefit plan:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">{t('fin.benefit.notFound')}</p>
        <Button variant="link" onClick={() => navigate('/benefits')}>{t('fin.common.back')}</Button>
      </div>
    );
  }

  const planTypeLabel = PLAN_TYPE_LABEL_KEYS[plan.type] ? t(PLAN_TYPE_LABEL_KEYS[plan.type]) : plan.type;

  return (
    <div>
      <PageHeader
        title={plan.name}
        description={`${planTypeLabel} · ${plan.code}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/benefits')}>
            <ArrowLeft size={16} className="mr-2" />
            {t('fin.common.back')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Details */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                <Heart size={24} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="text-xs text-muted-foreground">{planTypeLabel}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('fin.common.status')}</span>
                <span className={`font-medium ${plan.isActive ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {plan.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('fin.benefit.provider')}</span>
                <span className="font-medium">{plan.provider || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('fin.common.taxable')}</span>
                <span className="font-medium">{plan.isTaxable ? t('fin.common.yes') : t('fin.common.no')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('fin.benefit.employeeContributionPlain')}</span>
                <span className="font-medium">{plan.employeeContribution}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('fin.benefit.employerContributionPlain')}</span>
                <span className="font-medium">{plan.employerContribution}%</span>
              </div>
              {plan.maxAmount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('fin.benefit.maxAmount')}</span>
                  <span className="font-medium">Rp {Number(plan.maxAmount).toLocaleString()}</span>
                </div>
              )}
              {plan.description && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">{t('fin.common.description')}</p>
                  <p className="text-sm">{plan.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enrollments */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">{t('fin.benefit.enrolledTitle', { count: plan.enrollments?.length || 0 })}</h3>
            </div>
            <div className="table-container">
              <table className="w-full">
                <thead className="table-header">
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('fin.common.employee')}</th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('fin.benefit.colEffective')}</th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('fin.common.status')}</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('fin.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.enrollments?.map((enrollment) => (
                    <tr key={enrollment.id} className="table-row-hover">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{enrollment.employee?.fullName || t('fin.common.unknown')}</p>
                        <p className="text-xs text-muted-foreground">{enrollment.employee?.employeeNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{formatDate(enrollment.effectiveDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          enrollment.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : enrollment.status === 'CANCELLED'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                              : 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400'
                        }`}>
                          {ENROLLMENT_STATUS_LABEL_KEYS[enrollment.status]
                            ? t(ENROLLMENT_STATUS_LABEL_KEYS[enrollment.status])
                            : enrollment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm">{t('fin.common.view')}</Button>
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                        {t('fin.benefit.noEnrollments')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
