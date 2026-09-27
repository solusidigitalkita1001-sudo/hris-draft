import { appConfig } from '@/config/app';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  Plane,
  ReceiptText,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import { apiErrorMessage } from '@/lib/errors';
import {
  BUSINESS_TRIP_STATUS_LABELS,
  EXPENSE_CLAIM_STATUS_LABELS,
  travelExpenseService,
  type BusinessTrip,
  type ExpenseCategory,
  type ExpenseCategoryOption,
  type ExpenseClaim,
  type ReimbursementMethod,
} from '@/services/travel-expense.service';

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle size={18} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-slate-50 text-slate-700';

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>{label}</span>;
}

function TripForm({
  employeeId,
  companyId,
  onClose,
  onSuccess,
}: {
  employeeId: string;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId || !companyId) {
      toast.error(t('ops.travel.toast.profileMissing'));
      return;
    }

    if (!destination.trim()) {
      toast.error(t('ops.travel.trip.validation.destinationRequired'));
      return;
    }

    if (!purpose.trim()) {
      toast.error(t('ops.travel.trip.validation.purposeRequired'));
      return;
    }

    if (dayjs(endDate).isBefore(dayjs(startDate), 'day')) {
      toast.error(t('ops.travel.trip.validation.endBeforeStart'));
      return;
    }

    const parsedEstimated = Number(estimatedCost);
    if (!Number.isFinite(parsedEstimated) || parsedEstimated < 0) {
      toast.error(t('ops.travel.trip.validation.invalidEstimate'));
      return;
    }

    setSaving(true);
    try {
      await travelExpenseService.createTrip({
        destination: destination.trim(),
        purpose: purpose.trim(),
        startDate: dayjs(startDate).toISOString(),
        endDate: dayjs(endDate).toISOString(),
        estimatedCost: parsedEstimated,
        notes: notes || undefined,
      });
      toast.success(t('ops.travel.trip.toast.created'));
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('ops.travel.trip.toast.createFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.trip.form.destination')}</label>
          <Input value={destination} onChange={(event) => setDestination(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.trip.form.estimatedCost')}</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={estimatedCost}
            onChange={(event) => setEstimatedCost(event.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.trip.form.startDate')}</label>
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.trip.form.endDate')}</label>
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.trip.form.purpose')}</label>
        <textarea
          rows={4}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.trip.form.notes')}</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('ops.travel.form.saving') : t('ops.travel.trip.form.submit')}
        </Button>
      </div>
    </form>
  );
}

function ClaimForm({
  employeeId,
  companyId,
  trips,
  categories,
  onClose,
  onSuccess,
}: {
  employeeId: string;
  companyId: string;
  trips: BusinessTrip[];
  categories: ExpenseCategoryOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [tripId, setTripId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('TRANSPORTATION');
  const [amount, setAmount] = useState('0');
  const [expenseDate, setExpenseDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const selectableTrips = trips.filter((trip) => trip.status === 'APPROVED' || trip.status === 'COMPLETED');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId || !companyId) {
      toast.error(t('ops.travel.toast.profileMissing'));
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('ops.travel.claim.validation.amountPositive'));
      return;
    }

    if (tripId && !selectableTrips.some((trip) => trip.id === tripId)) {
      toast.error(t('ops.travel.claim.validation.invalidTrip'));
      return;
    }

    setSaving(true);
    try {
      let receiptFilePath: string | undefined;

      if (receiptFile) {
        const uploadResult = await travelExpenseService.uploadReceipt(receiptFile);
        receiptFilePath = uploadResult.url;
      }

      await travelExpenseService.createClaim({
        tripId: tripId || undefined,
        category,
        amount: parsedAmount,
        expenseDate: dayjs(expenseDate).toISOString(),
        description: description.trim() || undefined,
        receiptFilePath,
      });
      toast.success(t('ops.travel.claim.toast.submitted'));
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('ops.travel.claim.toast.createFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.claim.form.relatedTrip')}</label>
          <Select2
            value={tripId}
            onValueChange={setTripId}
            options={[
              { value: '', label: t('ops.travel.claim.form.noSpecificTrip') },
              ...selectableTrips.map((trip) => ({
                value: trip.id,
                label: `${trip.destination} (${dayjs(trip.startDate).format('DD MMM YYYY')})`,
              })),
            ]}
            placeholder={t('ops.travel.claim.form.selectTrip')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.claim.form.category')}</label>
          <Select2
            value={category}
            onValueChange={(value) => setCategory(value as ExpenseCategory)}
            options={categories}
            placeholder={t('ops.travel.claim.form.selectCategory')}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.claim.form.amount')}</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.claim.form.expenseDate')}</label>
          <Input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.claim.form.uploadReceipt')}</label>
        <Input
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            if (file && file.size > 5 * 1024 * 1024) {
              toast.error(t('ops.travel.claim.validation.receiptTooLarge'));
              event.target.value = '';
              setReceiptFile(null);
              return;
            }
            setReceiptFile(file);
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t('ops.travel.claim.form.receiptFormats')}
        </p>
        {receiptFile && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('ops.travel.claim.form.selectedFile', { name: receiptFile.name })}
          </p>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ops.travel.claim.form.description')}</label>
        <textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('ops.travel.form.saving') : t('ops.travel.claim.form.submit')}
        </Button>
      </div>
    </form>
  );
}

