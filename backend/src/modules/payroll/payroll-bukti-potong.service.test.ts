type Row = Record<string, unknown>;

const state: {
  period: Row | null;
  payslips: Row[];
  severance: Row | null;
  appliedRun: Row | null;
} = { period: null, payslips: [], severance: null, appliedRun: null };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    payrollPeriod: { findFirst: jest.fn(async () => state.period) },
    payslip: { findMany: jest.fn(async () => state.payslips) },
    severancePayment: { findFirst: jest.fn(async () => state.severance) },
    payrollRun: { findFirst: jest.fn(async () => state.appliedRun) },
  };
  return { __esModule: true, default: client, prisma: client };
});

import prisma from '@/shared/database/prisma';
import { monthlyToCsv, payrollBuktiPotongService } from './payroll-bukti-potong.service';

const COMPANY = 'company-a';
const payslipFindMany = (prisma as unknown as { payslip: { findMany: jest.Mock } }).payslip.findMany;

function employee(id: string, over: Row = {}) {
  return { id, fullName: `Employee ${id}`, employeeNumber: `EMP-${id}`, taxId: '12.345', address: 'Jl. Contoh 1', ...over };
}
const taxable = (amount: number) => ({ type: 'ALLOWANCE', amount, isTaxable: true, salaryComponent: { code: 'BASE' } });
const pph = (amount: number) => ({ type: 'DEDUCTION', amount, isTaxable: false, salaryComponent: { code: 'PPH21' } });

beforeEach(() => {
  jest.clearAllMocks();
  state.period = { id: 'period-mar', code: 'PR-2026-03', name: 'Maret 2026', startDate: new Date('2026-03-01T00:00:00Z') };
  state.payslips = [];
  state.severance = null;
  state.appliedRun = { id: 'run-severance', status: 'APPROVED' };
});

describe('1721-VIII per periode', () => {
  it('merges an employee\'s payslips across runs of the period and derives the applied rate', async () => {
    state.payslips = [
      { employeeId: 'e1', employee: employee('e1'), components: [taxable(8_000_000), pph(200_000)] },
      // Koreksi di periode yang sama: bruto dan PPh-nya milik masa itu juga.
      { employeeId: 'e1', employee: employee('e1'), components: [taxable(2_000_000), pph(50_000)] },
      { employeeId: 'e2', employee: employee('e2', { taxId: null }), components: [taxable(5_000_000)] },
    ];

    const result = await payrollBuktiPotongService.monthly(COMPANY, 'period-mar');

    expect(result.taxMonth).toBe(3);
    expect(result.rows).toHaveLength(2);
    const first = result.rows[0];
    expect(first.form.bruto).toBe(10_000_000);
    expect(first.form.pphDipotong).toBe(250_000);
    expect(first.form.tarifPercent).toBe(2.5);
    expect(first.form.masaPajak).toBe('03-2026');
    // Tanpa NPWP: kolom (4) disilang, NIK diisi manusia di e-Bupot.
    expect(result.rows[1].form.tanpaNpwp).toBe(true);
  });

  it('only counts APPROVED/DISBURSED non-severance runs, and skips zero rows', async () => {
    state.payslips = [
      { employeeId: 'e1', employee: employee('e1'), components: [{ type: 'ALLOWANCE', amount: 1_000_000, isTaxable: false, salaryComponent: { code: 'X' } }] },
    ];
    const result = await payrollBuktiPotongService.monthly(COMPANY, 'period-mar');
    expect(result.rows).toHaveLength(0);

    const where = payslipFindMany.mock.calls[0][0].where;
    expect(where.payrollRun.status).toEqual({ in: ['APPROVED', 'DISBURSED'] });
    expect(where.payrollRun.runType).toEqual({ in: ['REGULAR', 'THR', 'CORRECTION'] });
  });

  it('404s a period outside the active company, and renders the reconciliation CSV', async () => {
    state.period = null;
    await expect(payrollBuktiPotongService.monthly(COMPANY, 'period-x')).rejects.toThrow(/not found/i);

    state.period = { id: 'period-mar', code: 'PR-2026-03', name: 'Maret 2026', startDate: new Date('2026-03-01T00:00:00Z') };
    state.payslips = [{ employeeId: 'e1', employee: employee('e1'), components: [taxable(8_000_000), pph(200_000)] }];
    const csv = monthlyToCsv(await payrollBuktiPotongService.monthly(COMPANY, 'period-mar'));
    expect(csv.split('\n')[0]).toContain('kodeObjek;bruto;dpp');
    expect(csv).toContain('EMP-e1;Employee e1;12.345;;03-2026;21-100-01;8000000;8000000;;2.5;200000');
  });
});

describe('1721-VII pesangon', () => {
  it('builds from the frozen APPLIED payment, cumulative gross driving the top rate', async () => {
    state.severance = {
      id: 'severance-1', resignationId: 'resignation-1', status: 'APPLIED',
      appliedRunId: 'run-severance',
      appliedAt: new Date('2026-10-31T00:00:00Z'),
      grossAmount: '60000000', taxAmount: '2000000',
      basis: { cumulativeGross: 120_000_000 },
      employee: employee('e1'),
    };

    const result = await payrollBuktiPotongService.finalSeverance(COMPANY, 'severance-1');

    expect(result.form.taxObjectCode).toBe('21-401-01');
    expect(result.form.bruto).toBe(60_000_000);
    expect(result.form.pphDipotong).toBe(2_000_000);
    expect(result.form.tarifPercent).toBe(15);
    expect(result.form.masaPajak).toBe('10-2026');
  });

  it('refuses a payment that has not been paid by a run yet', async () => {
    state.severance = { id: 'severance-1', status: 'PENDING', appliedAt: null, employee: employee('e1') };
    await expect(payrollBuktiPotongService.finalSeverance(COMPANY, 'severance-1'))
      .rejects.toThrow(/masih PENDING/);
  });

  // APPLIED terjadi saat kalkulasi, saat run masih COMPLETED dan bisa
  // di-void — bukti potong final menunggu run-nya APPROVED/DISBURSED,
  // gerbang yang sama dengan 1721-VIII bulanan.
  it('refuses while the paying run is still COMPLETED (voidable)', async () => {
    state.severance = {
      id: 'severance-1', resignationId: 'resignation-1', status: 'APPLIED',
      appliedRunId: 'run-severance', appliedAt: new Date('2026-10-31T00:00:00Z'),
      grossAmount: '60000000', taxAmount: '2000000', basis: {}, employee: employee('e1'),
    };
    state.appliedRun = { id: 'run-severance', status: 'COMPLETED' };
    await expect(payrollBuktiPotongService.finalSeverance(COMPANY, 'severance-1'))
      .rejects.toThrow(/belum di-approve/);
  });
});
