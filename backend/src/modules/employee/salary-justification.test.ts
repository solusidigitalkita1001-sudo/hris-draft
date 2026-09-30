import { createCareerTransactionSchema } from './employee.dto';

/**
 * GAP-21. The decision was to keep compensation inside the career path rather
 * than build a second approval flow — a second flow would split the career
 * history across two places, and a split salary history is exactly what gets
 * asked about in a pay dispute or an audit.
 *
 * What the single path was missing is a stated reason for the *money*, separate
 * from the reason for the movement. A raise recorded with no justification is
 * the one thing nobody can reconstruct a year later.
 */
const base = {
  transactionType: 'PROMOTION' as const,
  effectiveDate: '2026-10-01T00:00:00.000Z',
  toPositionId: '0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
};

describe('career movement salary justification', () => {
  it('accepts a movement that does not touch pay, with no justification', () => {
    expect(createCareerTransactionSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a raise that states why', () => {
    const result = createCareerTransactionSchema.safeParse({
      ...base,
      toBaseSalary: 15_000_000,
      salaryJustification: 'Promosi ke Senior Engineer sesuai hasil review Q3 dan band gaji posisi baru.',
      budgetReference: 'BUDGET-2026-ENG-014',
    });
    expect(result.success).toBe(true);
  });

  it('refuses a raise with no justification at all', () => {
    const result = createCareerTransactionSchema.safeParse({ ...base, toBaseSalary: 15_000_000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/salaryJustification wajib diisi/);
      expect(result.error.issues[0].path).toEqual(['salaryJustification']);
    }
  });

  it.each([[''], ['   '], ['\n\t']])('refuses a raise whose justification is only whitespace (%j)', (justification) => {
    const result = createCareerTransactionSchema.safeParse({ ...base, toBaseSalary: 15_000_000, salaryJustification: justification });
    expect(result.success).toBe(false);
  });

  /** Ten characters is a low bar, but it stops "ok" and "." from counting. */
  it('refuses a justification too short to mean anything', () => {
    const result = createCareerTransactionSchema.safeParse({ ...base, toBaseSalary: 15_000_000, salaryJustification: 'naik' });
    expect(result.success).toBe(false);
  });

  it('still refuses a non-positive salary', () => {
    const result = createCareerTransactionSchema.safeParse({
      ...base, toBaseSalary: 0, salaryJustification: 'Penyesuaian struktur gaji tahunan.',
    });
    expect(result.success).toBe(false);
  });

  it('keeps the movement reason separate from the salary justification', () => {
    const result = createCareerTransactionSchema.safeParse({
      ...base,
      toBaseSalary: 15_000_000,
      reason: 'Mengisi posisi yang kosong setelah resignasi.',
      salaryJustification: 'Band gaji posisi baru, disetujui anggaran engineering.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).not.toBe(result.data.salaryJustification);
    }
  });
});
