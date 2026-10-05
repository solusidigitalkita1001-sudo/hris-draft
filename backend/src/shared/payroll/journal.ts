import { Prisma } from '@prisma/client';

/**
 * Payroll journal by cost centre (GAP-47).
 *
 * `Department.costCenter` has been collected since the department module was
 * written — the repository stores it, the DTO accepts it — and payroll has
 * never read it. So the one question accounting asks of a payroll run, "which
 * cost centre carries this", had no answer, and the figures were re-keyed by
 * hand from the payslip list.
 *
 * The output is deliberately a trial balance rather than a flat total, because
 * a journal that does not balance is worse than no journal: it gets posted.
 * Per cost centre, earnings are the debit and the credits are every deduction
 * plus the net actually payable, so
 *
 *     earnings == deductions + netPay
 *
 * holds by construction and is asserted by the tests. Deductions are broken
 * out by component so PPh 21, BPJS and loan repayments land in their own
 * liability accounts instead of one lump.
 */

export interface JournalPayslip {
  netPay: Prisma.Decimal | number | string;
  /** Frozen org context written at calculation time. */
  employeeSnapshot: unknown;
  components: { name: string; type: string; amount: Prisma.Decimal | number | string }[];
}

export interface JournalLine {
  costCenter: string;
  departmentName: string;
  employees: number;
  /** Debit: the employer's gross cost for this centre. */
  earnings: number;
  /** Credit: payable to the employee. */
  netPay: number;
  /** Credit: one entry per deduction component, by its payslip name. */
  deductions: { name: string; amount: number }[];
  deductionsTotal: number;
  /** earnings - deductions - netPay. Zero when the centre balances. */
  imbalance: number;
}

const num = (value: Prisma.Decimal | number | string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Cost centre is not on the snapshot, so it is resolved by department id. */
export function buildPayrollJournal(
  payslips: JournalPayslip[],
  costCentreByDepartment: Map<string, string | null>,
): JournalLine[] {
  const buckets = new Map<string, {
    costCenter: string; departmentName: string; employees: number;
    earnings: number; netPay: number; deductions: Map<string, number>;
  }>();

  for (const slip of payslips) {
    const snapshot = (slip.employeeSnapshot ?? {}) as { departmentId?: string | null; departmentName?: string | null };
    const departmentId = snapshot.departmentId ?? null;
    // An employee with no department, or a department with no cost centre,
    // is reported under UNASSIGNED rather than dropped: a line accounting
    // cannot post is a question to answer, and a missing line is not.
    const costCenter = (departmentId ? costCentreByDepartment.get(departmentId) : null) || 'UNASSIGNED';

    const bucket = buckets.get(costCenter) ?? {
      costCenter,
      departmentName: snapshot.departmentName ?? 'Tanpa departemen',
      employees: 0, earnings: 0, netPay: 0, deductions: new Map<string, number>(),
    };
    bucket.employees += 1;
    bucket.netPay += num(slip.netPay);
    for (const component of slip.components) {
      const amount = num(component.amount);
      if (component.type === 'ALLOWANCE') bucket.earnings += amount;
      else bucket.deductions.set(component.name, (bucket.deductions.get(component.name) ?? 0) + amount);
    }
    buckets.set(costCenter, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => {
      const deductions = [...bucket.deductions.entries()]
        .map(([name, amount]) => ({ name, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount);
      const deductionsTotal = round2(deductions.reduce((sum, row) => sum + row.amount, 0));
      const earnings = round2(bucket.earnings);
      const netPay = round2(bucket.netPay);
      return {
        costCenter: bucket.costCenter,
        departmentName: bucket.departmentName,
        employees: bucket.employees,
        earnings, netPay, deductions, deductionsTotal,
        imbalance: round2(earnings - deductionsTotal - netPay),
      };
    })
    .sort((a, b) => b.earnings - a.earnings);
}

/** Flat CSV, one row per cost centre and account, for an accounting import. */
export function journalToCsv(lines: JournalLine[]): string {
  const rows: string[][] = [['cost_center', 'department', 'account', 'debit', 'credit']];
  for (const line of lines) {
    rows.push([line.costCenter, line.departmentName, 'BEBAN GAJI', line.earnings.toFixed(2), '0.00']);
    for (const deduction of line.deductions) {
      rows.push([line.costCenter, line.departmentName, deduction.name, '0.00', deduction.amount.toFixed(2)]);
    }
    rows.push([line.costCenter, line.departmentName, 'UTANG GAJI (NETTO)', '0.00', line.netPay.toFixed(2)]);
  }
  // A leading '=', '+', '-' or '@' in a field is executed by spreadsheets;
  // component names are tenant-supplied, so they are neutralised here too.
  const escape = (field: string) => {
    const guarded = /^[=+\-@]/.test(field) ? `'${field}` : field;
    return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}
