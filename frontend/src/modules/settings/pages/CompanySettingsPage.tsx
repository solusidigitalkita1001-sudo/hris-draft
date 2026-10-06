import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { companySettingsService as service, type SettingDescriptor } from '@/services/company-settings.service';

/**
 * Every policy this product calls "configurable per company" was reachable only
 * by raw API before this page existed: gross-up, unpaid-leave deduction, the
 * December tax true-up, carry-over limits. A setting nobody can find is a
 * setting nobody can use.
 *
 * The control for each key comes from the server's catalog, not a copy kept
 * here, so a setting added server-side appears without a frontend release and
 * can never be rendered as the wrong kind of input.
 */
const GROUPS: Array<{ id: string; label: TranslationKey; matches: (key: string) => boolean }> = [
  { id: 'attendance', label: 'adm.set.group.attendance', matches: key => key.startsWith('attendance_') || key.startsWith('late_') || key.startsWith('absence_') },
  { id: 'leave', label: 'adm.set.group.leave', matches: key => key.startsWith('leave_') || key.startsWith('unpaid_leave_') },
  { id: 'payroll', label: 'adm.set.group.payroll', matches: key => key.startsWith('pph21_') || key.startsWith('benefit_') || key.startsWith('payslip_') },
  { id: 'recruitment', label: 'adm.set.group.recruitment', matches: key => key.startsWith('recruitment_') },
];

