import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import type { SalaryComponent } from '@/services/payroll.service';
import { payrollFormulaService as service, type FormulaInputs, type FormulaPreview, type PayrollFormulaVersion } from '@/services/payroll-formula.service';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey, TranslationParams } from '@/i18n/translations';

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const fields: { key: keyof FormulaInputs; labelKey: TranslationKey; step: string }[] = [
  { key: 'BASE_SALARY', labelKey: 'fin.formula.baseSalary', step: '0.01' }, { key: 'WORK_DAYS', labelKey: 'fin.formula.workDays', step: '1' },
  { key: 'PRESENT_DAYS', labelKey: 'fin.formula.presentDays', step: '1' }, { key: 'LEAVE_DAYS', labelKey: 'fin.formula.leaveDays', step: '0.5' },
  { key: 'ABSENT_DAYS', labelKey: 'fin.formula.absentDays', step: '0.5' }, { key: 'OVERTIME_HOURS', labelKey: 'fin.formula.overtimeHours', step: '0.01' },
];
const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
const money = (value: string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(Number(value));
function message(error: unknown, t: Translate) {
  return apiErrorMessage(error, t('fin.formula.genericError'));
}

export function PayrollFormulaPanel({ component, components, onClose, onChanged }: {
  component: SalaryComponent; components: SalaryComponent[]; onClose: () => void; onChanged: () => void;
}) {
  const { t } = useI18n();
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
    }).catch(cause => { if (!controller.signal.aborted) setError(message(cause, t)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [component.id, reload, t]);

  async function act(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setNotice('');
    try { await work(); } catch (cause) { if (mounted.current) setError(message(cause, t)); }
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
      addVersion(version); setResult(null); setNotice(t('fin.formula.draftSaved'));
    });
  }
  function preview(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setResult(null); setConfirmed(false);
    void act(async () => {
      const data = await service.preview(component.id, selected.id, inputs, Object.fromEntries(Object.entries(amounts).filter(([, value]) => value.trim())));
      if (!mounted.current) return;
      setResult(data); setVersions(current => current.map(version => version.id === selected.id ? { ...version, previewedAt: new Date().toISOString() } : version));
      setNotice(t('fin.formula.simulationOk'));
    });
  }
  const variablesChanged = () => { setResult(null); setConfirmed(false); };
  return <section className="mb-6 rounded-xl border border-border bg-background p-4 sm:p-6" aria-labelledby="formula-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 id="formula-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-semibold">{t('fin.formula.heading', { name: component.name })}</h2><Button variant="ghost" disabled={busy} onClick={onClose}>{t('fin.formula.close')}</Button></div>
    <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t('fin.formula.intro', { method: component.calculationMethod })}</p>
    {error && <div role="alert" className="mt-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" disabled={busy} className="mt-2" onClick={() => setReload(value => value + 1)}>{t('fin.formula.reloadVersions')}</Button></div>}
    <p role="status" className="mt-3 text-sm">{loading ? t('fin.formula.loadingVersions') : notice}</p>
    {!loading && <>
      <label className="mt-3 block max-w-xl text-sm font-medium">{t('fin.formula.versionLabel')}<select className={inputClass} disabled={busy} value={selectedId} onChange={event => { setSelectedId(event.target.value); setResult(null); setConfirmed(false); }}>
        <option value="">{t('fin.formula.newDraft')}</option>{versions.map(version => <option key={version.id} value={version.id}>{t('fin.formula.versionOption', { version: version.version, status: version.status === 'DRAFT' ? t('fin.formula.statusDraft') : t('fin.formula.statusPublished'), date: version.effectiveFrom })}</option>)}
      </select></label>
      {!selected ? <form onSubmit={create} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">{t('fin.formula.expression')}<textarea className={`${inputClass} min-h-28 font-mono`} required maxLength={2048} disabled={busy || !canUpdate} value={expression} onChange={event => setExpression(event.target.value)} placeholder="BASE_SALARY * PRESENT_DAYS / WORK_DAYS" spellCheck={false} /></label>
        <p className="max-w-prose text-sm text-muted-foreground">{t('fin.formula.expressionHelp')}</p>
        <label className="block max-w-xs text-sm font-medium">{t('fin.formula.effectiveFrom')}<input className={inputClass} type="date" required disabled={busy || !canUpdate} value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} /></label>
        <Button type="submit" disabled={busy || !canUpdate || !loaded}>{busy ? t('fin.common.savingEllipsis') : t('fin.formula.saveDraft')}</Button>
        {!canUpdate && <p className="text-sm text-muted-foreground">{t('fin.formula.needUpdatePerm')}</p>}
      </form> : <div className="mt-4 space-y-3">
        <p className="text-sm">{t('fin.formula.selectedSummary', { version: selected.version, date: selected.effectiveFrom, status: selected.status === 'PUBLISHED' ? t('fin.formula.statusPublished') : t('fin.formula.statusDraft') })}</p>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">{selected.expression}</pre>
        {canUpdate && <Button variant="outline" disabled={busy} onClick={() => { setExpression(selected.expression); setEffectiveFrom(''); setSelectedId(''); setResult(null); setConfirmed(false); }}>{t('fin.formula.reviseFromVersion')}</Button>}
      </div>}
      <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium">{t('fin.formula.componentRefs')}</summary>
        <p className="my-3 max-w-prose text-muted-foreground">{t('fin.formula.refsHelpPrefix')}<code>component("KODE")</code>{t('fin.formula.refsHelpSuffix')}</p>
        <div className="grid gap-4 sm:grid-cols-2">{components.filter(item => item.id !== component.id && !['BPJS-TK', 'BPJS-KES', 'PPH21', 'LOAN_DEDUCTION_AUTO', 'OVERTIME_EARNING_AUTO', 'LATE_DEDUCTION_AUTO', 'ABSENCE_DEDUCTION_AUTO', 'EWA-DEDUCT'].includes(item.code)).map(item => <label key={item.id} className="block break-words">{item.name} <span className="text-muted-foreground">({item.code})</span><input className={inputClass} inputMode="decimal" disabled={busy} value={amounts[item.code] ?? ''} onChange={event => { setAmounts(current => ({ ...current, [item.code]: event.target.value })); variablesChanged(); }} placeholder={item.amount == null ? t('fin.formula.enterSimAmount') : String(item.amount)} /></label>)}</div>
      </details>
      {selected && <form onSubmit={preview} className="mt-6 space-y-4 border-t border-border pt-5">
        <h3 className="font-medium">{t('fin.formula.simulateHeading')}</h3><p className="max-w-prose text-sm text-muted-foreground">{t('fin.formula.simulateHelp')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(field => <label key={field.key} className="block text-sm">{t(field.labelKey)}<input className={inputClass} type="number" required min={0} step={field.step} max={field.key === 'BASE_SALARY' ? '9999999999999.99' : '10000'} disabled={busy || !canSimulate} value={inputs[field.key]} onChange={event => { setInputs(current => ({ ...current, [field.key]: event.target.value })); variablesChanged(); }} /></label>)}</div>
        <Button type="submit" variant="outline" disabled={busy || !canSimulate}>{busy ? t('fin.common.processingEllipsis') : t('fin.formula.runSimulation')}</Button>
        {result && <div role="status" className="space-y-2"><p className="text-lg font-semibold tabular-nums">{t('fin.formula.simResult', { amount: money(result.amount) })}</p><p className="text-sm text-muted-foreground">{t('fin.formula.simResultNote', { date: result.effectiveFrom })}</p></div>}
      </form>}
      {selected?.status === 'DRAFT' && <div className="mt-6 space-y-3 border-t border-border pt-5">
        {selected.createdBy === userId ? <p className="text-sm text-muted-foreground">{t('fin.formula.publishOtherUser')}</p> : !canApprove ? <p className="text-sm text-muted-foreground">{t('fin.formula.needApprovePerm')}</p> : <>
          <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-4 w-4" type="checkbox" disabled={busy || !selected.previewedAt || result?.versionId !== selected.id} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t('fin.formula.reviewConfirm')}</label>
          <Button disabled={busy || !confirmed || !selected.previewedAt || result?.versionId !== selected.id} onClick={() => void act(async () => {
            const published = await service.publish(component.id, selected.id);
            if (mounted.current) { addVersion(published); setNotice(t('fin.formula.publishedNotice')); }
          })}>{busy ? t('fin.formula.publishing') : t('fin.formula.publish')}</Button>
        </>}
        {(!selected.previewedAt || !result) && <p className="text-sm text-muted-foreground">{t('fin.formula.simulateBeforePublish')}</p>}
      </div>}
    </>}
  </section>;
}
