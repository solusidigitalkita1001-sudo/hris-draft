import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

const state: { period: Row | null; company: Row | null; payslips: Row[]; queries: Row[]; bpjsPolicy: Row } = {
  period: null, company: null, payslips: [], queries: [], bpjsPolicy: {},
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    payrollPeriod: { findFirst: jest.fn(async () => state.period) },
    company: { findFirst: jest.fn(async () => state.company) },
    payslip: {
      findMany: jest.fn(async ({ where }: { where: Row }) => {
        state.queries.push(where);
        return state.payslips;
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/payroll/payroll-policy', () => ({
  loadPayrollPolicyConfig: jest.fn(async () => ({ pph21: {}, bpjs: state.bpjsPolicy })),
}));

import { BpjsReportService, bpjsReportToCsv } from './bpjs-report.service';

const service = new BpjsReportService();
const COMPANY = 'company-a';
const PERIOD = 'period-1';

function payslipRow(over: Row = {}, employee: Row = {}) {
  return {
    baseSalary: new Prisma.Decimal('10000000'),
    employee: {
      employeeNumber: 'EMP001', fullName: 'Maya Putri', idNumber: '3174012345670001',
      bpjsKesehatan: '0001234567890', bpjsKetenagakerjaan: '9987654321',
      ...employee,
    },
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.period = {
    id: PERIOD, code: 'PR-2026-09', name: 'September 2026',
    startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2026-09-30T00:00:00Z'),
  };
  state.company = { id: COMPANY, name: 'PT Contoh', taxId: '01.234.567.8-091.000' };
  state.payslips = [];
  state.queries = [];
  state.bpjsPolicy = {};
});

describe('monthly BPJS contribution report', () => {
  /**
   * The employer share is the whole point: a payslip only records what was
   * deducted from the employee, while JKK, JKM and the employer halves of JHT,
   * JP and JKN never appear there — and they are most of what BPJS is owed.
   */
  it('reports both sides on the standard rates', async () => {
    state.payslips = [payslipRow()];

    const report = await service.build(COMPANY, PERIOD);
    const [row] = report.rows;

    expect(row.employee).toMatchObject({
      jht: '200000.00',  // 2% of 10.000.000
      jp: '100000.00',   // 1% of 10.000.000 (below the JP cap)
      jkn: '100000.00',  // 1% of 10.000.000 (below the JKN cap)
      total: '400000.00',
    });
    expect(row.employer).toMatchObject({
      jkk: '24000.00',   // 0.24%
      jkm: '30000.00',   // 0.30%
      jht: '370000.00',  // 3.7%
      jp: '200000.00',   // 2%
      jkn: '400000.00',  // 4%
      total: '1024000.00',
    });
    expect(row.grandTotal).toBe('1424000.00');
  });

  /** The caps are the part a naive percentage gets wrong for senior staff. */
  it('applies the JP and JKN wage caps to a salary above them', async () => {
    state.payslips = [payslipRow({ baseSalary: new Prisma.Decimal('30000000') })];

    const [row] = (await service.build(COMPANY, PERIOD)).rows;

    expect(row.employee.jht).toBe('600000.00');          // 2% of the full wage, uncapped
    expect(row.employee.jp).toBe('105474.00');           // 1% of the 10.547.400 cap
    expect(row.employee.jkn).toBe('120000.00');          // 1% of the 12.000.000 cap
  });

  it('uses the company policy rates rather than hardcoded defaults', async () => {
    state.bpjsPolicy = { jkkRatePercent: 1.74 };
    state.payslips = [payslipRow()];

    const [row] = (await service.build(COMPANY, PERIOD)).rows;

    expect(row.employer.jkk).toBe('174000.00'); // the highest risk class
    expect((await service.build(COMPANY, PERIOD)).config.jkkRatePercent).toBe(1.74);
  });

  it('totals both sides across employees', async () => {
    state.payslips = [payslipRow(), payslipRow({}, { employeeNumber: 'EMP002' })];

    const report = await service.build(COMPANY, PERIOD);

    expect(report.totals).toMatchObject({
      employee: '800000.00',
      employer: '2048000.00',
      grandTotal: '2848000.00',
      employees: 2,
    });
  });

  it('reads approved runs of that period only', async () => {
    await service.build(COMPANY, PERIOD);
    expect(state.queries[0]).toMatchObject({ payrollRun: { periodId: PERIOD, status: 'APPROVED' } });
  });

  /**
   * A contribution with no membership number cannot be matched to a participant
   * at BPJS, so the filing fails for that person — better flagged here.
   */
  it.each([
    ['bpjsKesehatan', 'bpjs:KESEHATAN_NUMBER_MISSING'],
    ['bpjsKetenagakerjaan', 'bpjs:KETENAGAKERJAAN_NUMBER_MISSING'],
    ['idNumber', 'employee:NIK_MISSING'],
  ])('flags a missing %s', async (field, warning) => {
    state.payslips = [payslipRow({}, { [field]: null })];

    const report = await service.build(COMPANY, PERIOD);

    expect(report.rows[0].warnings).toContain(warning);
    expect(report.warnings).toContain('bpjs:1_EMPLOYEES_WITH_MISSING_IDENTIFIERS');
  });

  it('says so when the period has no approved payslips', async () => {
    const report = await service.build(COMPANY, PERIOD);
    expect(report.warnings).toContain('payroll:NO_APPROVED_PAYSLIPS_IN_PERIOD');
    expect(report.totals.grandTotal).toBe('0.00');
  });

  it('refuses a period outside the active company', async () => {
    state.period = null;
    await expect(service.build(COMPANY, PERIOD)).rejects.toThrow(/Payroll period not found/i);
  });

  /** Publishing the rates means a filing can be re-derived later. */
  it('publishes the rates and caps the figures were computed with', async () => {
    const report = await service.build(COMPANY, PERIOD);
    expect(report.config).toMatchObject({ jhtEmployeePercent: 2, jpWageCap: 10_547_400, jknWageCap: 12_000_000 });
  });
});

describe('BPJS report CSV', () => {
  it('lays out both sides per employee and closes with a total row', async () => {
    state.payslips = [payslipRow()];
    const csv = bpjsReportToCsv(await service.build(COMPANY, PERIOD));
    const lines = csv.split('\n');

    expect(lines[0]).toContain('JKK Perusahaan');
    expect(lines[1]).toContain('EMP001');
    expect(lines[1]).toContain('1424000.00');
    expect(lines.at(-1)).toContain('TOTAL');
  });

  it('quotes a name containing a comma so the columns do not shift', async () => {
    state.payslips = [payslipRow({}, { fullName: 'Putri, Maya' })];
    const csv = bpjsReportToCsv(await service.build(COMPANY, PERIOD));
    expect(csv).toContain('"Putri, Maya"');
  });
});
