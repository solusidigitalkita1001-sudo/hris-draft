export type EWATransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PAID'
  | 'DEDUCTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface EWAAllowedResult {
  earnedGross: number;
  maxAllowedPercent: number;
  maxAllowedAmount: number;
  requestedAmount: number;
  isAllowed: boolean;
  reason: string | null;
  totalApprovedSamePeriod: number;
  remainingAvailableAfter: number;
}

export interface EWAStatusTransitionInput {
  fromStatus: EWATransactionStatus;
  toStatus: EWATransactionStatus;
  actor?: string | null;
}

export interface EWAStatusTransitionResult {
  allowed: boolean;
  reason: string | null;
}

const VALID_TRANSITIONS: Record<EWATransactionStatus, EWATransactionStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  PAID: ['DEDUCTED'],
  DEDUCTED: [],
  REJECTED: [],
  CANCELLED: [],
};

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function calcMaxAllowedEwa(
  earnedGrossReference: number,
  maxAllowedPercent: number = 50,
  totalApprovedInPeriod: number = 0,
): { max: number; remaining: number; totalApproved: number } {
  const earned = clamp(earnedGrossReference);
  const percent = clamp(maxAllowedPercent);
  const safePercent = percent > 100 ? 50 : percent;
  const totalApproved = clamp(totalApprovedInPeriod);
  const max = clamp((earned * safePercent) / 100);
  const remaining = clamp(max - totalApproved);
  return { max, remaining, totalApproved };
}

export function assessEwaRequest(
  earnedGrossReference: number,
  requestedAmount: number,
  totalApprovedInPeriod: number = 0,
  maxAllowedPercent: number = 50,
): EWAAllowedResult {
  const earned = clamp(earnedGrossReference);
  const requested = clamp(requestedAmount);
  const { max, remaining } = calcMaxAllowedEwa(earned, maxAllowedPercent, totalApprovedInPeriod);
  if (requested === 0) {
    return {
      earnedGross: earned,
      maxAllowedPercent: clamp(maxAllowedPercent) > 100 ? 50 : clamp(maxAllowedPercent),
      maxAllowedAmount: max,
      requestedAmount: 0,
      isAllowed: false,
      reason: 'Mohon masukkan nominal (tidak boleh 0)',
      totalApprovedSamePeriod: clamp(totalApprovedInPeriod),
      remainingAvailableAfter: remaining,
    };
  }
  if (earned === 0) {
    return {
      earnedGross: 0,
      maxAllowedPercent: clamp(maxAllowedPercent) > 100 ? 50 : clamp(maxAllowedPercent),
      maxAllowedAmount: 0,
      requestedAmount: requested,
      isAllowed: false,
      reason: 'Belum ada earned gross terhitung di periode ini. Harap hubungi payroll.',
      totalApprovedSamePeriod: clamp(totalApprovedInPeriod),
      remainingAvailableAfter: 0,
    };
  }
  if (requested > remaining) {
    const approvedExisting = clamp(totalApprovedInPeriod);
    return {
      earnedGross: earned,
      maxAllowedPercent: clamp(maxAllowedPercent) > 100 ? 50 : clamp(maxAllowedPercent),
      maxAllowedAmount: max,
      requestedAmount: requested,
      isAllowed: false,
      reason: `Meelebihi batas (sisa tersedia: Rp${remaining.toLocaleString('id-ID')} dari Rp${max.toLocaleString('id-ID')}${approvedExisting ? ', existing approved Rp' + approvedExisting.toLocaleString('id-ID') : ''})`,
      totalApprovedSamePeriod: approvedExisting,
      remainingAvailableAfter: remaining,
    };
  }
  return {
    earnedGross: earned,
    maxAllowedPercent: clamp(maxAllowedPercent) > 100 ? 50 : clamp(maxAllowedPercent),
    maxAllowedAmount: max,
    requestedAmount: requested,
    isAllowed: true,
    reason: null,
    totalApprovedSamePeriod: clamp(totalApprovedInPeriod),
    remainingAvailableAfter: clamp(remaining - requested),
  };
}

export function isStatusTransitionValid(t: EWAStatusTransitionInput): EWAStatusTransitionResult {
  const from = t.fromStatus;
  const to = t.toStatus;
  const valid = VALID_TRANSITIONS[from] ?? [];
  if (!valid.includes(to)) {
    return {
      allowed: false,
      reason: `Transisi EWA dari ${from} ke ${to} tidak diizinkan (hanya boleh: ${valid.join(', ') || 'tidak ada, status final'}).`,
    };
  }
  return { allowed: true, reason: null };
}

export interface EWAPayrollDeductionRow {
  ewaId: string;
  employeeId: string;
  amountRequested: number;
  amountPaidOut: number;
  deductedAmount: number;
  componentCode: string;
  componentName: string;
}

export function aggregateEwaForPayroll(
  ewaList: Array<{
    id: string;
    employeeId: string;
    amountRequested: number;
    amountPaidOut?: number | null;
    status: EWATransactionStatus;
  }>,
): EWAPayrollDeductionRow[] {
  const result: EWAPayrollDeductionRow[] = [];
  for (const ewa of ewaList) {
    if (ewa.status !== 'PAID') continue;
    const paid = clamp(ewa.amountPaidOut ?? ewa.amountRequested);
    if (paid <= 0) continue;
    result.push({
      ewaId: ewa.id,
      employeeId: ewa.employeeId,
      amountRequested: clamp(ewa.amountRequested),
      amountPaidOut: paid,
      deductedAmount: paid,
      componentCode: 'EWA-DEDUCT',
      componentName: 'Potongan Earned Wage Access (Tarik Gaji Awal)',
    });
  }
  return result;
}
