import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  payrollService,
  type MyPayslipSummary,
  type MyPayslipDetail,
  type PayslipPinStatus,
  type PayslipUnlockGrant,
} from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { AppModal } from '@/components/shared/AppModal';
import { StatusChip, statusTone } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/button';
import { PayslipPinDialog } from '@/modules/payroll/components/PayslipPinDialog';
import {
  RefreshCw, Receipt, Lock, LockOpen, CalendarDays, KeyRound, Download, ShieldCheck,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { apiErrorMessage, apiErrorStatus } from '@/lib/errors';

/**
 * Slip Gaji Saya — alur 3 tahap sesuai handoff:
 * 1. Daftar periode dengan nominal tersamar (Rp •••••••• + badge terkunci).
 * 2. Tombol "Buka" → modal PIN 6 digit; PIN diverifikasi SERVER-side dan server
 *    baru mengirim nominal setelah unlock (token 15 menit, disimpan di state
 *    memory saja — sengaja tidak pernah menyentuh localStorage).
 * 3. Setelah terbuka: take-home pay tampil di daftar; klik item menampilkan
 *    detail (kartu take home pay, Pendapatan & Potongan, unduh PDF).
 */
export function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<MyPayslipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinStatus, setPinStatus] = useState<PayslipPinStatus | null>(null);

  // Token unlock HANYA di memory — hilang saat halaman ditutup/refresh.
  const [grant, setGrant] = useState<PayslipUnlockGrant | null>(null);
  const [details, setDetails] = useState<Record<string, MyPayslipDetail>>({});
  const [dialog, setDialog] = useState<'set' | 'unlock' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlocked = Boolean(grant && Date.parse(grant.expiresAt) > Date.now());

  const relock = useCallback((message?: string) => {
    setGrant(null);
    setDetails({});
    setSelectedId(null);
    if (message) toast(message);
  }, []);

  // Kunci ulang otomatis persis saat token kedaluwarsa.
  useEffect(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    if (!grant) return;
    const remaining = Date.parse(grant.expiresAt) - Date.now();
    if (remaining <= 0) {
      relock();
      return;
    }
    expiryTimer.current = setTimeout(() => relock('Sesi buka slip gaji berakhir. Masukkan PIN kembali.'), remaining);
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [grant, relock]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, status] = await Promise.all([
        payrollService.getMyPayslips(),
        payrollService.getPayslipPinStatus().catch(() => null),
      ]);
      setPayslips(list);
      setPinStatus(status);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat slip gaji'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Setelah unlock: ambil detail seluruh periode agar take-home pay tampil di daftar. */
  const handleUnlocked = useCallback(async (nextGrant: PayslipUnlockGrant) => {
    setGrant(nextGrant);
    setPinStatus((prev) => (prev ? { ...prev, lockedUntil: undefined } : prev));
    const results = await Promise.allSettled(
      payslips.map((p) => payrollService.getMyPayslipDetail(p.id, nextGrant.unlockToken)),
    );
    const nextDetails: Record<string, MyPayslipDetail> = {};
    let expired = false;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') nextDetails[result.value.id] = result.value;
      else if (apiErrorStatus(result.reason) === 403) expired = true;
      else if (payslips[index]) toast.error(apiErrorMessage(result.reason, 'Gagal memuat detail slip gaji'));
    });
    if (expired) {
      relock('Sesi buka slip gaji berakhir. Masukkan PIN kembali.');
      return;
    }
    setDetails(nextDetails);
  }, [payslips, relock]);

  const handleDownloadPdf = useCallback(async (id: string) => {
    if (!grant) return;
    setDownloadingId(id);
    try {
      const blob = await payrollService.downloadMyPayslipPdf(id, grant.unlockToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `slip-gaji-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (apiErrorStatus(err) === 403) relock('Sesi buka slip gaji berakhir. Masukkan PIN kembali.');
      else toast.error(apiErrorMessage(err, 'Gagal mengunduh PDF slip gaji'));
    } finally {
      setDownloadingId(null);
    }
  }, [grant, relock]);

  const selectedDetail = selectedId ? details[selectedId] : null;
  const selectedSummary = useMemo(
    () => (selectedId ? payslips.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, payslips],
  );

  const pinReady = pinStatus?.pinSet === true;

  return (
    <div>
      <PageHeader
        title="Slip Gaji Saya"
        description="Daftar slip gaji Anda per periode payroll"
        actions={
          <div className="flex flex-wrap gap-2">
            {pinReady && (
              <Button variant="outline" size="sm" onClick={() => setDialog('set')}>
                <KeyRound size={14} className="mr-2" /> Ubah PIN
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Banner status kunci */}
      {unlocked ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-card-sm border border-success/25 bg-success-bg p-3.5">
          <LockOpen size={14} className="mt-0.5 shrink-0 text-success" />
          <p className="text-xs text-success">
            Nominal terbuka sampai {grant ? formatDateTime(grant.expiresAt) : '-'}. Setelah itu halaman
            terkunci otomatis dan PIN diminta kembali.
          </p>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2.5 rounded-card-sm border border-border bg-muted/30 p-3.5">
          <Lock size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Untuk keamanan, nominal slip gaji disembunyikan dan hanya dikirim server setelah PIN
            6 digit Anda terverifikasi.
          </p>
        </div>
      )}

      {/* CTA atur PIN bila belum diset */}
      {!loading && pinStatus !== null && !pinReady && (
        <div className="mb-4 flex flex-wrap items-center gap-3.5 rounded-card border border-border bg-card p-5 shadow-card">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-accent">
            <ShieldCheck size={18} className="text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">PIN slip gaji belum diatur</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Atur PIN 6 digit sekali saja untuk bisa membuka nominal slip gaji Anda.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialog('set')}>
            <KeyRound size={14} className="mr-1.5" /> Atur PIN
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Memuat slip gaji...</p>
        </div>
      ) : payslips.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Receipt size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada slip gaji yang diterbitkan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((p) => {
            const detail = details[p.id];
            const isOpen = unlocked && detail;
            return (
              <div key={p.id} className="rounded-card border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[14px] bg-accent">
                    <Receipt size={17} className="text-primary" />
                  </span>
                  <div className="min-w-0 flex-[1_1_200px]">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {p.payrollRun?.period?.name || p.payrollRun?.name || 'Periode payroll'}
                      </p>
                      <StatusChip tone={statusTone(p.status)}>{p.status}</StatusChip>
                      {!isOpen && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Lock size={11} /> Terkunci
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {p.payrollRun?.period && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={12} />
                          {formatDate(p.payrollRun.period.startDate)} — {formatDate(p.payrollRun.period.endDate)}
                        </span>
                      )}
                      {p.payrollRun?.period?.payDate && (
                        <span>Tanggal bayar: {formatDate(p.payrollRun.period.payDate)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    {isOpen ? (
                      <p className="text-[15px] font-semibold tracking-[-0.3px] text-foreground">
                        {formatCurrency(detail.netPay)}
                      </p>
                    ) : (
                      <p className="text-[13px] font-semibold tracking-[1px] text-muted-foreground">Rp ••••••••</p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">take home pay</p>
                  </div>
                  {isOpen ? (
                    <Button size="sm" variant="outline" className="flex-none rounded-[13px]" onClick={() => setSelectedId(p.id)}>
                      Lihat detail
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-none rounded-[13px]"
                      onClick={() => setDialog(pinReady ? 'unlock' : 'set')}
                    >
                      <Lock size={12} className="mr-1.5" /> Buka
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal set/ubah & unlock PIN (komponen bersama) */}
      <PayslipPinDialog
        open={dialog !== null}
        mode={dialog ?? 'unlock'}
        pinAlreadySet={pinReady}
        lockedUntil={pinStatus?.lockedUntil}
        onClose={() => setDialog(null)}
        onPinSaved={() => setPinStatus({ pinSet: true })}
        onUnlocked={handleUnlocked}
      />

      {/* Modal detail payslip */}
      <AppModal
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedId(null)}
        title={selectedSummary?.payrollRun?.period?.name || selectedSummary?.payrollRun?.name || 'Detail slip gaji'}
        description={
          selectedSummary?.payrollRun?.period
            ? `${formatDate(selectedSummary.payrollRun.period.startDate)} — ${formatDate(selectedSummary.payrollRun.period.endDate)}`
            : undefined
        }
        maxWidth="max-w-xl"
      >
        {selectedDetail && (
          <div className="space-y-4">
            {/* Kartu take home pay gradien primary → #26496F */}
            <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary to-[#26496F] p-5 text-white">
              <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/[.08]" aria-hidden="true" />
              <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-white/70">Take home pay</p>
              <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-1px]">
                {formatCurrency(selectedDetail.breakdown.takeHomePay)}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-white/80">
                <span>Pendapatan {formatCurrency(selectedDetail.breakdown.totalEarnings)}</span>
                <span>Potongan {formatCurrency(selectedDetail.breakdown.totalDeductions)}</span>
                {selectedSummary?.payrollRun?.period?.payDate && (
                  <span>Dibayar {formatDate(selectedSummary.payrollRun.period.payDate)}</span>
                )}
              </div>
            </div>

            {/* Pendapatan */}
            <div className="rounded-card-sm border border-border bg-background p-4">
              <h4 className="text-[12.5px] font-semibold text-foreground">Pendapatan</h4>
              <div className="mt-2.5 space-y-2">
                {selectedDetail.breakdown.earnings.map((row, index) => (
                  <div key={row.id ?? `${row.name}-${index}`} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs text-muted-foreground" title={row.description}>{row.name}</span>
                    <span className="text-xs font-medium text-foreground">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <span className="text-xs font-semibold text-foreground">Total pendapatan</span>
                  <span className="text-xs font-semibold text-foreground">
                    {formatCurrency(selectedDetail.breakdown.totalEarnings)}
                  </span>
                </div>
              </div>
            </div>

            {/* Potongan */}
            <div className="rounded-card-sm border border-border bg-background p-4">
              <h4 className="text-[12.5px] font-semibold text-foreground">Potongan</h4>
              <div className="mt-2.5 space-y-2">
                {selectedDetail.breakdown.deductions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tidak ada potongan pada periode ini.</p>
                ) : (
                  selectedDetail.breakdown.deductions.map((row, index) => (
                    <div key={row.id ?? `${row.name}-${index}`} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-xs text-muted-foreground" title={row.description}>{row.name}</span>
                      <span className="text-xs font-medium text-danger">-{formatCurrency(row.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <span className="text-xs font-semibold text-foreground">Total potongan</span>
                  <span className="text-xs font-semibold text-danger">
                    -{formatCurrency(selectedDetail.breakdown.totalDeductions)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => handleDownloadPdf(selectedDetail.id)}
                disabled={downloadingId === selectedDetail.id}
              >
                <Download size={14} className="mr-1.5" />
                {downloadingId === selectedDetail.id ? 'Menyiapkan PDF...' : 'Unduh PDF'}
              </Button>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}
