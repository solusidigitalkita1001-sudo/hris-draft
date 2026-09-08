import axios from 'axios';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { payrollPaymentService as service, paymentRequestKey, type PaymentBatch, type PaymentBatchStatus,
  type PaymentExport, type PaymentTransaction, type RecordPayment } from '@/services/payroll-payment.service';

const labels: Record<PaymentBatchStatus | 'PENDING', string> = {
  DRAFT: 'Belum diekspor', EXPORTED: 'File diekspor', PROCESSING: 'Sedang dicatat', PAID: 'Tercatat dibayar',
  PARTIALLY_FAILED: 'Sebagian gagal', FAILED: 'Gagal', RECONCILED: 'Sudah direkonsiliasi', CANCELLED: 'Dibatalkan', PENDING: 'Belum dicatat',
};
const money = (value: string) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', minimumFractionDigits: 2,
}).format(Number(value));
function errorMessage(error: unknown) {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message : 'Data pembayaran belum berhasil diperbarui. Periksa koneksi lalu coba lagi.';
}

export function PayrollPaymentPanel({ runId, runStatus, onReconciled }: {
  runId: string; runStatus: string; onReconciled: () => Promise<void>;
}) {
  const user = useAuthStore(state => state.user);
  const permitted = useAuthStore(state => state.hasPermission('payroll', 'process'));
  const canDisburse = useAuthStore(state => state.hasPermission('payroll', 'disburse'));
  const [batch, setBatch] = useState<PaymentBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [files, setFiles] = useState<PaymentExport['groups']>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'reconcile' | 'cancel' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  const keys = useRef(new Map<string, { fingerprint: string; key: string }>());

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    if (!permitted) { setLoading(false); return () => { active.current = false; }; }
    void service.forRun(runId, controller.signal).then(data => {
      if (!controller.signal.aborted) setBatch(data);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { active.current = false; controller.abort(); };
  }, [runId, reload, permitted]);

  async function perform(action: string, payload: unknown, work: (key: string) => Promise<PaymentBatch>): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError(null); setNotice('');
    const request = paymentRequestKey(keys.current.get(action), payload);
    keys.current.set(action, request);
    try {
      const updated = await work(request.key);
      if (!active.current) return false;
      setBatch(updated); setFiles([]); setConfirmation(null); setConfirmed(false);
      keys.current.delete(action);
      setNotice('Data pembayaran tersimpan.');
      if (updated.status === 'RECONCILED') await onReconciled();
      return true;
    } catch (cause) { if (active.current) setError(errorMessage(cause)); return false; }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }

  async function prepareFiles() {
    if (!batch || pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const exported = await service.export(batch.id);
      if (active.current) { setBatch(exported.batch); setFiles(exported.groups); setNotice('File siap diunduh. Belum ada pembayaran yang dikirim ke bank.'); }
    } catch (cause) { if (active.current) setError(errorMessage(cause)); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }
  function download(file: PaymentExport['groups'][number]) {
    const url = URL.createObjectURL(new Blob([file.csv.content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = file.csv.filename; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const closed = batch?.status === 'RECONCILED' || batch?.status === 'CANCELLED';
  const checker = Boolean(batch && batch.runApprovedBy === user?.id);
  const canRecord = Boolean(batch && canDisburse && !closed && !checker && batch.status !== 'DRAFT' && batch.status !== 'PAID');
  const current = batch?.transactions.find(transaction => transaction.id === selected);
  const allPaid = Boolean(batch?.transactions.length && batch.transactions.every(transaction =>
    transaction.status === 'PAID' && transaction.paidAmount === transaction.expectedAmount));

  return <section aria-labelledby="payment-heading" className="mb-6 rounded-xl border border-border bg-background p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="payment-heading" className="text-lg font-semibold">Pembayaran payroll</h2>
      {batch && <span className="text-sm font-medium">{labels[batch.status]}</span>}
    </div>
    <p className="mt-2 max-w-prose text-sm text-muted-foreground">Ekspor file untuk diproses melalui bank, lalu catat hasil setiap pembayaran. Payroll selesai setelah semua nominal cocok dan direkonsiliasi.</p>
    {!permitted ? <p className="mt-4 text-sm">Akses proses payroll diperlukan untuk mengelola pembayaran.</p> : <>
      {error && <div role="alert" className="mt-4 text-sm text-destructive"><p>{error}</p>
        <Button variant="outline" className="mt-2" disabled={busy} onClick={() => { setSelected(null); setFiles([]); setReload(value => value + 1); }}>Muat ulang pembayaran</Button>
      </div>}
      <p role="status" className="mt-3 text-sm">{loading ? 'Memuat pembayaran…' : notice}</p>
      {!loading && !batch && !error && (runStatus === 'DISBURSED'
        ? <p className="mt-3 text-sm">Payroll lama ini belum memiliki riwayat rekonsiliasi per transaksi.</p>
        : <div className="mt-3 space-y-3"><p className="text-sm">Daftar pembayaran belum dibuat. Nominal dan rekening akan disimpan dari slip yang disetujui.</p>
          <Button disabled={busy} onClick={() => void perform('create', { runId }, key => service.create(runId, key))}>{busy ? 'Menyimpan…' : 'Buat daftar pembayaran'}</Button></div>)}
      {!loading && batch && <>
        <p className="mt-3 text-sm font-medium tabular-nums">{batch.transactionCount} pegawai · {money(batch.totalAmount)}</p>
        {checker && <p className="mt-3 text-sm text-muted-foreground">Pencatatan dan rekonsiliasi harus dilakukan pengguna selain pemberi persetujuan payroll.</p>}
        {!canDisburse && <p className="mt-3 text-sm text-muted-foreground">Hak akses pencairan payroll diperlukan untuk mencatat hasil dan merekonsiliasi pembayaran.</p>}
        {!closed && !allPaid && <div className="mt-4 space-y-2">
          <Button variant="outline" disabled={busy} onClick={() => void prepareFiles()}>{busy ? 'Memproses…' : 'Siapkan file bank'}</Button>
          <p className="max-w-prose text-sm text-muted-foreground">Hanya transaksi yang belum tercatat dibayar masuk file. Cocokkan format dengan ketentuan bank dan periksa transaksi di bank sebelum mengirim ulang. File berisi rekening lengkap; simpan dengan akses terbatas.</p>
        </div>}
        {files.length > 0 && <ul className="mt-3 space-y-2">{files.map(file => <li key={file.bankCode}>
          <Button variant="link" className="h-auto whitespace-normal px-0 text-left" onClick={() => download(file)}>Unduh {file.bankName} · {file.employeeCount} pegawai · {money(file.totalAmount)}</Button>
        </li>)}</ul>}
        <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Daftar hasil pembayaran">
          <table className="w-full min-w-[44rem] text-sm"><caption className="sr-only">Pembayaran per pegawai; rekening disamarkan</caption>
            <thead><tr className="border-b border-border text-left">
              <th scope="col" className="py-3 pr-4">Pegawai / rekening</th><th scope="col" className="p-3 text-right">Nominal</th><th scope="col" className="p-3">Hasil</th><th scope="col" className="py-3 pl-3">Tindakan</th>
            </tr></thead><tbody>{batch.transactions.map(transaction => <tr key={transaction.id} className="border-b border-border last:border-0">
              <th scope="row" className="max-w-xs py-3 pr-4 text-left font-normal"><span className="block break-words font-medium">{transaction.employeeName}</span><span className="text-muted-foreground">{transaction.bankName} · {transaction.accountNumberMasked}<br />{transaction.accountHolderMasked}</span></th>
              <td className="whitespace-nowrap p-3 text-right tabular-nums">{money(transaction.expectedAmount)}</td>
              <td className="max-w-xs break-words p-3">{labels[transaction.status]}{transaction.bankReferenceMasked && <span className="block text-muted-foreground">Ref. {transaction.bankReferenceMasked}</span>}{transaction.failureReason && <span className="block text-muted-foreground">{transaction.failureReason}</span>}</td>
              <td className="py-3 pl-3">{canRecord && transaction.status !== 'PAID' ? <Button variant="outline" size="sm" disabled={busy} aria-label={`Catat hasil ${transaction.employeeName}`} onClick={() => setSelected(transaction.id)}>Catat hasil</Button> : <span className="text-muted-foreground">{transaction.status === 'PAID' ? 'Tersimpan' : '—'}</span>}</td>
            </tr>)}</tbody></table>
        </div>
        {current && canRecord && <PaymentForm key={current.id} transaction={current} busy={busy} onCancel={() => setSelected(null)} onSave={async data => {
          const saved = await perform(`record:${current.id}`, data, key => service.record(batch.id, current.id, data, key));
          if (saved) setSelected(null);
        }} />}
        {!closed && <div className="mt-5 flex flex-wrap gap-3">
          {allPaid && canDisburse && !checker && <Button disabled={busy} onClick={() => { setConfirmation('reconcile'); setConfirmed(false); }}>Tinjau rekonsiliasi</Button>}
          {!batch.transactions.some(transaction => transaction.status === 'PAID') && <Button variant="outline" disabled={busy} onClick={() => { setConfirmation('cancel'); setConfirmed(false); }}>Batalkan daftar</Button>}
        </div>}
        {confirmation && <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="max-w-prose text-sm">{confirmation === 'reconcile' ? 'Rekonsiliasi menyelesaikan payroll dan melunasi cicilan yang dipotong pada slip. Pastikan bukti bank sesuai seluruh catatan pembayaran.' : 'Pembatalan menutup daftar ini secara permanen. Pembayaran di bank harus dibatalkan melalui bank; aplikasi tidak mengirim perintah pembatalan.'}</p>
          <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-4 w-4" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{confirmation === 'reconcile' ? 'Saya sudah mencocokkan seluruh pembayaran dengan bukti bank.' : 'Saya memastikan belum ada pembayaran berhasil atau tertunda di bank.'}</label>
          <div className="flex flex-wrap gap-3"><Button disabled={busy || !confirmed} variant={confirmation === 'cancel' ? 'destructive' : 'default'} onClick={() => void perform(confirmation, { id: batch.id }, key => confirmation === 'reconcile' ? service.reconcile(batch.id, key) : service.cancel(batch.id, key))}>{confirmation === 'reconcile' ? 'Rekonsiliasi pembayaran' : 'Konfirmasi pembatalan'}</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirmation(null)}>Kembali</Button></div>
        </div>}
      </>}
    </>}
  </section>;
}

function PaymentForm({ transaction, busy, onCancel, onSave }: {
  transaction: PaymentTransaction; busy: boolean; onCancel: () => void; onSave: (data: RecordPayment) => Promise<void>;
}) {
  const [status, setStatus] = useState<'PAID' | 'FAILED'>('PAID');
  const [amount, setAmount] = useState(transaction.expectedAmount);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave(status === 'PAID' ? { status, amount, bankReference: reference.trim() } : { status, failureReason: reason.trim() });
  }
  const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return <form onSubmit={submit} className="mt-4 space-y-4 border-t border-border pt-4">
    <h3 ref={heading} tabIndex={-1} className="break-words font-medium">Catat hasil: {transaction.employeeName}</h3>
    <label className="block max-w-lg text-sm">Hasil pembayaran<select className={inputClass} disabled={busy} value={status} onChange={event => setStatus(event.target.value === 'PAID' ? 'PAID' : 'FAILED')}><option value="PAID">Sudah dibayar</option><option value="FAILED">Gagal dibayar</option></select></label>
    {status === 'PAID' ? <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <label className="block text-sm">Nominal pada bukti bank (IDR)<input className={inputClass} disabled={busy} inputMode="decimal" required pattern="(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?" value={amount} onChange={event => setAmount(event.target.value)} aria-describedby="payment-amount-hint" /><span id="payment-amount-hint" className="mt-1 block text-muted-foreground">Gunakan titik untuk desimal, tanpa pemisah ribuan.</span></label>
      <label className="block text-sm">Referensi transaksi bank<input className={inputClass} disabled={busy} required maxLength={100} value={reference} onChange={event => setReference(event.target.value)} autoComplete="off" /></label>
    </div> : <label className="block max-w-3xl text-sm">Alasan kegagalan<textarea className={inputClass} disabled={busy} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan hasil pembayaran'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Tutup pencatatan</Button></div>
  </form>;
}
