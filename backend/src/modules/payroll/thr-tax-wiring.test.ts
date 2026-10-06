jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const state: { setting: { value: string } | null } = { setting: null };
jest.mock('@/shared/database/prisma', () => {
  const client = {
    companySetting: { findUnique: jest.fn(async () => state.setting) },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/context/RequestContext', () => ({
  getCurrentCompanyId: () => 'company-a',
  getCurrentUser: () => ({ id: 'actor' }),
  getCurrentRoles: () => [],
  isSystemContext: () => false,
  runInSystemContext: async (_name: string, work: () => unknown) => work(),
}));
jest.mock('@/shared/payroll/payroll-policy', () => ({
  loadPayrollPolicyConfig: jest.fn(async () => ({ pph21: {}, bpjs: {}, ter: {} })),
}));

const employee: { value: unknown } = { value: null };
jest.mock('./employee-salary.service', () => ({
  employeeSalaryService: { thrInputs: jest.fn(async () => employee.value) },
}));

import { PayrollService } from './payroll.service';

/**
 * `calculateThrTax` shipped with no caller anywhere, and the comment in
 * `calculateThrStandalone` admitted it: "return amount THR saja". So the THR
 * endpoints quoted a gross figure and nobody worked out the withholding. The
 * arithmetic is tested in `shared/payroll/thr-tax.test.ts`; what is tested
 * here is that these endpoints apply it.
 */
const service = new PayrollService();

beforeEach(() => {
  state.setting = null;
  employee.value = {
    employee: {
      id: 'employee-1', fullName: 'Sari', employeeNumber: 'EMP001',
      joinDate: new Date('2020-01-01'), maritalStatus: 'SINGLE', taxId: '12.345',
      _count: { families: 0 },
    },
    salary: { baseSalary: { toString: () => '20000000', isFinite: () => true, lessThanOrEqualTo: () => false }, currency: 'IDR' },
  };
});

describe('the employee THR endpoint withholds PPh 21', () => {
  it('reports the tax, the net, and which method produced it', async () => {
    const result = await service.calculateEmployeeThr('employee-1', new Date('2026-03-01'));
    expect(result.amount).toBeGreaterThan(0);
    expect(result.tax).toBeGreaterThan(0);
    expect(result.netAmount).toBe(Math.round(result.amount - result.tax));
    expect(result.taxMethod).toBe('ANNUALIZED');
  });

  it('follows the company method setting', async () => {
    state.setting = { value: 'TER' };
    const result = await service.calculateEmployeeThr('employee-1', new Date('2026-03-01'));
    expect(result.taxMethod).toBe('TER');
  });

  it('reads the PTKP status from the employee, not a default', async () => {
    // Asserted under TER, where the status picks the bracket TABLE (kategori A
    // for TK/0, kategori C for K/3) so the status cannot fail to show.
    //
    // My first attempt asserted it under the annualized method and tied at
    // 3.000.000 for both: at this wage every PKP involved sits inside the 15%
    // band, so the INCREMENT is 15% of the THR whichever PTKP applies. The
    // status was being read correctly; the test could not see it.
    state.setting = { value: 'TER' };
    const single = await service.calculateEmployeeThr('employee-1', new Date('2026-03-01'));
    (employee.value as { employee: Record<string, unknown> }).employee.maritalStatus = 'MARRIED';
    (employee.value as { employee: Record<string, unknown> }).employee._count = { families: 3 };
    const married = await service.calculateEmployeeThr('employee-1', new Date('2026-03-01'));
    expect(married.tax).not.toBe(single.tax);
    expect(married.tax).toBeLessThan(single.tax);
  });
});

describe('the standalone THR calculator', () => {
  it('reports no tax when given no PTKP status, and says so', () => {
    const result = service.calculateThrStandalone({
      monthlyWage: 20_000_000, joinDate: '2020-01-01T00:00:00.000Z',
    } as never);
    // Reading `tax: null` as "nothing is due" would be wrong, hence the flag.
    expect(result.tax).toBeNull();
    expect(result.netAmount).toBeNull();
    expect(result.taxContextProvided).toBe(false);
  });

  it('reports the tax once a status is supplied', () => {
    const result = service.calculateThrStandalone({
      monthlyWage: 20_000_000, joinDate: '2020-01-01T00:00:00.000Z',
      married: false, dependents: 0,
    } as never);
    expect(result.taxContextProvided).toBe(true);
    expect(result.tax).toBeGreaterThan(0);
    expect(result.netAmount).toBe(Math.round(result.amount - (result.tax as number)));
  });

  it('honours the requested method', () => {
    const base = { monthlyWage: 20_000_000, joinDate: '2020-01-01T00:00:00.000Z', married: false, dependents: 0 };
    const annualized = service.calculateThrStandalone({ ...base, method: 'ANNUALIZED' } as never);
    const ter = service.calculateThrStandalone({ ...base, method: 'TER' } as never);
    expect(annualized.taxMethod).toBe('ANNUALIZED');
    expect(ter.taxMethod).toBe('TER');
    expect(ter.tax).not.toBe(annualized.tax);
  });
});
