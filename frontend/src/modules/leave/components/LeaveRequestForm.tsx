import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { leaveService, type LeaveBalance, type LeaveType } from '@/services/leave.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { apiErrorMessage } from '@/lib/errors';

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
        setLeaveTypeId((current) => current || activeTypes[0]?.id || '');
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Gagal memuat jenis cuti'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, employeeId]);

  const selectedBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);
  const selectedType = types.find((t) => t.id === leaveTypeId);

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
    if (!companyId || !employeeId) return toast.error('Akun ini tidak tertaut ke data karyawan/perusahaan');
    if (!leaveTypeId) return toast.error('Pilih jenis cuti terlebih dahulu');
    if (!startDate || !endDate) return toast.error('Tanggal mulai dan selesai wajib diisi');
    if (new Date(endDate) < new Date(startDate)) return toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai');
    if (!reason.trim()) return toast.error('Alasan wajib diisi');
    if (attachmentRequired && !attachmentFile) {
      return toast.error(
        lessThanH7
          ? 'Pengajuan cuti kurang dari H-7 wajib menyertakan lampiran'
          : `Jenis cuti ${selectedType?.name ?? 'ini'} wajib menyertakan lampiran dokumen`
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
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${endDate}T00:00:00`).toISOString(),
        reason: reason.trim(),
        attachment: attachmentUrl,
      });
      toast.success('Pengajuan cuti berhasil dikirim');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengajukan cuti'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Jenis Cuti *</label>
        <Select2
          value={leaveTypeId}
          onValueChange={setLeaveTypeId}
          options={types.map((t) => ({ value: t.id, label: t.name }))}
          placeholder={loading ? 'Memuat jenis cuti...' : 'Pilih jenis cuti'}
          disabled={loading}
          className="h-9"
        />
        {selectedBalance && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Saldo {selectedBalance.leaveType?.name || 'cuti'} tahun {selectedBalance.year}:{' '}
            <span className="font-medium text-foreground">{selectedBalance.remainingDays} hari tersisa</span>
            {' '}(terpakai {selectedBalance.usedDays} dari {selectedBalance.totalDays})
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tanggal Mulai *</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tanggal Selesai *</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Alasan *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Jelaskan alasan pengajuan cuti..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Lampiran {attachmentRequired ? <span className="text-danger">*</span> : <span>(opsional)</span>}
        </label>
        <Input
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file && file.size > 5 * 1024 * 1024) {
              toast.error('Ukuran file lampiran maksimal 5MB');
              e.target.value = '';
              setAttachmentFile(null);
              return;
            }
            setAttachmentFile(file);
          }}
        />
        {lessThanH7 ? (
          <p className="mt-1.5 text-[11px] text-danger">
            Tanggal mulai {daysUntilStart !== null && daysUntilStart >= 0 ? `H-${daysUntilStart}` : 'sudah lewat'}: pengajuan &lt; H-7 wajib melampirkan dokumen.
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Pengajuan &lt; H-7 wajib melampirkan dokumen pendukung.
          </p>
        )}
        {!lessThanH7 && selectedType?.requiresAttachment && (
          <p className="mt-1 text-[11px] text-danger">
            Jenis cuti {selectedType.name} wajib melampirkan dokumen.
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">Format: JPG, PNG, GIF, atau PDF. Maks 5MB.</p>
        {attachmentFile && (
          <p className="mt-1 text-[11px] text-muted-foreground">File terpilih: {attachmentFile.name}</p>
        )}
      </div>

      {balances.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Saldo Cuti Saya</p>
          <div className="space-y-1">
            {balances.map((b) => (
              <div key={b.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{b.leaveType?.name || b.leaveTypeId}</span>
                <span className="font-medium">{b.remainingDays} / {b.totalDays} hari</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
        <Button type="submit" size="sm" disabled={saving || loading}>
          {saving ? 'Mengirim...' : 'Ajukan Cuti'}
        </Button>
      </div>
    </form>
  );
}