export function CompanySettingsPage() {
  const { t } = useI18n();
  const canView = useAuthStore(state => state.hasPermission('settings', 'read'));
  const canSave = useAuthStore(state => state.hasPermission('settings', 'update'));
  const companyId = useCompanyStore(state => state.activeCompanyId);
  const [catalog, setCatalog] = useState<SettingDescriptor[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(null); setNotice('');
    void Promise.all([service.catalog(controller.signal), service.all(controller.signal)])
      .then(([descriptors, values]) => {
        if (controller.signal.aborted) return;
        setCatalog(descriptors);
        setSaved(values);
        setDraft(values);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(apiErrorMessage(cause, t('adm.set.title'))); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // companyId is a dependency on purpose: settings belong to the selected
    // company, so switching company must not leave another tenant's values on
    // screen.
  }, [canView, companyId, reload, t]);

  const changed = useMemo(
    () => Object.keys(draft).filter(key => draft[key] !== saved[key]),
    [draft, saved],
  );

  const label = useCallback((prefix: 'key' | 'help', key: string) => {
    // t() returns the key itself when a translation is missing, which is the
    // fallback that matters here: a setting the server adds before its copy is
    // written must still be visible and editable, never silently dropped.
    const translationKey = `adm.set.${prefix}.${key}` as TranslationKey;
    const text = t(translationKey);
    return text === translationKey ? (prefix === 'key' ? key : '') : text;
  }, [t]);

  async function save() {
    if (!changed.length || busy) return;
    setBusy(true); setError(null); setNotice('');
    const payload = Object.fromEntries(changed.map(key => [key, draft[key] as string]));
    try {
      await service.save(payload);
      setSaved(current => ({ ...current, ...payload }));
      setNotice(t('adm.set.saved', { count: changed.length }));
    } catch (cause) {
      // The server validates every value it governs; show its reason rather
      // than a generic failure, because the reason names the offending key.
      setError(apiErrorMessage(cause, t('adm.set.title')));
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const buckets = GROUPS.map(group => ({ ...group, entries: catalog.filter(entry => group.matches(entry.key)) }));
    // Anything no group claims still renders, so a new key cannot disappear.
    const claimed = new Set(buckets.flatMap(bucket => bucket.entries.map(entry => entry.key)));
    const rest = catalog.filter(entry => !claimed.has(entry.key));
    return rest.length
      ? [...buckets, { id: 'other', label: 'adm.set.group.other' as TranslationKey, matches: () => false, entries: rest }]
      : buckets;
  }, [catalog]);

  if (!canView) {
    return <main className="p-6"><p className="text-sm">{t('adm.set.needReadPerm')}</p></main>;
  }

  return <main className="p-4 sm:p-6">
    <h1 className="text-xl font-semibold">{t('adm.set.title')}</h1>
    <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t('adm.set.description')}</p>
    {!canSave && <p className="mt-3 max-w-prose text-sm text-muted-foreground">{t('adm.set.readOnly')}</p>}

    {error && <div role="alert" className="mt-4 text-sm text-destructive"><p>{error}</p>
      <Button variant="outline" className="mt-2" disabled={busy} onClick={() => setReload(value => value + 1)}>{t('adm.set.reload')}</Button>
    </div>}
    <p role="status" className="mt-3 text-sm">{loading ? t('adm.set.loading') : notice}</p>

    {!loading && grouped.filter(group => group.entries.length > 0).map(group => (
      <section key={group.id} aria-labelledby={`settings-${group.id}`} className="mt-6 rounded-xl border border-border p-4">
        <h2 id={`settings-${group.id}`} className="text-base font-semibold">{t(group.label)}</h2>
        <dl className="mt-3 space-y-5">
          {group.entries.map(entry => {
            const value = draft[entry.key] ?? entry.defaultValue;
            const help = label('help', entry.key);
            const controlId = `setting-${entry.key}`;
            const describedBy = help ? `${controlId}-help` : undefined;
            return <div key={entry.key} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-start">
              <div>
                <dt><label className="text-sm font-medium" htmlFor={controlId}>{label('key', entry.key)}</label></dt>
                {help && <dd id={describedBy} className="mt-1 max-w-prose text-sm text-muted-foreground">{help}</dd>}
                <dd className="mt-1 text-xs text-muted-foreground">
                  {t('adm.set.defaultHint', { value: entry.defaultValue })}
                  {entry.type === 'number' && entry.min !== undefined && entry.max !== undefined
                    && ` · ${t('adm.set.rangeHint', { min: entry.min, max: entry.max })}${entry.integer ? ` · ${t('adm.set.wholeNumber')}` : ''}`}
                </dd>
              </div>
              <dd>
                {entry.type === 'enum' && entry.options?.length
                  ? <select id={controlId} disabled={!canSave || busy}
                      aria-describedby={describedBy}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={value}
                      onChange={event => setDraft(current => ({ ...current, [entry.key]: event.target.value }))}>
                      {entry.options.map(option => {
                        // A value the server offers but no copy names must
                        // still be selectable, so the raw value is the label.
                        const optionKey = `adm.set.option.${entry.key}.${option}` as TranslationKey;
                        const optionLabel = t(optionKey);
                        return <option key={option} value={option}>
                          {optionLabel === optionKey ? option : optionLabel}
                        </option>;
                      })}
                    </select>
                  : entry.type === 'boolean'
                  ? <label className="flex items-center gap-2 text-sm">
                      <input id={controlId} type="checkbox" className="h-4 w-4" disabled={!canSave || busy}
                        aria-describedby={describedBy}
                        checked={value === 'true'}
                        onChange={event => setDraft(current => ({ ...current, [entry.key]: event.target.checked ? 'true' : 'false' }))} />
                      {value === 'true' ? t('adm.set.on') : t('adm.set.off')}
                    </label>
                  : <Input id={controlId} disabled={!canSave || busy}
                      aria-describedby={describedBy}
                      type={entry.type === 'number' ? 'number' : 'text'}
                      inputMode={entry.type === 'number' ? 'numeric' : undefined}
                      min={entry.min} max={entry.max} step={entry.integer ? 1 : 'any'}
                      value={value}
                      onChange={event => setDraft(current => ({ ...current, [entry.key]: event.target.value }))} />}
              </dd>
            </div>;
          })}
        </dl>
      </section>
    ))}

    {!loading && canSave && <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button disabled={busy || !changed.length} onClick={() => void save()}>
        {busy ? t('adm.set.saving') : t('adm.set.save')}
      </Button>
      <Button variant="ghost" disabled={busy || !changed.length} onClick={() => setDraft(saved)}>{t('adm.set.reset')}</Button>
      <p className="text-sm text-muted-foreground">
        {changed.length ? t('adm.set.changedCount', { count: changed.length }) : t('adm.set.noChanges')}
      </p>
    </div>}
  </main>;
}

export default CompanySettingsPage;
