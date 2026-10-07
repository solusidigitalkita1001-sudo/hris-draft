import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUp, CornerDownRight, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppModal } from '@/components/shared/AppModal';
import { StatusChip, type ChipTone } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/button';
import { Select2, type Select2Option } from '@/components/ui/select2';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { apiErrorMessage } from '@/lib/errors';
import {
  performanceService,
  type Goal,
  type GoalChain,
  type GoalChainNode,
  type GoalChildren,
} from '@/services/performance.service';

/**
 * Keselarasan goal (GAP-26) — sisi antarmuka dari hierarki goal yang sudah ada
 * di backend (`/performance/goals/:id/chain`, `/children`, `/parent`).
 *
 * Hierarkinya adalah rujukan bebas, bukan cascade formal: sebuah goal menunjuk
 * goal lain sebagai induk tanpa harus menggantung pada satu tingkat organisasi.
 * Karena itu panel ini menampilkan rantai ke atas dan daftar turunan apa adanya
 * dan tidak pernah menulis ulang progress induk dari progress anaknya.
 *
 * Siklus ditolak di server. Penolakan itu ditampilkan utuh — pesan servernya
 * yang menjelaskan sebabnya (siklus, lintas perusahaan, atau kedalaman > 5),
 * sehingga tidak ada upaya menebak-nebak aturan yang sama di sisi klien.
 */

const GOAL_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  IN_PROGRESS: 'perf.status.inProgress',
  COMPLETED: 'perf.status.completed',
  CANCELLED: 'perf.status.cancelled',
};

const GOAL_STATUS_TONES: Record<string, ChipTone> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

function progressBarTone(progress: number): string {
  if (progress >= 100) return 'bg-success';
  if (progress >= 50) return 'bg-primary';
  return 'bg-warning';
}