export function TravelExpensePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [activeTab, setActiveTab] = useState<'trips' | 'claims'>('trips');
  const [tripStatus, setTripStatus] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [trips, setTrips] = useState<BusinessTrip[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);

  const employeeId = user?.employeeId || localStorage.getItem('employeeId') || '';
  const isApprover = useMemo(
    () =>
      !!user &&
      user.roles.some((role) => ['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(role)),
    [user]
  );

  const loadCategories = useCallback(async () => {
    try {
      const data = await travelExpenseService.getCategories();
      setCategories(data);
    } catch {
      toast.error(t('ops.travel.toast.loadCategoriesFailed'));
    }
  }, [t]);

  const loadTrips = useCallback(async () => {
    if (isApprover) {
      if (!companyId) return;
      const data = await travelExpenseService.findTrips(companyId, tripStatus || undefined);
      setTrips(data);
      return;
    }

    const data = await travelExpenseService.findMyTrips(tripStatus || undefined);
    setTrips(data);
  }, [companyId, isApprover, tripStatus]);

  const loadClaims = useCallback(async () => {
    if (isApprover) {
      if (!companyId) return;
      const data = await travelExpenseService.findClaims(companyId, claimStatus || undefined);
      setClaims(data);
      return;
    }

    const data = await travelExpenseService.findMyClaims(claimStatus || undefined);
    setClaims(data);
  }, [claimStatus, companyId, isApprover]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadTrips(), loadClaims()]);
    } catch {
      toast.error(t('ops.travel.toast.loadDataFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadTrips, loadClaims, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleTripApproval = async (id: string, action: 'approve' | 'reject') => {
    const notes = await popup.prompt({
      title: action === 'approve' ? t('ops.travel.trip.approval.approveTitle') : t('ops.travel.trip.approval.rejectTitle'),
      description: action === 'approve' ? t('ops.travel.approval.approveNotesDescription') : t('ops.travel.approval.rejectReasonDescription'),
      placeholder: action === 'approve' ? t('ops.travel.approval.approveNotesPlaceholder') : t('ops.travel.approval.rejectReasonPlaceholder'),
      required: action === 'reject',
      confirmText: action === 'approve' ? t('ops.travel.actions.approve') : t('ops.travel.actions.reject'),
      intent: action === 'reject' ? 'destructive' : 'default',
    });
    if (action === 'reject' && !notes) return;
    try {
      if (action === 'approve') {
        await travelExpenseService.submitTripWorkflowAction(id, 'APPROVE', notes || undefined);
        toast.success(t('ops.travel.trip.toast.approved'));
      } else {
        await travelExpenseService.submitTripWorkflowAction(id, 'REJECT', notes || undefined);
        toast.success(t('ops.travel.trip.toast.rejected'));
      }
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('ops.travel.toast.actionFailed')));
    }
  };

  const handleCreateAdvance = async (tripId: string) => {
    const amount = await popup.prompt({
      title: t('ops.travel.cashAdvance.title'),
      description: t('ops.travel.cashAdvance.description'),
      placeholder: t('ops.travel.cashAdvance.placeholder'),
      required: true,
      confirmText: t('common.save'),
    });
    if (!amount) return;

    try {
      await travelExpenseService.createAdvance(tripId, { companyId, amount: Number(amount) });
      toast.success(t('ops.travel.cashAdvance.success'));
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('ops.travel.cashAdvance.failed')));
    }
  };

  const handleClaimAction = async (id: string, action: 'approve' | 'reject' | 'reimburse') => {
    try {
      if (action === 'approve') {
        const notes = await popup.prompt({
          title: t('ops.travel.claim.approval.approveTitle'),
          description: t('ops.travel.approval.approveNotesDescription'),
          placeholder: t('ops.travel.approval.approveNotesPlaceholder'),
          confirmText: t('ops.travel.actions.approve'),
        });
        await travelExpenseService.submitClaimWorkflowAction(id, 'APPROVE', notes || undefined);
        toast.success(t('ops.travel.claim.toast.approved'));
      } else if (action === 'reject') {
        const notes = await popup.prompt({
          title: t('ops.travel.claim.approval.rejectTitle'),
          description: t('ops.travel.claim.approval.rejectReasonDescription'),
          placeholder: t('ops.travel.approval.rejectReasonPlaceholder'),
          required: true,
          confirmText: t('ops.travel.actions.reject'),
          intent: 'destructive',
        });
        if (!notes) return;
        await travelExpenseService.submitClaimWorkflowAction(id, 'REJECT', notes || undefined);
        toast.success(t('ops.travel.claim.toast.rejected'));
      } else {
        const method = (await popup.select({
          title: t('ops.travel.reimburse.title'),
          description: t('ops.travel.reimburse.description'),
          value: 'TRANSFER',
          options: [
            { value: 'TRANSFER', label: 'TRANSFER' },
            { value: 'PAYROLL', label: 'PAYROLL' },
          ],
          required: true,
          confirmText: t('ops.travel.reimburse.confirm'),
        })) as ReimbursementMethod | null;
        if (!method) return;
        await travelExpenseService.reimburseClaim(id, { companyId, method });
        toast.success(t('ops.travel.reimburse.success'));
      }
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('ops.travel.toast.actionFailed')));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('ops.travel.title')}
        description={t('ops.travel.description')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={16} className="mr-2" /> {t('common.refresh')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowTripForm(true)}>
              <Plus size={16} className="mr-2" /> {t('ops.travel.actions.travelRequest')}
            </Button>
            <Button size="sm" onClick={() => setShowClaimForm(true)}>
              <Plus size={16} className="mr-2" /> {t('ops.travel.actions.expenseClaim')}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            activeTab === 'trips' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          <Plane size={16} /> {t('ops.travel.tabs.businessTrip')}
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            activeTab === 'claims' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          <ReceiptText size={16} /> {t('ops.travel.actions.expenseClaim')}
        </button>
      </div>

      {activeTab === 'trips' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {['', 'REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'].map((status) => (
            <button
              key={status || 'all-trips'}
              onClick={() => setTripStatus(status)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                tripStatus === status ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
              }`}
            >
              {status ? BUSINESS_TRIP_STATUS_LABELS[status as keyof typeof BUSINESS_TRIP_STATUS_LABELS] : t('ops.travel.filters.all')}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'claims' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {['', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED'].map((status) => (
            <button
              key={status || 'all-claims'}
              onClick={() => setClaimStatus(status)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                claimStatus === status ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
              }`}
            >
              {status ? EXPENSE_CLAIM_STATUS_LABELS[status as keyof typeof EXPENSE_CLAIM_STATUS_LABELS] : t('ops.travel.filters.all')}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('ops.travel.loadingData')}
        </div>
      ) : activeTab === 'trips' ? (
        <div className="space-y-4">
          {trips.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t('ops.travel.trips.empty')}
            </div>
          )}
          {trips.map((trip) => (
            <div key={trip.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{trip.destination}</h3>
                    <StatusBadge
                      label={BUSINESS_TRIP_STATUS_LABELS[trip.status]}
                      tone={trip.status === 'APPROVED' ? 'success' : trip.status === 'REJECTED' ? 'danger' : 'warning'}
                    />
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">{trip.purpose}</p>
                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <span>{t('ops.travel.trip.period', { start: dayjs(trip.startDate).format('DD MMM YYYY'), end: dayjs(trip.endDate).format('DD MMM YYYY') })}</span>
                    <span>{t('ops.travel.trip.estimate', { amount: Number(trip.estimatedCost).toLocaleString('id-ID') })}</span>
                    <span>{t('ops.travel.trip.claimCount', { count: trip._count?.expenseClaims || 0 })}</span>
                    {trip.employee && <span>{t('ops.travel.requester', { name: trip.employee.fullName })}</span>}
                  </div>
                  {!!trip.travelAdvances?.length && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                      {t('ops.travel.trip.lastAdvance', { amount: Number(trip.travelAdvances[0].amount).toLocaleString('id-ID') })}
                    </div>
                  )}
                </div>
                {isApprover && trip.status === 'REQUESTED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleTripApproval(trip.id, 'approve')}>
                      <CheckCircle2 size={15} className="mr-1.5" /> {t('ops.travel.actions.approve')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleTripApproval(trip.id, 'reject')}>
                      <XCircle size={15} className="mr-1.5" /> {t('ops.travel.actions.reject')}
                    </Button>
                  </div>
                )}
                {isApprover && trip.status === 'APPROVED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleCreateAdvance(trip.id)}>
                      <Wallet size={15} className="mr-1.5" /> {t('ops.travel.cashAdvance.title')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {claims.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t('ops.travel.claims.empty')}
            </div>
          )}
          {claims.map((claim) => (
            <div key={claim.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{categories.find((item) => item.value === claim.category)?.label || claim.category}</h3>
                    <StatusBadge
                      label={EXPENSE_CLAIM_STATUS_LABELS[claim.status]}
                      tone={
                        claim.status === 'APPROVED' || claim.status === 'REIMBURSED'
                          ? 'success'
                          : claim.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <span>{t('ops.travel.claim.amountLabel', { amount: Number(claim.amount).toLocaleString('id-ID') })}</span>
                    <span>{t('ops.travel.claim.dateLabel', { date: dayjs(claim.expenseDate).format('DD MMM YYYY') })}</span>
                    {claim.employee && <span>{t('ops.travel.requester', { name: claim.employee.fullName })}</span>}
                    {claim.trip && <span>{t('ops.travel.claim.tripLabel', { destination: claim.trip.destination })}</span>}
                  </div>
                  {claim.description && <p className="mt-2 text-sm text-muted-foreground">{claim.description}</p>}
                  {claim.receiptFilePath && (
                    <a href={`${appConfig.apiUrl}/private-files/receipts/${claim.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                      {t('ops.travel.claim.viewReceipt')}
                    </a>
                  )}
                </div>
                {isApprover && claim.status === 'SUBMITTED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleClaimAction(claim.id, 'approve')}>
                      <CheckCircle2 size={15} className="mr-1.5" /> {t('ops.travel.actions.approve')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleClaimAction(claim.id, 'reject')}>
                      <XCircle size={15} className="mr-1.5" /> {t('ops.travel.actions.reject')}
                    </Button>
                  </div>
                )}
                {isApprover && claim.status === 'APPROVED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleClaimAction(claim.id, 'reimburse')}>
                      <Wallet size={15} className="mr-1.5" /> {t('ops.travel.actions.reimburse')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showTripForm} onClose={() => setShowTripForm(false)} title={t('ops.travel.trip.form.title')}>
        <TripForm employeeId={employeeId} companyId={companyId} onClose={() => setShowTripForm(false)} onSuccess={refresh} />
      </Modal>

      <Modal open={showClaimForm} onClose={() => setShowClaimForm(false)} title={t('ops.travel.claim.form.title')}>
        <ClaimForm
          employeeId={employeeId}
          companyId={companyId}
          trips={trips}
          categories={categories}
          onClose={() => setShowClaimForm(false)}
          onSuccess={refresh}
        />
      </Modal>
    </div>
  );
}
