import { Prisma } from '@prisma/client';
import { createSalaryComponentSchema } from '@/modules/payroll/payroll.dto';
import { fixedAllowancesOf, monthlyStatutoryWage, type WageComponent } from './statutory-wage';

/**
 * "Upah sebulan" is gaji pokok plus tunjangan TETAP. Two statutory figures
 * depend on it — THR under Permenaker 6/2016 and the leave-encashment daily
 * rate — and before `isFixedAllowance` existed neither could express it:
 * encashment counted every allowance, THR counted none.
 */
const row = (name: string, amount: string, over: Partial<WageComponent['salaryComponent']> = {}): WageComponent => ({
  isActive: true,
  amount: new Prisma.Decimal(amount),
  salaryComponent: { name, type: 'ALLOWANCE', isFixedAllowance: true, isActive: true, deletedAt: null, ...over },
});

describe('the statutory monthly wage', () => {
  it('adds the fixed allowances to base pay', () => {
    const { wage, fixedAllowances } = monthlyStatutoryWage('10000000', [
      row('Tunjangan Jabatan', '1500000'),
      row('Tunjangan Keluarga', '500000'),
    ]);
    expect(wage.toString()).toBe('12000000');
    expect(fixedAllowances).toEqual([
      { name: 'Tunjangan Jabatan', amount: '1500000' },
      { name: 'Tunjangan Keluarga', amount: '500000' },
    ]);
  });

  it('leaves out a variable allowance, which is the whole point', () => {
    const { wage, fixedAllowances } = monthlyStatutoryWage('10000000', [
      row('Tunjangan Jabatan', '1500000'),
      row('Tunjangan Transport', '900000', { isFixedAllowance: false }),
      row('Tunjangan Makan', '600000', { isFixedAllowance: undefined }),
    ]);
    // Transport moves with attendance and meal with shifts worked; paying a
    // statutory entitlement on them pays for days nobody worked.
    expect(wage.toString()).toBe('11500000');
    expect(fixedAllowances.map((entry) => entry.name)).toEqual(['Tunjangan Jabatan']);
  });

  it('never counts a deduction, whatever its flags say', () => {
    const { wage } = monthlyStatutoryWage('10000000', [
      row('Potongan Koperasi', '200000', { type: 'DEDUCTION' }),
    ]);
    expect(wage.toString()).toBe('10000000');
  });

  it('ignores inactive and deleted rows', () => {
    const { wage } = monthlyStatutoryWage('10000000', [
      { ...row('Tunjangan Lama', '1000000'), isActive: false },
      row('Tunjangan Dicabut', '1000000', { isActive: false }),
      row('Tunjangan Dihapus', '1000000', { deletedAt: new Date('2026-01-01') }),
      row('Tunjangan Jabatan', '250000'),
    ]);
    expect(wage.toString()).toBe('10250000');
  });

  it('returns base pay alone when asked to leave allowances out', () => {
    // Leave encashment has a policy setting for this; THR does not, because
    // the statute does not offer the choice.
    const { wage, fixedAllowances } = monthlyStatutoryWage('10000000', [row('Tunjangan Jabatan', '1500000')],
      { includeFixedAllowances: false });
    expect(wage.toString()).toBe('10000000');
    expect(fixedAllowances).toEqual([]);
  });

  it('keeps decimal precision instead of going through a float', () => {
    const { wage } = monthlyStatutoryWage('10000000.33', [row('Tunjangan Jabatan', '0.34')]);
    expect(wage.toString()).toBe('10000000.67');
  });

  it('exposes the filter on its own, for callers that need the rows', () => {
    const rows = [row('Tetap', '1'), row('Tidak Tetap', '1', { isFixedAllowance: false })];
    expect(fixedAllowancesOf(rows)).toHaveLength(1);
  });
});

describe('the flag can actually be set', () => {
  it('is accepted by the salary component DTO', () => {
    // A flag no API can set would be unreachable, which is the defect class
    // this codebase keeps producing.
    const parsed = createSalaryComponentSchema.safeParse({
      companyId: '11111111-1111-4111-8111-111111111111',
      name: 'Tunjangan Jabatan', type: 'ALLOWANCE', isFixedAllowance: true,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.isFixedAllowance).toBe(true);
  });

  it('defaults to false, so a new component is fixed only on purpose', () => {
    const parsed = createSalaryComponentSchema.safeParse({
      companyId: '11111111-1111-4111-8111-111111111111',
      name: 'Tunjangan Transport', type: 'ALLOWANCE',
    });
    expect(parsed.success && parsed.data.isFixedAllowance).toBe(false);
  });
});
