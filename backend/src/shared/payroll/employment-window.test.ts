import { employmentWindow, inclusiveDays } from './employment-window';

const periodStart = new Date('2026-09-01T00:00:00Z');
const periodEnd = new Date('2026-09-30T00:00:00Z');
const window = (over: Record<string, unknown>) => employmentWindow({ periodStart, periodEnd, ...over });

describe('the employed slice of a payroll period', () => {
  it('counts both ends of a whole month', () => {
    expect(inclusiveDays(periodStart, periodEnd)).toBe(30);
    expect(window({}).fraction).toBe(1);
    expect(window({}).prorated).toBe(false);
  });

  it('starts at the join date for a mid-period joiner', () => {
    const result = window({ joinDate: new Date('2026-09-20T00:00:00Z') });

    // 20 September to 30 September inclusive is eleven days, not a month.
    expect(result.payableDays).toBe(11);
    expect(result.prorated).toBe(true);
  });

  it('ends at the last working date for a leaver', () => {
    const result = window({ lastWorkingDate: new Date('2026-09-10T00:00:00Z') });

    expect(result.payableDays).toBe(10);
    expect(result.employedAtAll).toBe(true);
  });

  it('handles someone who both joined and left inside the period', () => {
    const result = window({
      joinDate: new Date('2026-09-05T00:00:00Z'),
      lastWorkingDate: new Date('2026-09-14T00:00:00Z'),
    });

    expect(result.payableDays).toBe(10);
  });

  it('ignores a join date before the period and a last day after it', () => {
    const result = window({
      joinDate: new Date('2019-01-01T00:00:00Z'),
      lastWorkingDate: new Date('2030-01-01T00:00:00Z'),
    });

    expect(result.fraction).toBe(1);
  });

  it('reports nobody employed when the window closes before the period opens', () => {
    const result = window({ lastWorkingDate: new Date('2026-08-15T00:00:00Z') });

    expect(result.employedAtAll).toBe(false);
    expect(result.fraction).toBe(0);
  });

  it('reports nobody employed when they join after the period ends', () => {
    expect(window({ joinDate: new Date('2026-10-05T00:00:00Z') }).employedAtAll).toBe(false);
  });
});
