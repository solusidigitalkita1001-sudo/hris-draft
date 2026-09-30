import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

const state: { employee: Row | null; payslips: Row[]; queries: Row[]; distinct: Row[] } = {
  employee: null, payslips: [], queries: [], distinct: [],
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    employee: { findFirst: jest.fn(async () => state.employee) },
    payslip: {
      findMany: jest.fn(async ({ where, distinct }: { where: Row; distinct?: unknown }) => {
        state.queries.push(where);
        return distinct ? state.distinct : state.payslips;
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { AnnualTaxRecapService, recapToCsv } from './annual-tax-recap.service';

const service = new AnnualTaxRecapService();
const COMPANY = 'company-a';
const EMPLOYEE = 'employee-1';

function employeeRow(over: Row = {}) {
  return {
    id: EMPLOYEE, employeeNumber: 'EMP001', fullName: 'Maya Putri',
    taxId: '09.254.294.3-407.000', maritalStatus: 'MARRIED',
    joinDate: new Date('2020-01-06T00:00:00Z'),
    _count: { families: 2 },
    company: { id: COMPANY, name: 'PT Contoh', taxId: '01.234.567.8-091.000' },
    ...over,
  };
}

function payslipRow(month: number, over: Row = {}) {
  return {
    id: `payslip-${month}`,
    baseSalary: new Prisma.Decimal('10000000'),
    totalEarnings: new Prisma.Decimal('11000000'),
    totalDeductions: new Prisma.Decimal('900000'),
    netPay: new Prisma.Decimal('10100000'),
    components: [
      { name: 'PPh 21', type: 'DEDUCTION', amount: new Prisma.Decimal('450000'), isTaxable: false, salaryComponent: { code: 'PPH21' } },
      { name: 'BPJS Kesehatan', type: 'DEDUCTION', amount: new Prisma.Decimal('110000'), isTaxable: false, salaryComponent: { code: 'BPJS-KES' } },
      { name: 'BPJS Ketenagakerjaan', type: 'DEDUCTION', amount: new Prisma.Decimal('300000'), isTaxable: false, salaryComponent: { code: 'BPJS-TK' } },
    ],
    payrollRun: { period: { code: `PR-2026-${String(month).padStart(2, '0')}`, startDate: new Date(Date.UTC(2026, month - 1, 1)) } },
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.employee = employeeRow();
  state.payslips = [];
  state.queries = [];
  state.distinct = [];
});

describe('annual PPh21 recap', () => {
  it('totals gross, tax and employee BPJS across the year', async () => {
    state.payslips = [payslipRow(1), payslipRow(2), payslipRow(3)];

    const recap = await service.build(COMPANY, EMPLOYEE, 2026);

    expect(recap.totals).toMatchObject({
      grossEarnings: '33000000.00',
      pph21: '1350000.00',
      bpjsEmployee: '1230000.00',
      monthsPaid: 3,
    });
  });

  it('keeps one row per month, in month order, whatever order the payslips arrive in', async () => {
    state.payslips = [payslipRow(3), payslipRow(1), payslipRow(2)];

    const recap = await service.build(COMPANY, EMPLOYEE, 2026);

    expect(recap.months.map((row) => row.month)).toEqual([1, 2, 3]);
    expect(recap.months[0].periodCode).toBe('PR-2026-01');
  });

  /**
   * Only approved runs are money anybody received. A recap that counted a draft
   * would overstate both the income declared and the tax withheld.
   */
  it('reads approved runs only, inside the requested year', async () => {
    await service.build(COMPANY, EMPLOYEE, 2026);

    const where = state.queries[0] as { payrollRun: { status: string; period: Row } };
    expect(where.payrollRun.status).toBe('APPROVED');
    expect(where.payrollRun.period).toMatchObject({
      startDate: { gte: new Date(Date.UTC(2026, 0, 1)) },
    });
  });

  it.each([
    ['MARRIED', 2, 'K/2'],
    ['MARRIED', 0, 'K/0'],
    ['SINGLE', 0, 'TK/0'],
    ['SINGLE', 1, 'TK/1'],
    // PTKP counts at most three dependents; the fourth child is real but does
    // not raise the allowance.
    ['MARRIED', 5, 'K/3'],
  ])('derives PTKP status %s with %i dependents as %s', async (maritalStatus, families, expected) => {
    state.employee = employeeRow({ maritalStatus, _count: { families } });
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.employee.ptkpStatus).toBe(expected);
  });

  it('warns when dependents exceed the PTKP cap, so the capping is visible', async () => {
    state.employee = employeeRow({ _count: { families: 5 } });
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.warnings).toContain('tax:DEPENDENTS_CAPPED_AT_3_OF_5');
  });

  /** A missing NPWP raises the withholding rate and the form needs the number. */
  it('warns about a missing employee NPWP rather than filing a blank', async () => {
    state.employee = employeeRow({ taxId: null });
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.warnings).toContain('employee:NPWP_MISSING');
  });

  it('warns about a missing company NPWP', async () => {
    state.employee = employeeRow({ company: { id: COMPANY, name: 'PT Contoh', taxId: null } });
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.warnings).toContain('company:NPWP_MISSING');
  });

  it('says so when the year holds no approved payslips instead of returning a confident zero', async () => {
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.totals).toMatchObject({ grossEarnings: '0.00', pph21: '0.00', monthsPaid: 0 });
    expect(recap.warnings).toContain('payroll:NO_APPROVED_PAYSLIPS_IN_YEAR');
  });

  /** A mid-year joiner or leaver is normal, but the reader must know. */
  it('marks a partial year with the number of months it covers', async () => {
    state.payslips = [payslipRow(7), payslipRow(8)];
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.warnings).toContain('payroll:PARTIAL_YEAR_2_MONTHS');
  });

  it('does not mark a complete year as partial', async () => {
    state.payslips = Array.from({ length: 12 }, (_, index) => payslipRow(index + 1));
    const recap = await service.build(COMPANY, EMPLOYEE, 2026);
    expect(recap.warnings.some((warning) => warning.startsWith('payroll:PARTIAL_YEAR'))).toBe(false);
  });

  it('refuses an employee outside the active company', async () => {
    state.employee = null;
    await expect(service.build(COMPANY, EMPLOYEE, 2026)).rejects.toThrow(/Employee not found/i);
  });

  it.each([[1999], [2101]])('refuses year %i', async (year) => {
    await expect(service.build(COMPANY, EMPLOYEE, year)).rejects.toThrow(/Year is out of range/i);
  });
});

describe('recap CSV', () => {
  it('lays out a month per line and closes with a total row', async () => {
    state.payslips = [payslipRow(1), payslipRow(2)];
    const csv = recapToCsv(await service.build(COMPANY, EMPLOYEE, 2026));

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Bulan,Kode Periode,Penghasilan Bruto,PPh 21,BPJS (karyawan),Take Home');
    expect(lines[1]).toBe('1,PR-2026-01,11000000.00,450000.00,410000.00,10100000.00');
    expect(lines.at(-1)).toBe('TOTAL,,22000000.00,900000.00,820000.00,20200000.00');
  });
});
