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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { useAuthStore } from '@/stores/auth.store';
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
      toast.error('Profil employee atau company belum tersedia');
      return;
    }

    setSaving(true);
    try {
      await travelExpenseService.createTrip({
        companyId,
        employeeId,
        destination,
        purpose,
        startDate: dayjs(startDate).toISOString(),
        endDate: dayjs(endDate).toISOString(),
        estimatedCost: Number(estimatedCost),
        notes: notes || undefined,
      });
      toast.success('Travel request berhasil dibuat');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal membuat travel request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tujuan *</label>
          <Input value={destination} onChange={(event) => setDestination(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estimasi Biaya *</label>
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
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tanggal Mulai *</label>
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tanggal Selesai *</label>
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tujuan Perjalanan *</label>
        <textarea
          rows={4}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Catatan</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Kirim Request'}
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
  const [tripId, setTripId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('TRANSPORTATION');
  const [amount, setAmount] = useState('0');
  const [expenseDate, setExpenseDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [description, setDescription] = useState('');
  const [receiptFilePath, setReceiptFilePath] = useState('');
  const [saving, setSaving] = useState(false);

  const selectableTrips = trips.filter((trip) => trip.status === 'APPROVED' || trip.status === 'COMPLETED');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId || !companyId) {
      toast.error('Profil employee atau company belum tersedia');
      return;
    }

    setSaving(true);
    try {
      await travelExpenseService.createClaim({
        companyId,
        employeeId,
        tripId: tripId || undefined,
        category,
        amount: Number(amount),
        expenseDate: dayjs(expenseDate).toISOString(),
        description: description || undefined,
        receiptFilePath: receiptFilePath || undefined,
      });
      toast.success('Expense claim berhasil dikirim');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal membuat expense claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Trip Terkait</label>
          <Select2
            value={tripId}
            onValueChange={setTripId}
            options={[
              { value: '', label: 'Tanpa trip spesifik' },
              ...selectableTrips.map((trip) => ({
                value: trip.id,
                label: `${trip.destination} (${dayjs(trip.startDate).format('DD MMM YYYY')})`,
              })),
            ]}
            placeholder="Pilih trip"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Kategori *</label>
          <Select2
            value={category}
            onValueChange={(value) => setCategory(value as ExpenseCategory)}
            options={categories}
            placeholder="Pilih kategori"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nominal *</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tanggal Expense *</label>
          <Input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Receipt URL / Path</label>
        <Input value={receiptFilePath} onChange={(event) => setReceiptFilePath(event.target.value)} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Deskripsi</label>
        <textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Kirim Claim'}
        </Button>
      </div>
    </form>
  );
}

export function TravelExpensePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'trips' | 'claims'>('trips');
  const [tripStatus, setTripStatus] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [trips, setTrips] = useState<BusinessTrip[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);

  const companyId = user?.companyId || localStorage.getItem('companyId') || '';
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
      toast.error('Gagal memuat kategori expense');
    }
  }, []);

  const loadTrips = useCallback(async () => {
    if (isApprover) {
      if (!companyId) return;
      const data = await travelExpenseService.findTrips(companyId, tripStatus || undefined);
      setTrips(data);
      return;
    }

    if (!employeeId) return;
    const data = await travelExpenseService.findMyTrips(employeeId, tripStatus || undefined);
    setTrips(data);
  }, [companyId, employeeId, isApprover, tripStatus]);

  const loadClaims = useCallback(async () => {
    if (isApprover) {
      if (!companyId) return;
      const data = await travelExpenseService.findClaims(companyId, claimStatus || undefined);
      setClaims(data);
      return;
    }

    if (!employeeId) return;
    const data = await travelExpenseService.findMyClaims(employeeId, claimStatus || undefined);
    setClaims(data);
  }, [claimStatus, companyId, employeeId, isApprover]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadTrips(), loadClaims()]);
    } catch {
      toast.error('Gagal memuat data travel & expense');
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadTrips, loadClaims]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleTripApproval = async (id: string, action: 'approve' | 'reject') => {
    const notes = await popup.prompt({
      title: action === 'approve' ? 'Approval Travel Request' : 'Reject Travel Request',
      description: action === 'approve' ? 'Tambahkan catatan approval bila perlu.' : 'Masukkan alasan penolakan.',
      placeholder: action === 'approve' ? 'Catatan approval (opsional)' : 'Alasan reject',
      required: action === 'reject',
      confirmText: action === 'approve' ? 'Approve' : 'Reject',
      intent: action === 'reject' ? 'destructive' : 'default',
    });
    if (action === 'reject' && !notes) return;
    try {
      if (action === 'approve') {
        await travelExpenseService.approveTrip(id, notes || undefined);
        toast.success('Travel request disetujui');
      } else {
        await travelExpenseService.rejectTrip(id, notes || undefined);
        toast.success('Travel request ditolak');
      }
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Aksi gagal diproses');
    }
  };

  const handleCreateAdvance = async (tripId: string) => {
    const amount = await popup.prompt({
      title: 'Cash Advance',
      description: 'Masukkan nominal cash advance untuk trip ini.',
      placeholder: 'Contoh: 1500000',
      required: true,
      confirmText: 'Simpan',
    });
    if (!amount) return;

    try {
      await travelExpenseService.createAdvance(tripId, { companyId, amount: Number(amount) });
      toast.success('Cash advance berhasil dicatat');
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal mencatat cash advance');
    }
  };

  const handleClaimAction = async (id: string, action: 'approve' | 'reject' | 'reimburse') => {
    try {
      if (action === 'approve') {
        const notes = await popup.prompt({
          title: 'Approve Expense Claim',
          description: 'Tambahkan catatan approval bila perlu.',
          placeholder: 'Catatan approval (opsional)',
          confirmText: 'Approve',
        });
        await travelExpenseService.approveClaim(id, notes || undefined);
        toast.success('Expense claim disetujui');
      } else if (action === 'reject') {
        const notes = await popup.prompt({
          title: 'Reject Expense Claim',
          description: 'Masukkan alasan penolakan claim.',
          placeholder: 'Alasan reject',
          required: true,
          confirmText: 'Reject',
          intent: 'destructive',
        });
        if (!notes) return;
        await travelExpenseService.rejectClaim(id, notes || undefined);
        toast.success('Expense claim ditolak');
      } else {
        const method = (await popup.select({
          title: 'Metode Reimbursement',
          description: 'Pilih metode reimbursement untuk claim ini.',
          value: 'TRANSFER',
          options: [
            { value: 'TRANSFER', label: 'TRANSFER' },
            { value: 'PAYROLL', label: 'PAYROLL' },
          ],
          required: true,
          confirmText: 'Proses',
        })) as ReimbursementMethod | null;
        if (!method) return;
        await travelExpenseService.reimburseClaim(id, { companyId, method });
        toast.success('Reimbursement berhasil dicatat');
      }
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Aksi gagal diproses');
    }
  };

  return (
    <div>
      <PageHeader
        title="Travel & Expense"
        description="Kelola pengajuan perjalanan dinas dan klaim biaya operasional"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowTripForm(true)}>
              <Plus size={16} className="mr-2" /> Travel Request
            </Button>
            <Button size="sm" onClick={() => setShowClaimForm(true)}>
              <Plus size={16} className="mr-2" /> Expense Claim
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
          <Plane size={16} /> Business Trip
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            activeTab === 'claims' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          <ReceiptText size={16} /> Expense Claim
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
              {status ? BUSINESS_TRIP_STATUS_LABELS[status as keyof typeof BUSINESS_TRIP_STATUS_LABELS] : 'Semua'}
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
              {status ? EXPENSE_CLAIM_STATUS_LABELS[status as keyof typeof EXPENSE_CLAIM_STATUS_LABELS] : 'Semua'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Memuat data...
        </div>
      ) : activeTab === 'trips' ? (
        <div className="space-y-4">
          {trips.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Belum ada data business trip.
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
                    <span>Periode: {dayjs(trip.startDate).format('DD MMM YYYY')} - {dayjs(trip.endDate).format('DD MMM YYYY')}</span>
                    <span>Estimasi: Rp {Number(trip.estimatedCost).toLocaleString('id-ID')}</span>
                    <span>Expense claim: {trip._count?.expenseClaims || 0}</span>
                    {trip.employee && <span>Pemohon: {trip.employee.fullName}</span>}
                  </div>
                  {!!trip.travelAdvances?.length && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                      Advance terakhir: Rp {Number(trip.travelAdvances[0].amount).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
                {isApprover && trip.status === 'REQUESTED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleTripApproval(trip.id, 'approve')}>
                      <CheckCircle2 size={15} className="mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleTripApproval(trip.id, 'reject')}>
                      <XCircle size={15} className="mr-1.5" /> Reject
                    </Button>
                  </div>
                )}
                {isApprover && trip.status === 'APPROVED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleCreateAdvance(trip.id)}>
                      <Wallet size={15} className="mr-1.5" /> Cash Advance
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
              Belum ada expense claim.
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
                    <span>Nominal: Rp {Number(claim.amount).toLocaleString('id-ID')}</span>
                    <span>Tanggal: {dayjs(claim.expenseDate).format('DD MMM YYYY')}</span>
                    {claim.employee && <span>Pemohon: {claim.employee.fullName}</span>}
                    {claim.trip && <span>Trip: {claim.trip.destination}</span>}
                  </div>
                  {claim.description && <p className="mt-2 text-sm text-muted-foreground">{claim.description}</p>}
                  {claim.receiptFilePath && (
                    <a href={claim.receiptFilePath} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                      Lihat receipt
                    </a>
                  )}
                </div>
                {isApprover && claim.status === 'SUBMITTED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleClaimAction(claim.id, 'approve')}>
                      <CheckCircle2 size={15} className="mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleClaimAction(claim.id, 'reject')}>
                      <XCircle size={15} className="mr-1.5" /> Reject
                    </Button>
                  </div>
                )}
                {isApprover && claim.status === 'APPROVED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleClaimAction(claim.id, 'reimburse')}>
                      <Wallet size={15} className="mr-1.5" /> Reimburse
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showTripForm} onClose={() => setShowTripForm(false)} title="Ajukan Business Trip">
        <TripForm employeeId={employeeId} companyId={companyId} onClose={() => setShowTripForm(false)} onSuccess={refresh} />
      </Modal>

      <Modal open={showClaimForm} onClose={() => setShowClaimForm(false)} title="Ajukan Expense Claim">
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
