import { AmbiguousSalaryError, selectAsOfSalaries } from './as-of-salary';

/**
 * Behaviour carried over verbatim from `calculatePayroll`, where it lived
 * inline. Pinned here because a second caller now depends on it: the THR run
 * must pick the same salary the monthly run would.
 */
const row = (employeeId: string, effectiveDate: string, isActive = true) =>
  ({ employeeId, effectiveDate: new Date(effectiveDate), isActive });

const END = '2026-09-30';

describe('as-of salary selection', () => {
  it('pays the latest row that has taken effect', () => {
    const picked = selectAsOfSalaries([
      row('e1', '2026-01-01'),
      row('e1', '2026-06-01'),
      row('e1', '2025-03-01'),
    ], END);
    expect(picked).toHaveLength(1);
    expect(new Date(picked[0].effectiveDate).toISOString().slice(0, 10)).toBe('2026-06-01');
  });

  it('does not let a future-dated raise leak into this period', () => {
    const picked = selectAsOfSalaries([row('e1', '2026-06-01'), row('e1', '2026-11-01')], END);
    expect(new Date(picked[0].effectiveDate).toISOString().slice(0, 10)).toBe('2026-06-01');
  });

  it('pays nothing when every row is still in the future', () => {
    expect(selectAsOfSalaries([row('e1', '2026-11-01')], END)).toEqual([]);
  });

  it('still pays a row deactivated only because a newer one superseded it', () => {
    // The newer row has not taken effect yet, so this period is still owed the
    // old salary even though the row was switched off.
    const picked = selectAsOfSalaries([
      row('e1', '2026-06-01', false),
      row('e1', '2026-11-01'),
    ], END);
    expect(picked).toHaveLength(1);
    expect(picked[0].isActive).toBe(true);
  });

  it('skips an employee whose latest row was deliberately paused', () => {
    expect(selectAsOfSalaries([row('e1', '2026-06-01', false)], END)).toEqual([]);
  });

  it('refuses two rows sharing the selected effective date', () => {
    // Picking by query order would silently pay one of two conflicting
    // salaries, or skip somebody because the row it happened to take was off.
    expect(() => selectAsOfSalaries([
      row('e1', '2026-06-01'),
      row('e1', '2026-06-01'),
    ], END)).toThrow(AmbiguousSalaryError);
    expect(() => selectAsOfSalaries([row('e1', '2026-06-01'), row('e1', '2026-06-01')], END))
      .toThrow(/2026-06-01/);
  });

  it('tolerates duplicates on a date it did not select', () => {
    // Two old rows are somebody else's problem; this period is not paid from
    // them.
    const picked = selectAsOfSalaries([
      row('e1', '2025-01-01'), row('e1', '2025-01-01'), row('e1', '2026-06-01'),
    ], END);
    expect(picked).toHaveLength(1);
  });

  it('decides each employee independently', () => {
    const picked = selectAsOfSalaries([
      row('e1', '2026-06-01'),
      row('e2', '2026-11-01'),
      row('e3', '2026-02-01', false),
      row('e4', '2026-02-01'),
    ], END);
    expect(picked.map((entry) => entry.employeeId).sort()).toEqual(['e1', 'e4']);
  });

  it('does not depend on the order it was handed', () => {
    const rows = [row('e1', '2025-03-01'), row('e1', '2026-06-01'), row('e1', '2026-01-01')];
    const forward = selectAsOfSalaries(rows, END);
    const backward = selectAsOfSalaries([...rows].reverse(), END);
    expect(forward[0].effectiveDate).toEqual(backward[0].effectiveDate);
  });

  it('includes a row effective exactly on the period end', () => {
    expect(selectAsOfSalaries([row('e1', END)], END)).toHaveLength(1);
  });
});
