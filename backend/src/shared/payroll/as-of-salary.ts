/**
 * Which salary row a payroll run pays (checklist §18).
 *
 * The rule: the LATEST row effective on or before the period end. A
 * future-dated raise must not leak into the current run, a row deactivated
 * only because a future-dated one superseded it must still pay, and an
 * employee whose latest row was deliberately paused must be skipped.
 *
 * Extracted because a second caller arrived. The THR run picks the same
 * salary the monthly run would, and a copy of this logic beside it would be
 * two answers to "what is this person's salary right now" — exactly the kind
 * of disagreement the arrears path was pulled out of `employment-window.ts`
 * to avoid.
 */

export interface AsOfSalaryRow {
  employeeId: string;
  effectiveDate: Date | string;
  isActive: boolean;
}

export class AmbiguousSalaryError extends Error {
  constructor(public readonly effectiveDate: string) {
    super(
      `Multiple active salaries found for one employee on effective date ${effectiveDate}; `
      + 'review salary allocations',
    );
    this.name = 'AmbiguousSalaryError';
  }
}

/**
 * One row per employee, or none when nothing is payable.
 *
 * Throws `AmbiguousSalaryError` when two rows share the selected effective
 * date. That is a data error, and picking one by query order would silently
 * pay one of two conflicting salaries — or skip somebody because the row it
 * happened to pick was inactive.
 */
export function selectAsOfSalaries<T extends AsOfSalaryRow>(rows: readonly T[], periodEnd: Date | string): T[] {
  const periodEndTime = new Date(periodEnd).getTime();
  const byEmployee = new Map<string, T[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  const selected: T[] = [];
  for (const employeeRows of byEmployee.values()) {
    // Newest first, so `find` below is the latest row that has taken effect.
    // Sorted here rather than trusted from the caller: the previous version
    // relied on the repository's ordering, which is a contract no type states.
    const ordered = [...employeeRows].sort(
      (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(),
    );
    const asOf = ordered.find((row) => new Date(row.effectiveDate).getTime() <= periodEndTime);
    if (!asOf) continue; // only future-dated salaries exist — nothing payable

    const asOfTime = new Date(asOf.effectiveDate).getTime();
    if (ordered.filter((row) => new Date(row.effectiveDate).getTime() === asOfTime).length > 1) {
      throw new AmbiguousSalaryError(new Date(asOf.effectiveDate).toISOString().slice(0, 10));
    }

    const hasNewerRow = ordered.some((row) => new Date(row.effectiveDate).getTime() > periodEndTime);
    if (!asOf.isActive && !hasNewerRow) continue; // deliberately paused
    selected.push(asOf.isActive || hasNewerRow ? { ...asOf, isActive: true } : asOf);
  }
  return selected;
}