function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${progressBarTone(clamped)}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Satu baris goal di dalam rantai/daftar turunan. */
function GoalRow({
  title,
  subtitle,
  progress,
  status,
  badge,
  highlighted = false,
  indent = 0,
}: {
  title: string;
  subtitle?: string;
  progress: number;
  status?: string;
  badge?: string;
  highlighted?: boolean;
  indent?: number;
}) {
  const { t } = useI18n();
  const statusKey = status ? GOAL_STATUS_LABEL_KEYS[status] : undefined;

  return (
    <div style={{ marginLeft: indent * 18 }}>
      <div
        className={`rounded-card-sm border p-3 ${
          highlighted ? 'border-primary/50 bg-accent' : 'border-border bg-card'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-foreground">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-none items-center gap-1.5">
            {badge && <StatusChip tone="accent">{badge}</StatusChip>}
            {status && (
              <StatusChip tone={GOAL_STATUS_TONES[status] ?? 'neutral'}>
                {statusKey ? t(statusKey) : status}
              </StatusChip>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar progress={progress} />
          <span className="flex-none text-[11px] font-medium text-muted-foreground">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.9px] text-muted-foreground">
      {icon}
      {children}
    </p>
  );
}

export function GoalAlignmentModal({
  open,
  goal,
  goals,
  onClose,
  onChanged,
}: {
  open: boolean;
  /** Goal yang keselarasannya dibuka; null saat panel tertutup. */
  goal: Goal | null;
  /** Kandidat induk: seluruh goal perusahaan aktif yang sudah dimuat halaman. */
  goals: Goal[];
  onClose: () => void;
  /** Dipanggil setelah induk berubah agar daftar pemanggil ikut segar. */
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const goalId = goal?.id ?? '';

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chain, setChain] = useState<GoalChain | null>(null);
  const [children, setChildren] = useState<GoalChildren | null>(null);
  const [parentValue, setParentValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!goalId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [nextChain, nextChildren] = await Promise.all([
        performanceService.getGoalChain(goalId),
        performanceService.getGoalChildren(goalId),
      ]);
      setChain(nextChain);
      setChildren(nextChildren);
      setParentValue(nextChain.goal.parentGoalId ?? '');
    } catch (error) {
      setLoadError(apiErrorMessage(error, t('perf.goalAlign.loadFailed')));
      setChain(null);
      setChildren(null);
    } finally {
      setLoading(false);
    }
  }, [goalId, t]);

  useEffect(() => {
    if (!open || !goalId) return;
    setSaveError(null);
    load();
  }, [open, goalId, load]);

  /** Dirinya sendiri tidak pernah jadi pilihan; sisanya diserahkan ke server. */
  const parentOptions = useMemo<Select2Option[]>(() => {
    const candidates = goals
      .filter((candidate) => candidate.id !== goalId)
      .map((candidate) => ({
        value: candidate.id,
        label: candidate.employee?.fullName
          ? `${candidate.title} · ${candidate.employee.fullName}`
          : candidate.title,
      }));
    return [{ value: '', label: t('perf.goalAlign.parent.none') }, ...candidates];
  }, [goals, goalId, t]);

  const currentParentId = chain?.goal.parentGoalId ?? '';
  const dirty = parentValue !== currentParentId;

  const handleSave = async () => {
    if (!goalId || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      await performanceService.setGoalParent(goalId, parentValue || null);
      toast.success(parentValue ? t('perf.goalAlign.parent.saved') : t('perf.goalAlign.parent.detached'));
      await load();
      onChanged();
    } catch (error) {
      // Penolakan server (siklus, induk lintas perusahaan, kedalaman maksimum)
      // ditampilkan apa adanya dan tetap menempel di panel, bukan hanya toast
      // yang hilang sebelum terbaca.
      const message = apiErrorMessage(error, t('perf.goalAlign.parent.saveFailed'));
      setSaveError(message);
      toast.error(message);
      setParentValue(currentParentId);
    } finally {
      setSaving(false);
    }
  };

  // Leluhur datang dari yang terdekat; dibalik agar goal paling atas di atas,
  // sehingga pembaca melihat rollup dari goal perusahaan turun ke goal ini.
  const ancestorsTopDown = useMemo<GoalChainNode[]>(
    () => (chain ? [...chain.ancestors].reverse() : []),
    [chain],
  );

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={t('perf.goalAlign.title')}
      description={goal ? goal.title : t('perf.goalAlign.description')}
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <p className="py-10 text-center text-[12px] text-muted-foreground">{t('perf.goalAlign.loading')}</p>
      ) : loadError ? (
        <div className="rounded-card-sm bg-danger-bg p-4">
          <p className="flex items-start gap-2 text-[12px] text-danger">
            <AlertCircle size={14} className="mt-0.5 flex-none" />
            {loadError}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            {t('perf.goalAlign.retry')}
          </Button>
        </div>
      ) : chain ? (
        <div className="space-y-6">
          {/* Rantai ke atas */}
          <section>
            <SectionTitle icon={<ArrowUp size={12} />}>{t('perf.goalAlign.chain.heading')}</SectionTitle>
            {ancestorsTopDown.length === 0 ? (
              <p className="rounded-card-sm border border-dashed border-border p-4 text-[11.5px] text-muted-foreground">
                {t('perf.goalAlign.chain.empty')}
              </p>
            ) : (
              <div className="space-y-2">
                {ancestorsTopDown.map((ancestor, index) => (
                  <GoalRow
                    key={ancestor.id}
                    title={ancestor.title}
                    progress={ancestor.progress}
                    status={ancestor.status}
                    badge={index === 0 ? t('perf.goalAlign.chain.top') : undefined}
                    indent={index}
                  />
                ))}
              </div>
            )}
            <div className="mt-2">
              <GoalRow
                title={chain.goal.title}
                subtitle={goal?.employee?.fullName}
                progress={chain.goal.progress}
                status={chain.goal.status}
                badge={t('perf.goalAlign.chain.current')}
                highlighted
                indent={ancestorsTopDown.length}
              />
            </div>
          </section>

          {/* Turunan */}
          <section>
            <SectionTitle icon={<CornerDownRight size={12} />}>
              {t('perf.goalAlign.children.heading')}
            </SectionTitle>
            {!children || children.children.length === 0 ? (
              <div className="rounded-card-sm border border-dashed border-border p-4 text-center">
                <Target size={22} className="mx-auto text-muted-foreground/40" />
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  {t('perf.goalAlign.children.empty')}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusChip tone="neutral">
                    {t('perf.goalAlign.children.count', { count: children.children.length })}
                  </StatusChip>
                  <StatusChip tone="accent">
                    {t('perf.goalAlign.children.ownProgress', { value: children.ownProgress })}
                  </StatusChip>
                  {children.averageChildProgress !== null && (
                    <StatusChip tone="neutral">
                      {t('perf.goalAlign.children.average', { value: children.averageChildProgress })}
                    </StatusChip>
                  )}
                </div>
                <div className="space-y-2">
                  {children.children.map((child) => (
                    <GoalRow
                      key={child.id}
                      title={child.title}
                      subtitle={
                        child.employee
                          ? `${child.employee.fullName} · ${child.employee.employeeNumber}`
                          : undefined
                      }
                      progress={child.progress}
                      status={child.status}
                      indent={1}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t('perf.goalAlign.children.averageNote')}
                </p>
              </>
            )}
          </section>

          {/* Ubah induk */}
          <section className="rounded-card-sm border border-border bg-card p-4">
            <SectionTitle icon={<ArrowUp size={12} />}>{t('perf.goalAlign.parent.heading')}</SectionTitle>
            {parentOptions.length <= 1 ? (
              <p className="text-[11.5px] text-muted-foreground">{t('perf.goalAlign.parent.noCandidates')}</p>
            ) : (
              <>
                <label className="mb-1.5 block text-[11px] font-medium text-foreground">
                  {t('perf.goalAlign.parent.label')}
                </label>
                <Select2
                  value={parentValue}
                  onValueChange={(next) => {
                    setParentValue(next);
                    setSaveError(null);
                  }}
                  options={parentOptions}
                  placeholder={t('perf.goalAlign.parent.placeholder')}
                  disabled={saving}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">{t('perf.goalAlign.parent.hint')}</p>
                {saveError && (
                  <p className="mt-2 flex items-start gap-2 rounded-field bg-danger-bg p-2.5 text-[11.5px] text-danger">
                    <AlertCircle size={13} className="mt-0.5 flex-none" />
                    {saveError}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
                    {saving ? t('perf.goalAlign.parent.saving') : t('perf.goalAlign.parent.save')}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </AppModal>
  );
}
