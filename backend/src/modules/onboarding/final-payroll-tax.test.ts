jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const inputs: { value: unknown } = { value: null };
jest.mock('./onboarding.repository', () => ({
  onboardingRepository: { findFinalPayrollInputs: jest.fn(async () => inputs.value) },
}));

import { OnboardingService } from './onboarding.service';

/**
 * The exit calculation quoted a gross severance figure and withheld nothing:
 * PPh 21 final under PP 68/2009 was absent, so the number an employee was
 * shown on their last day was not the number they would receive. The brackets
 * themselves are tested in `shared/payroll/severance-tax.test.ts`; what is
 * tested here is that this endpoint applies them, to the right base.
 */
const service = new OnboardingService();

function resignation(monthlyWage: number, joinDate: string, lastWorkingDate: string) {
  return {
    resignation: {
      employeeId: 'employee-1',
      lastWorkingDate: new Date(lastWorkingDate),
      employee: {
        id: 'employee-1', fullName: 'Sari', employeeNumber: 'EMP001',
        joinDate: new Date(joinDate),
      },
    },
    activeSalary: { baseSalary: monthlyWage },
    unusedLeaveDays: 0,
  };
}

beforeEach(() => {
  // Ten years of service at 20 juta: well into the taxable brackets.
  inputs.value = resignation(20_000_000, '2015-01-01', '2026-01-01');
});

describe('final payroll withholds PPh 21 final on the severance', () => {
  it('reports the tax and what the employee actually receives', async () => {
    const result = await service.calculateFinalPayroll('resignation-1', { reason: 'TERMINATION' });
    expect(result.total).toBeGreaterThan(50_000_000);
    expect(result.tax).toBeGreaterThan(0);
    expect(result.netTotal).toBe(Math.round(result.total - result.tax));
    expect(result.taxIsFinal).toBe(true);
  });

  it('taxes the whole entitlement, because pasal 1 angka 4 includes UPMK and UPH', async () => {
    const result = await service.calculateFinalPayroll('resignation-1', {
      reason: 'TERMINATION', compensationOfRights: 10_000_000,
    });
    // The base is `total`, so adding UPH raises the tax rather than passing
    // through untaxed.
    const without = await service.calculateFinalPayroll('resignation-1', { reason: 'TERMINATION' });
    expect(result.total).toBe(without.total + 10_000_000);
    expect(result.tax).toBeGreaterThan(without.tax);
  });

  it('withholds nothing when the entitlement stays under the 50 juta exemption', async () => {
    // A resignation earns no UP or UPMK, so the base here is only leave money.
    inputs.value = resignation(5_000_000, '2024-01-01', '2026-01-01');
    const result = await service.calculateFinalPayroll('resignation-1', { reason: 'RESIGN' });
    expect(result.total).toBeLessThan(50_000_000);
    expect(result.tax).toBe(0);
    expect(result.netTotal).toBe(Math.round(result.total));
  });

  it('climbs the brackets for a second instalment instead of restarting them', async () => {
    const first = await service.calculateFinalPayroll('resignation-1', { reason: 'TERMINATION' });
    const second = await service.calculateFinalPayroll('resignation-1', {
      reason: 'TERMINATION', previouslyPaidGross: first.total, calendarYearIndex: 2,
    });
    expect(second.cumulativeGross).toBe(first.total * 2);
    expect(second.tax).toBeGreaterThan(first.tax);
  });

  it('refuses the third calendar year rather than applying the wrong tariff', async () => {
    await expect(service.calculateFinalPayroll('resignation-1', {
      reason: 'TERMINATION', calendarYearIndex: 3,
    })).rejects.toThrow(/no longer final/);
  });
});
