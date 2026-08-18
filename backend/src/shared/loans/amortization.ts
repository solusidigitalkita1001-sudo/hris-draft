export type AmortizationMethod = 'FLAT' | 'EFEKTIF' | 'ANUITAS';

export interface AmortizationInput {
  principalAmount: number;
  totalInstallments: number;
  interestRatePercentPerYear: number;
  method?: AmortizationMethod;
  disbursementDate?: Date | string | null;
  firstDueDate?: Date | string | null;
}

export interface LoanInstallmentRow {
  installmentNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  totalAmount: number;
  remainingPrincipalBefore: number;
  remainingPrincipalAfter: number;
}

export interface LoanSchedule {
  totalPrincipal: number;
  totalInterest: number;
  totalPayment: number;
  method: AmortizationMethod;
  rows: LoanInstallmentRow[];
}

function toDate(d: unknown): Date {
  if (d instanceof Date) return d;
  if (!d) return new Date();
  const parsed = new Date(d as any);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function monthDateAdd(base: Date, months: number): Date {
  const d = new Date(base);
  const origDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(origDay, lastOfMonth));
  return d;
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function generateLoanInstallmentSchedule(input: AmortizationInput): LoanSchedule {
  const principal = Math.max(0, Number(input.principalAmount) || 0);
  const totalInstallments = Math.max(0, Math.trunc(Number(input.totalInstallments) || 0));
  const rawRate = Number(input.interestRatePercentPerYear);
  const rateYearly = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 0;
  const rateMonthly = rateYearly / 12 / 100;
  const method: AmortizationMethod = input.method && ['FLAT', 'EFEKTIF', 'ANUITAS'].includes(input.method)
    ? (input.method as AmortizationMethod)
    : 'FLAT';

  if (totalInstallments === 0) {
    const firstDue = monthDateAdd(toDate(input.disbursementDate ?? new Date()), 1);
    return {
      totalPrincipal: principal,
      totalInterest: 0,
      totalPayment: principal,
      method,
      rows: [{
        installmentNumber: 1,
        dueDate: toDate(input.firstDueDate) ?? firstDue,
        principal: round2(principal),
        interest: 0,
        totalAmount: round2(principal),
        remainingPrincipalBefore: principal,
        remainingPrincipalAfter: 0,
      }],
    };
  }

  const disbursement = toDate(input.disbursementDate ?? new Date());
  const firstDue = toDate(input.firstDueDate) ?? monthDateAdd(disbursement, 1);

  const rows: LoanInstallmentRow[] = [];
  let remBefore = principal;
  let totalInterest = 0;

  if (method === 'FLAT') {
    const flatInterestPerMonth = principal * rateMonthly;
    const principalPerMonth = principal / totalInstallments;
    for (let i = 1; i <= totalInstallments; i++) {
      const isLast = i === totalInstallments;
      const principalAmt = isLast ? remBefore : principalPerMonth;
      const interestAmt = flatInterestPerMonth;
      const total = round2(principalAmt + interestAmt);
      const roundedPrincipal = round2(principalAmt);
      const roundedInterest = round2(interestAmt);
      const remAfter = Math.max(0, round2(remBefore - roundedPrincipal));
      totalInterest += roundedInterest;
      rows.push({
        installmentNumber: i,
        dueDate: monthDateAdd(firstDue, i - 1),
        principal: roundedPrincipal,
        interest: roundedInterest,
        totalAmount: total,
        remainingPrincipalBefore: round2(remBefore),
        remainingPrincipalAfter: remAfter,
      });
      remBefore = remAfter;
    }
  } else if (method === 'EFEKTIF') {
    const basePrincipalPerMonth = principal / totalInstallments;
    for (let i = 1; i <= totalInstallments; i++) {
      const isLast = i === totalInstallments;
      const interestAmt = remBefore * rateMonthly;
      const principalAmt = isLast ? remBefore : basePrincipalPerMonth;
      const total = round2(principalAmt + interestAmt);
      const roundedInterest = round2(interestAmt);
      const roundedPrincipal = round2(principalAmt);
      const remAfter = Math.max(0, round2(remBefore - roundedPrincipal));
      totalInterest += roundedInterest;
      rows.push({
        installmentNumber: i,
        dueDate: monthDateAdd(firstDue, i - 1),
        principal: roundedPrincipal,
        interest: roundedInterest,
        totalAmount: total,
        remainingPrincipalBefore: round2(remBefore),
        remainingPrincipalAfter: remAfter,
      });
      remBefore = remAfter;
    }
  } else {
    // ANUITAS: monthly payment = fixed (PMT formula). Last payment absorbs rounding.
    const pmt = rateMonthly === 0
      ? principal / totalInstallments
      : (principal * rateMonthly) / (1 - Math.pow(1 + rateMonthly, -totalInstallments));
    for (let i = 1; i <= totalInstallments; i++) {
      const isLast = i === totalInstallments;
      const interestAmt = remBefore * rateMonthly;
      let principalAmt = pmt - interestAmt;
      if (isLast) principalAmt = remBefore;
      const total = round2(isLast ? principalAmt + interestAmt : pmt);
      const roundedInterest = round2(interestAmt);
      const roundedPrincipal = round2(principalAmt);
      const remAfter = Math.max(0, round2(remBefore - roundedPrincipal));
      totalInterest += roundedInterest;
      rows.push({
        installmentNumber: i,
        dueDate: monthDateAdd(firstDue, i - 1),
        principal: roundedPrincipal,
        interest: roundedInterest,
        totalAmount: total,
        remainingPrincipalBefore: round2(remBefore),
        remainingPrincipalAfter: remAfter,
      });
      remBefore = remAfter;
    }
  }

  const totalRoundedPrincipal = rows.reduce((s, r) => s + r.principal, 0);
  const totalRoundedInterest = rows.reduce((s, r) => s + r.interest, 0);
  return {
    totalPrincipal: round2(totalRoundedPrincipal),
    totalInterest: round2(totalInterest),
    totalPayment: round2(totalRoundedPrincipal + totalRoundedInterest),
    method,
    rows,
  };
}
