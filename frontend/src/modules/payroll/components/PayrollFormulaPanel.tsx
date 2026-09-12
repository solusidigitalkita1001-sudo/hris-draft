import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import type { SalaryComponent } from '@/services/payroll.service';
import { payrollFormulaService as service, type FormulaInputs, type FormulaPreview, type PayrollFormulaVersion } from '@/services/payroll-formula.service';
import { apiErrorMessage } from '@/lib/errors';

const fields: { key: keyof FormulaInputs; label: string; step: string }[] = [
  { key: 'BASE_SALARY', label: 'Gaji pokok (IDR)', step: '0.01' }, { key: 'WORK_DAYS', label: 'Hari kerja', step: '1' },
  { key: 'PRESENT_DAYS', label: 'Hari hadir', step: '1' }, { key: 'LEAVE_DAYS', label: 'Hari cuti', step: '0.5' },
  { key: 'ABSENT_DAYS', label: 'Hari tidak hadir', step: '0.5' }, { key: 'OVERTIME_HOURS', label: 'Jam lembur', step: '0.01' },
];
const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
const money = (value: string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(Number(value));
function message(error: unknown) {
  return apiErrorMessage(error, 'Formula belum berhasil diproses. Periksa koneksi lalu coba lagi.');
}

export function PayrollFormulaPanel({ component, components, onClose, onChanged }: {
  component: SalaryComponent; components: SalaryComponent[]; onClose: () => void; onChanged: () => void;
}) {
  const userId = useAuthStore(state => state.user?.id);
  const canUpdate = useAuthStore(state => state.hasPermission('payroll', 'update'));
  const canApprove = useAuthStore(state => state.hasPermission('payroll', 'approve'));
  const canSimulate = canUpdate || canApprove;
  const [versions, setVersions] = useState<PayrollFormulaVersion[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [expression, setExpression] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<FormulaPreview | null>(null);
  const [inputs, setInputs] = useState<FormulaInputs>({ BASE_SALARY: '', WORK_DAYS: '20', PRESENT_DAYS: '20', LEAVE_DAYS: '0', ABSENT_DAYS: '0', OVERTIME_HOURS: '0' });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const mounted = useRef(true), pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = versions.find(version => version.id === selectedId);
  useEffect(() => {
    heading.current?.focus();
    mounted.current = true;
    const controller = new AbortController(); setLoading(true); setLoaded(false); setError(null); setResult(null); setConfirmed(false);
    void service.list(component.id, controller.signal).then(data => {
      if (!controller.signal.aborted) { setVersions(data); setSelectedId(data[0]?.id ?? ''); setLoaded(true); }
    }).catch(cause => { if (!controller.signal.aborted) setError(message(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [component.id, reload]);

  async function act(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setNotice('');
    try { await work(); } catch (cause) { if (mounted.current) setError(message(cause)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function addVersion(version: PayrollFormulaVersion) {
    setVersions(current => [version, ...current.filter(item => item.id !== version.id)].sort((a, b) => b.version - a.version));
    setSelectedId(version.id); setConfirmed(false); onChanged();
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void act(async () => {
      const version = await service.create(component.id, { expression, effectiveFrom });
      if (!mounted.current) return;
      addVersion(version); setResult(null); setNotice('Draft tersimpan. Jalankan simulasi sebelum meminta publikasi.');
    });
  }
  function preview(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setResult(null); setConfirmed(false);
    void act(async () => {
      const data = await service.preview(component.id, selected.id, inputs, Object.fromEntries(Object.entries(amounts).filter(([, value]) => value.trim())));
      if (!mounted.current) return;
      setResult(data); setVersions(current => current.map(version => version.id === selected.id ? { ...version, previewedAt: new Date().toISOString() } : version));
      setNotice('Simulasi berhasil. Nilai ini memakai input contoh yang Anda masukkan.');
    });
  }
  const variablesChanged = () => { setResult(null); setConfirmed(false); };
  return <section className="mb-6 rounded-xl border border-border bg-background p-4 sm:p-6" aria-labelledby="formula-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 id="formula-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-semibold">Formula: {component.name}</h2><Button variant="ghost" disabled={busy} onClick={onClose}>Tutup formula</Button></div>
    <p className="mt-2 max-w-prose text-sm text-muted-foreground">Versi berlaku menurut tanggal awal periode payroll. Sebelum tanggal efektif pertama, metode {component.calculationMethod} tetap digunakan. Slip yang sudah dibuat menyimpan hasil perhitungannya sendiri.</p>
    {error && <div role="alert" className="mt-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" disabled={busy} className="mt-2" onClick={() => setReload(value => value + 1)}>Muat ulang versi</Button></div>}
    <p role="status" className="mt-3 text-sm">{loading ? 'Memuat versi formula…' : notice}</p>
    {!loading && <>
      <label className="mt-3 block max-w-xl text-sm font-medium">Versi formula<select className={inputClass} disabled={busy} value={selectedId} onChange={event => { setSelectedId(event.target.value); setResult(null); setConfirmed(false); }}>
        <option value="">Draft baru</option>{versions.map(version => <option key={version.id} value={version.id}>Versi {version.version} · {version.status === 'DRAFT' ? 'Draft' : 'Dipublikasikan'} · {version.effectiveFrom}</option>)}
      </select></label>
      {!selected ? <form onSubmit={create} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">Ekspresi formula<textarea className={`${inputClass} min-h-28 font-mono`} required maxLength={2048} disabled={busy || !canUpdate} value={expression} onChange={event => setExpression(event.target.value)} placeholder="BASE_SALARY * PRESENT_DAYS / WORK_DAYS" spellCheck={false} /></label>
        <p className="max-w-prose text-sm text-muted-foreground">Gunakan +, −, *, /, tanda kurung, min, max, atau round. Variabel: BASE_SALARY, WORK_DAYS, PRESENT_DAYS, LEAVE_DAYS, ABSENT_DAYS, OVERTIME_HOURS. Hasil dibulatkan dua desimal.</p>
        <label className="block max-w-xs text-sm font-medium">Berlaku mulai<input className={inputClass} type="date" required disabled={busy || !canUpdate} value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} /></label>
        <Button type="submit" disabled={busy || !canUpdate || !loaded}>{busy ? 'Menyimpan…' : 'Simpan draft formula'}</Button>
        {!canUpdate && <p className="text-sm text-muted-foreground">Hak akses mengubah payroll diperlukan untuk membuat draft.</p>}
      </form> : <div className="mt-4 space-y-3">
        <p className="text-sm">Versi {selected.version} · Berlaku {selected.effectiveFrom} · {selected.status === 'PUBLISHED' ? 'Dipublikasikan' : 'Draft'}</p>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">{selected.expression}</pre>
        {canUpdate && <Button variant="outline" disabled={busy} onClick={() => { setExpression(selected.expression); setEffectiveFrom(''); setSelectedId(''); setResult(null); setConfirmed(false); }}>Buat revisi dari versi ini</Button>}
      </div>}
      <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium">Referensi komponen dan nominal simulasi</summary>
        <p className="my-3 max-w-prose text-muted-foreground">Gunakan kode dengan format <code>component("KODE")</code>. Referensi harus dialokasikan kepada pegawai saat payroll dihitung. Kosongkan nilai simulasi untuk memakai nominal master; nilai ini bukan alokasi gaji pegawai.</p>
        <div className="grid gap-4 sm:grid-cols-2">{components.filter(item => item.id !== component.id && !['BPJS-TK', 'BPJS-KES', 'PPH21', 'LOAN_DEDUCTION_AUTO', 'OVERTIME_EARNING_AUTO', 'LATE_DEDUCTION_AUTO', 'ABSENCE_DEDUCTION_AUTO', 'EWA-DEDUCT'].includes(item.code)).map(item => <label key={item.id} className="block break-words">{item.name} <span className="text-muted-foreground">({item.code})</span><input className={inputClass} inputMode="decimal" disabled={busy} value={amounts[item.code] ?? ''} onChange={event => { setAmounts(current => ({ ...current, [item.code]: event.target.value })); variablesChanged(); }} placeholder={item.amount == null ? 'Masukkan nominal untuk simulasi' : String(item.amount)} /></label>)}</div>
      </details>
      {selected && <form onSubmit={preview} className="mt-6 space-y-4 border-t border-border pt-5">
        <h3 className="font-medium">Simulasi dengan input contoh</h3><p className="max-w-prose text-sm text-muted-foreground">Periksa beberapa skenario, termasuk kehadiran nol dan perubahan gaji. Simulasi tidak membuat slip atau mengubah gaji pegawai.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(field => <label key={field.key} className="block text-sm">{field.label}<input className={inputClass} type="number" required min={0} step={field.step} max={field.key === 'BASE_SALARY' ? '9999999999999.99' : '10000'} disabled={busy || !canSimulate} value={inputs[field.key]} onChange={event => { setInputs(current => ({ ...current, [field.key]: event.target.value })); variablesChanged(); }} /></label>)}</div>
        <Button type="submit" variant="outline" disabled={busy || !canSimulate}>{busy ? 'Memproses…' : 'Jalankan simulasi'}</Button>
        {result && <div role="status" className="space-y-2"><p className="text-lg font-semibold tabular-nums">Hasil simulasi: {money(result.amount)}</p><p className="text-sm text-muted-foreground">Berlaku {result.effectiveFrom}. Pembulatan setengah ke atas, dua desimal.</p></div>}
      </form>}
      {selected?.status === 'DRAFT' && <div className="mt-6 space-y-3 border-t border-border pt-5">
        {selected.createdBy === userId ? <p className="text-sm text-muted-foreground">Publikasi harus dilakukan pengguna lain yang memiliki izin persetujuan payroll.</p> : !canApprove ? <p className="text-sm text-muted-foreground">Hak akses persetujuan payroll diperlukan untuk memublikasikan versi ini.</p> : <>
          <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-4 w-4" type="checkbox" disabled={busy || !selected.previewedAt || result?.versionId !== selected.id} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Saya sudah meninjau ekspresi, hasil simulasi, dan tanggal efektif versi ini.</label>
          <Button disabled={busy || !confirmed || !selected.previewedAt || result?.versionId !== selected.id} onClick={() => void act(async () => {
            const published = await service.publish(component.id, selected.id);
            if (mounted.current) { addVersion(published); setNotice('Versi dipublikasikan. Periode yang memenuhi tanggal efektif akan memakai formula ini.'); }
          })}>{busy ? 'Memublikasikan…' : 'Publikasikan formula'}</Button>
        </>}
        {(!selected.previewedAt || !result) && <p className="text-sm text-muted-foreground">Jalankan simulasi yang berhasil sebelum publikasi.</p>}
      </div>}
    </>}
  </section>;
}
