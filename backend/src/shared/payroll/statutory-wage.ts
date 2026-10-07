import { Prisma } from '@prisma/client';

/**
 * "Upah sebulan" as the statute means it: gaji pokok + tunjangan TETAP.
 *
 * Two rules need this exact figure and neither is free to define it its own
 * way — THR under Permenaker 6/2016, and the daily rate for encashing leave.
 * Both explicitly exclude tunjangan tidak tetap: transport paid per day of
 * attendance, a meal allowance per shift, anything that moves with presence or
 * output. Including those inflates a statutory entitlement.
 *
 * Before `SalaryComponent.isFixedAllowance` existed there was no way to say
 * which was which, so leave encashment counted EVERY allowance and THR counted
 * none — one too generous, the other short of what the law requires. This is
 * the single place that answers the question now.
 */
export interface WageComponent {
  isActive: boolean;
  amount: Prisma.Decimal | number | string;
  salaryComponent: {
    name: string;
    type: string;
    isFixedAllowance?: boolean;
    isActive?: boolean;
    deletedAt?: Date | null;
  };
}

export interface StatutoryWage {
  /** gaji pokok + tunjangan tetap. */
  wage: Prisma.Decimal;
  /** The components that counted, for showing the working. */
  fixedAllowances: Array<{ name: string; amount: string }>;
}

/** The fixed allowances on an allocation, ignoring inactive and deleted rows. */
export function fixedAllowancesOf(components: readonly WageComponent[]): WageComponent[] {
  return components.filter((row) =>
    row.isActive
    && row.salaryComponent.type === 'ALLOWANCE'
    && row.salaryComponent.isFixedAllowance === true
    && row.salaryComponent.isActive !== false
    && !row.salaryComponent.deletedAt);
}

export function monthlyStatutoryWage(
  baseSalary: Prisma.Decimal | number | string,
  components: readonly WageComponent[],
  options: { includeFixedAllowances?: boolean } = {},
): StatutoryWage {
  // Default true: the statutory definition includes them. A caller that has a
  // policy reason to leave them out says so explicitly.
  const include = options.includeFixedAllowances ?? true;
  const counted = include ? fixedAllowancesOf(components) : [];
  return {
    wage: counted.reduce(
      (sum, row) => sum.plus(row.amount),
      new Prisma.Decimal(baseSalary),
    ),
    fixedAllowances: counted.map((row) => ({
      name: row.salaryComponent.name,
      amount: new Prisma.Decimal(row.amount).toString(),
    })),
  };
}
