export type AssetConditionRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'MISSING';
export type AssetConditionNumeric = 1 | 2 | 3 | 4 | 5;

const VALID_CONDITIONS = new Set<AssetConditionRating>(['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'MISSING']);
const RATING_TO_NUMERIC: Record<AssetConditionRating, AssetConditionNumeric> = {
  EXCELLENT: 5, GOOD: 4, FAIR: 3, DAMAGED: 2, MISSING: 1,
};
const NUMERIC_TO_RATING: Record<AssetConditionNumeric, AssetConditionRating> = {
  5: 'EXCELLENT', 4: 'GOOD', 3: 'FAIR', 2: 'DAMAGED', 1: 'MISSING',
};

export function isValidConditionRating(r: unknown): r is AssetConditionRating {
  return typeof r === 'string' && VALID_CONDITIONS.has(r as AssetConditionRating);
}

export function conditionToNumeric(r: unknown): AssetConditionNumeric {
  if (isValidConditionRating(r)) return RATING_TO_NUMERIC[r];
  return 1;
}

export function numericToCondition(n: unknown): AssetConditionRating {
  const v = Number(n);
  if (Number.isInteger(v) && v >= 1 && v <= 5) {
    return NUMERIC_TO_RATING[v as AssetConditionNumeric];
  }
  return 'FAIR';
}

export interface BarcodeValidateResult {
  valid: boolean;
  reason: string | null;
  prefix: string;
  code: string | null;
}

export function validateBarcodeFormat(raw: unknown, opts?: { prefix?: string; minDigits?: number; maxDigits?: number }): BarcodeValidateResult {
  const prefix = opts?.prefix ?? 'AST-';
  const minD = Number.isFinite(Number(opts?.minDigits)) && (opts!.minDigits as number) > 0 ? (opts!.minDigits as number) : 3;
  const maxD = Number.isFinite(Number(opts?.maxDigits)) && (opts!.maxDigits as number) >= minD ? (opts!.maxDigits as number) : 32;
  if (typeof raw !== 'string' || raw.length === 0) return { valid: false, reason: 'Barcode harus string non-kosong', prefix, code: null };
  if (!raw.startsWith(prefix)) return { valid: false, reason: `Barcode harus diawali prefix '${prefix}'`, prefix, code: null };
  const after = raw.slice(prefix.length);
  if (!/^\d+$/.test(after)) return { valid: false, reason: `Setelah prefix '${prefix}' harus numeric tanpa karakter lain`, prefix, code: null };
  if (after.length < minD) return { valid: false, reason: `Panjang kode numeric minimal ${minD} digit`, prefix, code: null };
  if (after.length > maxD) return { valid: false, reason: `Panjang kode numeric maksimal ${maxD} digit`, prefix, code: null };
  return { valid: true, reason: null, prefix, code: after };
}

export function normalizeBarcode(raw: unknown, fallbackPrefix = 'AST-'): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const trimmed = raw.trim();
  const r = validateBarcodeFormat(trimmed, { prefix: fallbackPrefix });
  if (r.valid) return trimmed;
  if (/^\d+$/.test(trimmed) && trimmed.length >= 3) return `${fallbackPrefix}${trimmed}`;
  return null;
}

export interface PatrolComplianceResult {
  totalRequired: number;
  totalCompleted: number;
  totalMissed: number;
  compliancePercent: number;
  missedAssetIds: string[];
  completedAssetIds: string[];
  completionRate: number;
}

export function patrolComplianceRate(
  requiredAssetCodes: string[] | null | undefined,
  completedAssetCodes: string[] | null | undefined,
  opts?: { requireExactMatchCaseSensitive?: boolean },
): PatrolComplianceResult {
  const req = Array.isArray(requiredAssetCodes) ? requiredAssetCodes.filter(v => typeof v === 'string' && v.length > 0) : [];
  const done = Array.isArray(completedAssetCodes) ? completedAssetCodes.filter(v => typeof v === 'string' && v.length > 0) : [];
  const totalRequired = req.length;
  if (totalRequired === 0) {
    return {
      totalRequired: 0, totalCompleted: done.length, totalMissed: 0,
      compliancePercent: done.length > 0 ? 100 : 0,
      missedAssetIds: [], completedAssetIds: done, completionRate: done.length > 0 ? 1 : 0,
    };
  }
  const caseSensitive = opts?.requireExactMatchCaseSensitive !== false;
  const doneSet = new Set(caseSensitive ? done : done.map(d => d.toLowerCase()));
  const completed: string[] = [];
  const missed: string[] = [];
  for (const r of req) {
    const key = caseSensitive ? r : r.toLowerCase();
    if (doneSet.has(key)) completed.push(r);
    else missed.push(r);
  }
  const totalCompleted = completed.length;
  const totalMissed = totalRequired - totalCompleted;
  const raw = (totalCompleted / totalRequired) * 100;
  const compliancePercent = Math.round(raw * 100) / 100;
  const completionRate = Math.round((totalCompleted / totalRequired) * 10000) / 10000;
  return { totalRequired, totalCompleted, totalMissed, compliancePercent, missedAssetIds: missed, completedAssetIds: completed, completionRate };
}
