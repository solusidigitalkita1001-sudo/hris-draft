export type ClaimPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONCE';
export type LimitViolationAction = 'WARN' | 'BLOCK';
export type ExpenseCategory = 'TRANSPORTATION' | 'HOTEL' | 'MEAL' | 'ENTERTAINMENT' | 'OPERATIONAL';

export interface ClaimCategoryLimitDTO {
  companyId?: string | null;
  category: ExpenseCategory;
  periodType: ClaimPeriodType;
  /// limit <= 0 / null = unlimited
  limitAmount: number;
  violationAction: LimitViolationAction;
  isActive?: boolean;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
}

export interface ClaimSubmittedAmount {
  category: ExpenseCategory;
  amount: number;
  expenseDate?: Date | string | null;
}

export interface ClaimLimitCheckResult {
  exceeded: boolean;
  isBlock: boolean;
  isWarn: boolean;
  limitAmount: number;
  submittedTotalBeforeNew: number;
  newAmount: number;
  projectedTotal: number;
  delta: number;
  unlimited: boolean;
  category: ExpenseCategory;
  periodType: ClaimPeriodType;
  warningMessage: string | null;
  blockMessage: string | null;
}

function normalizeCategory(c: unknown): ExpenseCategory {
  return (typeof c === 'string' ? String(c).toUpperCase() : 'OPERATIONAL') as ExpenseCategory;
}

function normalizeDate(d: unknown): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === 'string' || typeof d === 'number') {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }
  return null;
}

export function periodIsActive(limit: ClaimCategoryLimitDTO): boolean {
  if (limit.isActive === false) return false;
  const now = new Date();
  if (limit.validFrom && normalizeDate(limit.validFrom) && (now < (normalizeDate(limit.validFrom) as Date))) return false;
  if (limit.validUntil && normalizeDate(limit.validUntil) && (now > (normalizeDate(limit.validUntil) as Date))) return false;
  return true;
}

export function samePeriodBucket(expenseDate: Date | null, referenceDate: Date | null, periodType: ClaimPeriodType): boolean {
  const a = expenseDate ? new Date(expenseDate) : new Date();
  const b = referenceDate ? new Date(referenceDate) : new Date();
  if (periodType === 'ONCE') return true;
  if (periodType === 'DAILY') {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  if (periodType === 'WEEKLY') {
    const aw = getWeekStart(a);
    const bw = getWeekStart(b);
    return aw.getTime() === bw.getTime();
  }
  if (periodType === 'MONTHLY') return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (periodType === 'QUARTERLY') return a.getFullYear() === b.getFullYear() && Math.floor(a.getMonth() / 3) === Math.floor(b.getMonth() / 3);
  return a.getFullYear() === b.getFullYear();
}

function getWeekStart(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - day);
  return out;
}

export function sumSubmittedInPeriod(
  submitted: ClaimSubmittedAmount[],
  category: ExpenseCategory,
  periodType: ClaimPeriodType,
  referenceDate: Date | null = new Date(),
): number {
  const cat = normalizeCategory(category);
  let sum = 0;
  for (const row of submitted) {
    if (normalizeCategory(row.category) !== cat) continue;
    if (!samePeriodBucket(normalizeDate(row.expenseDate), referenceDate, periodType)) continue;
    const amt = Number(row.amount);
    if (!Number.isFinite(amt) || amt < 0) continue;
    sum += amt;
  }
  return sum;
}

export function checkCategoryLimit(
  submittedHistory: ClaimSubmittedAmount[],
  newClaim: ClaimSubmittedAmount,
  limit: ClaimCategoryLimitDTO | null | undefined,
  referenceDate: Date | null = new Date(),
): ClaimLimitCheckResult {
  const category = normalizeCategory(newClaim.category);
  const periodType: ClaimPeriodType = (limit?.periodType ?? 'MONTHLY') as ClaimPeriodType;
  const limitAmount = Number(limit?.limitAmount);
  const unlimited = !limit || !periodIsActive(limit) || !Number.isFinite(limitAmount) || limitAmount <= 0;
  const violationAction: LimitViolationAction = (limit?.violationAction ?? 'WARN') as LimitViolationAction;
  const submittedTotalBeforeNew = sumSubmittedInPeriod(submittedHistory, category, periodType, referenceDate);
  const newAmount = Math.max(0, Number.isFinite(Number(newClaim.amount)) ? Number(newClaim.amount) : 0);
  const projectedTotal = submittedTotalBeforeNew + newAmount;

  if (unlimited) {
    return {
      exceeded: false,
      isBlock: false,
      isWarn: false,
      limitAmount: 0,
      submittedTotalBeforeNew,
      newAmount,
      projectedTotal,
      delta: 0,
      unlimited: true,
      category,
      periodType,
      warningMessage: null,
      blockMessage: null,
    };
  }

  const exceeded = projectedTotal > limitAmount;
  const delta = projectedTotal - limitAmount;
  const isBlock = exceeded && violationAction === 'BLOCK';
  const isWarn = exceeded && violationAction === 'WARN';

  return {
    exceeded,
    isBlock,
    isWarn,
    limitAmount,
    submittedTotalBeforeNew,
    newAmount,
    projectedTotal,
    delta: Math.max(0, delta),
    unlimited: false,
    category,
    periodType,
    warningMessage: isWarn
      ? `Kategori ${category} periode ${periodType}: pengajuan ${formatRupiah(projectedTotal)} melebihi batas ${formatRupiah(limitAmount)} sebesar ${formatRupiah(delta)} (policy WARN = disimpan dengan flag requiresReview)`
      : null,
    blockMessage: isBlock
      ? `Kategori ${category} periode ${periodType}: melebihi batas ${formatRupiah(limitAmount)} (saat ini ${formatRupiah(projectedTotal)}). Batalkan sebagian atau hubungi admin untuk override.`
      : null,
  };
}

function formatRupiah(n: number): string {
  const rounded = Math.round(n);
  return 'Rp' + rounded.toLocaleString('id-ID');
}
