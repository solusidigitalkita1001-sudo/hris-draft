import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { leaveService, type LeaveBalance, type LeaveType } from '@/services/leave.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';

/**
 * Form pengajuan cuti self-service (POST /leave).
 * Backend selalu memaksa employeeId ke karyawan yang login (leave.controller.create),
 * jadi form ini hanya mengajukan untuk diri sendiri.
 */
export function LeaveRequestForm({ companyId, employeeId, onSuccess, onClose }: {
  companyId: string;
  employeeId: string;
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [typeList, balanceList] = await Promise.all([
          leaveService.getTypes(companyId),
          leaveService.getBalances(employeeId).catch(() => [] as LeaveBalance[]),
        ]);
        if (cancelled) return;
        const activeTypes = typeList.filter((t) => t.isActive !== false);
        setTypes(activeTypes);
        setBalances(balanceList);
        // Default ke jenis cuti yang benar-benar punya saldo; memilih jenis
        // tanpa alokasi sebagai default hanya memancing pengajuan yang pasti
        // ditolak server.
        const firstWithBalance = activeTypes.find((type) =>
          balanceList.some((b) => b.leaveTypeId === type.id && b.remainingDays > 0)
        );
        setLeaveTypeId((current) => current || firstWithBalance?.id || activeTypes[0]?.id || '');
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, t('ess.leave.form.toast.loadTypesFailed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, employeeId, t]);

  // Saldo dibebankan ke tahun tanggal MULAI cuti — sama dengan server
  // (shared/leave/balance-policy.leaveBalanceYear), yang juga memakai tahun
  // startDate saat memotong maupun mengembalikan saldo.
  const balanceYear = Number(startDate.slice(0, 4)) || new Date().getFullYear();
  const balanceForType = (typeId: string) =>
    balances.find((b) => b.leaveTypeId === typeId && b.year === balanceYear);

  const selectedBalance = balanceForType(leaveTypeId);
  const selectedType = types.find((t) => t.id === leaveTypeId);

  // Perkiraan hari kerja Sen–Jum. Server menghitung ulang lewat kalender kerja
  // karyawan/perusahaan dan hari libur nasional (leave.repository.countLeaveDays),
  // jadi angka ini hanya indikasi — server tetap sumber kebenaran.
  const estimatedWorkingDays = (() => {
    const from = Date.parse(`${startDate}T00:00:00Z`);
    const to = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
    let workdays = 0;
    for (let cursor = from; cursor <= to; cursor += 86_400_000) {
      const weekday = new Date(cursor).getUTCDay();
      if (weekday !== 0 && weekday !== 6) workdays += 1;
    }
    return Math.max(1, workdays);
  })();

  // Gerbang saldo versi klien, mencerminkan aturan server: baris saldo untuk
  // (jenis, tahun) wajib ada dan sisanya harus >= hari kerja yang diajukan.
  const balanceIssue: 'NO_ALLOCATION' | 'INSUFFICIENT' | null = (() => {
    if (loading || !leaveTypeId) return null;
    if (!selectedBalance) return 'NO_ALLOCATION';
    if (estimatedWorkingDays !== null && selectedBalance.remainingDays < estimatedWorkingDays) {
      return 'INSUFFICIENT';
    }
    return null;
  })();

  const typeOptions = types.map((type) => {
    const balance = balanceForType(type.id);
    return {
      value: type.id,
      label: balance
        ? t('ess.leave.form.option.withBalance', { type: type.name, days: balance.remainingDays })
        : t('ess.leave.form.option.noBalance', { type: type.name }),
      // Server mewajibkan alokasi saldo untuk SEMUA jenis cuti — termasuk yang
      // isPaid=false — karena pemotongan saldo saat approval juga mewajibkannya.
      // Jadi jenis tanpa alokasi dinonaktifkan, bukan sekadar ditandai.
      disabled: !balance,
    };
  });

  // Aturan H-7 (kalender harian, date-only): pengajuan pada H-7 atau lebih awal
  // boleh tanpa lampiran; kurang dari H-7 wajib lampiran. Backend tetap
  // memvalidasi ulang sebagai sumber kebenaran.
  const daysUntilStart = (() => {
    if (!startDate) return null;
    const [y, m, d] = startDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((Date.UTC(y, m - 1, d) - todayUtc) / 86_400_000);
  })();
  const lessThanH7 = daysUntilStart !== null && daysUntilStart < 7;
  const attachmentRequired = lessThanH7 || Boolean(selectedType?.requiresAttachment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !employeeId) return toast.error(t('ess.leave.form.toast.notLinked'));
    if (!leaveTypeId) return toast.error(t('ess.leave.form.toast.selectTypeFirst'));
    if (!startDate || !endDate) return toast.error(t('ess.leave.form.toast.datesRequired'));
    if (new Date(endDate) < new Date(startDate)) return toast.error(t('ess.leave.form.toast.endBeforeStart'));
    // Cegah pengajuan yang pasti ditolak server karena saldo (leave.service
    // createLeaveRequest). Perkiraan hari kerja klien bisa lebih besar dari
    // hitungan server bila ada hari libur, jadi ini hanya menahan kasus jelas.
    if (balanceIssue === 'NO_ALLOCATION') return toast.error(t('ess.leave.form.toast.noBalanceForType'));
    if (balanceIssue === 'INSUFFICIENT' && selectedBalance) {
      return toast.error(t('ess.leave.form.toast.insufficientBalance', {
        remaining: selectedBalance.remainingDays,
        days: estimatedWorkingDays ?? 0,
      }));
    }
    if (!reason.trim()) return toast.error(t('ess.common.reasonRequired'));
    if (attachmentRequired && !attachmentFile) {
      return toast.error(
        lessThanH7
          ? t('ess.leave.form.toast.h7AttachmentRequired')
          : selectedType?.name
            ? t('ess.leave.form.toast.typeAttachmentRequired', { type: selectedType.name })
            : t('ess.leave.form.toast.typeAttachmentRequiredNoName')
      );
    }

    setSaving(true);
    try {
      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        const uploaded = await leaveService.uploadAttachment(attachmentFile);
        attachmentUrl = uploaded.url;
      }
      await leaveService.createRequest({
        employeeId,
        companyId,
        leaveTypeId,
        // Tanggal kalender dipatok ke UTC: `T00:00:00` tanpa zona diparse
        // sebagai waktu lokal, sehingga di zona timur UTC tanggalnya mundur
        // satu hari saat dikirim ke server.
        startDate: new Date(`${startDate}T00:00:00Z`).toISOString(),
        endDate: new Date(`${endDate}T00:00:00Z`).toISOString(),
        reason: reason.trim(),
        attachment: attachmentUrl,
      });
      toast.success(t('ess.leave.form.toast.submitSuccess'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.leave.form.toast.submitFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ess.leave.table.leaveType')} *</label>
        <Select2
          value={leaveTypeId}
          onValueChange={setLeaveTypeId}
          options={typeOptions}
          placeholder={loading ? t('ess.leave.form.loadingTypes') : t('ess.leave.form.selectType')}
          disabled={loading}
          className="h-9"
        />
        {selectedBalance && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t('ess.leave.form.balancePrefix', {
              type: selectedBalance.leaveType?.name || t('ess.leave.form.balanceFallbackType'),
              year: selectedBalance.year,
            })}{' '}
            <span className="font-medium text-foreground">{t('ess.leave.form.balanceRemaining', { days: selectedBalance.remainingDays })}</span>
            {' '}{t('ess.leave.form.balanceUsed', { used: selectedBalance.usedDays, total: selectedBalance.totalDays })}
          </p>
        )}
        {!loading && balances.length === 0 && (
          <p className="mt-1.5 text-[11px] text-danger">{t('ess.leave.form.balanceWarn.noBalanceAtAll')}</p>
        )}
        {balanceIssue === 'NO_ALLOCATION' && balances.length > 0 && (
          <p className="mt-1.5 text-[11px] text-danger">
            {t('ess.leave.form.balanceWarn.noAllocation', {
              type: selectedType?.name || t('ess.leave.form.balanceFallbackType'),
              year: balanceYear,
            })}
          </p>
        )}
        {balanceIssue === 'INSUFFICIENT' && selectedBalance && (
          <p className="mt-1.5 text-[11px] text-danger">
            {t('ess.leave.form.balanceWarn.insufficient', {
              type: selectedBalance.leaveType?.name || selectedType?.name || t('ess.leave.form.balanceFallbackType'),
              remaining: selectedBalance.remainingDays,
              days: estimatedWorkingDays ?? 0,
            })}
          </p>
        )}
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ess.leave.detail.startDate')} *</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ess.leave.detail.endDate')} *</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </div>
        {estimatedWorkingDays !== null && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t('ess.leave.form.estimatedDuration', { days: estimatedWorkingDays })}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ess.common.reason')} *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('ess.leave.form.reasonPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          {t('ess.common.attachment')} {attachmentRequired ? <span className="text-danger">*</span> : <span>{t('ess.common.optional')}</span>}
        </label>
        <Input
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file && file.size > 5 * 1024 * 1024) {
              toast.error(t('ess.common.attachmentTooLarge'));
              e.target.value = '';
              setAttachmentFile(null);
              return;
            }
            setAttachmentFile(file);
          }}
        />
        {lessThanH7 ? (
          <p className="mt-1.5 text-[11px] text-danger">
            {t('ess.leave.form.hint.lateWarning', {
              when: daysUntilStart !== null && daysUntilStart >= 0 ? `H-${daysUntilStart}` : t('ess.leave.form.hint.startPassed'),
            })}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t('ess.leave.form.hint.h7Info')}
          </p>
        )}
        {!lessThanH7 && selectedType?.requiresAttachment && (
          <p className="mt-1 text-[11px] text-danger">
            {t('ess.leave.form.hint.typeRequiresAttachment', { type: selectedType.name })}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">{t('ess.common.attachmentFormatHint')}</p>
        {attachmentFile && (
          <p className="mt-1 text-[11px] text-muted-foreground">{t('ess.common.attachmentSelected', { name: attachmentFile.name })}</p>
        )}
      </div>

      {balances.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('ess.leave.form.myBalances')}</p>
          <div className="space-y-1">
            {balances.map((b) => (
              <div key={b.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{b.leaveType?.name || b.leaveTypeId}</span>
                <span className="font-medium">{t('ess.leave.form.balanceRow', { remaining: b.remainingDays, total: b.totalDays })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving || loading}>
          {saving ? t('ess.common.sending') : t('ess.leave.form.submit')}
        </Button>
      </div>
    </form>
  );
}
