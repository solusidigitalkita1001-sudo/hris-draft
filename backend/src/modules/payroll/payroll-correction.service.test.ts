import { Prisma, PayrollCorrectionStatus } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  payslip: Row | null;
  corrections: Row[];
  created: Row[];
  updates: Array<{ where: Row; data: Row }>;
  updateCount: number;
} = { payslip: null, corrections: [], created: [], updates: [], updateCount: 1 };

jest.mock('@/shared/database/prisma', () => {
  const client: Record<string, unknown> = {
    // Kunci baris payslip di register: ada payslip → [{id}], tidak → [].
    $queryRaw: jest.fn(async () => (state.payslip ? [{ id: (state.payslip as Row).id }] : [])),
    payslip: { findFirst: jest.fn(async () => state.payslip) },
    payrollCorrection: {
      findFirst: jest.fn(async () => state.corrections[0] ?? null),
      findMany: jest.fn(async () => state.corrections),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'correction-1', status: PayrollCorrectionStatus.PENDING, ...data };
        state.created.push(row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { count: state.updateCount };
      }),
    },
  };
  client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => ({ id: 'user-hr' }) }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { payrollCorrectionService } from './payroll-correction.service';

const COMPANY = 'company-a';

/** A paid payslip: FINAL, on a DISBURSED run. The case corrections exist for. */
function paidPayslip(over: Row = {}) {
  return {
    id: 'payslip-paid',
    employeeId: 'employee-1',
    status: 'FINAL',
    payrollRun: { id: 'run-old', status: 'DISBURSED', periodId: 'period-aug' },
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.payslip = paidPayslip();
  state.corrections = [];
  state.created = [];
  state.updates = [];
  state.updateCount = 1;
});

describe('registering a correction', () => {
  it('registers against a paid payslip, remaining = amount, registrant recorded', async () => {
    await payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: -350000, reason: 'Tunjangan transport dobel di Agustus',
    });

    const created = state.created[0];
    expect(String(created.amount)).toBe('-350000');
    expect(String(created.remainingAmount)).toBe('-350000');
    expect(created.employeeId).toBe('employee-1');
    expect(created.registeredBy).toBe('user-hr');
  });

  it('accepts an APPROVED (not yet disbursed) run too', async () => {
    state.payslip = paidPayslip({ payrollRun: { id: 'run-old', status: 'APPROVED', periodId: 'period-aug' } });
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 100000, reason: 'Kurang bayar lembur Agustus',
    })).resolves.toBeDefined();
  });

  /** One problem, one path: before approval the remedy is void + recalculate. */
  it('redirects a COMPLETED run to void instead', async () => {
    state.payslip = paidPayslip({ payrollRun: { id: 'run-old', status: 'COMPLETED', periodId: 'period-aug' } });
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 100000, reason: 'Kurang bayar lembur Agustus',
    })).rejects.toThrow(/void/i);
    expect(state.created).toHaveLength(0);
  });

  it('refuses a DRAFT payslip', async () => {
    state.payslip = paidPayslip({ status: 'DRAFT' });
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 100000, reason: 'Kurang bayar lembur Agustus',
    })).rejects.toThrow(/void/i);
  });

  it('refuses a payslip on a VOIDED run', async () => {
    state.payslip = paidPayslip({ payrollRun: { id: 'run-old', status: 'VOIDED', periodId: 'period-aug' } });
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 100000, reason: 'Kurang bayar lembur Agustus',
    })).rejects.toThrow(/VOIDED/);
  });

  it('404s a payslip outside the active company', async () => {
    state.payslip = null;
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 100000, reason: 'Kurang bayar lembur Agustus',
    })).rejects.toThrow(/not found/i);
  });

  it('refuses an amount that rounds to zero at two decimals', async () => {
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 0.004, reason: 'Selisih pembulatan yang tidak berarti',
    })).rejects.toThrow(/membulat ke nol/);
    expect(state.created).toHaveLength(0);
  });

  /** A second correction of the same payslip waits until the first is APPLIED. */
  it('refuses while another PENDING correction exists for the payslip', async () => {
    state.corrections = [{ id: 'correction-existing', status: PayrollCorrectionStatus.PENDING }];
    await expect(payrollCorrectionService.register(COMPANY, {
      sourcePayslipId: 'payslip-paid', amount: 100000, reason: 'Kurang bayar lembur Agustus',
    })).rejects.toThrow(/pending correction already exists/i);
  });
});

describe('cancel and claim races', () => {
  it('cancels a pending correction', async () => {
    state.corrections = [{ id: 'correction-1', status: PayrollCorrectionStatus.PENDING }];
    await expect(payrollCorrectionService.cancel(COMPANY, 'correction-1')).resolves.toMatchObject({
      status: PayrollCorrectionStatus.CANCELLED,
    });
  });

  it('refuses to cancel an applied correction', async () => {
    state.corrections = [{ id: 'correction-1', status: PayrollCorrectionStatus.APPLIED }];
    await expect(payrollCorrectionService.cancel(COMPANY, 'correction-1')).rejects.toThrow(/Only pending/i);
  });

  it('refuses to cancel a row a run claimed mid-cancellation', async () => {
    state.corrections = [{ id: 'correction-1', status: PayrollCorrectionStatus.PENDING }];
    state.updateCount = 0;
    await expect(payrollCorrectionService.cancel(COMPANY, 'correction-1')).rejects.toThrow(/claimed by a payroll run/i);
  });

  it('markApplied writes the four trace columns conditionally on PENDING', async () => {
    await payrollCorrectionService.markApplied(COMPANY, 'run-corr', [{ correctionId: 'correction-1', payslipId: 'payslip-new' }]);
    expect(state.updates[0].where).toMatchObject({ id: 'correction-1', companyId: COMPANY, status: PayrollCorrectionStatus.PENDING });
    expect(state.updates[0].data).toMatchObject({
      status: PayrollCorrectionStatus.APPLIED, payslipId: 'payslip-new', appliedRunId: 'run-corr',
    });
    expect(String(state.updates[0].data.remainingAmount)).toBe('0');
    expect(state.updates[0].data.appliedAt).toBeInstanceOf(Date);
  });

  it('fails the run when a row was claimed elsewhere', async () => {
    state.updateCount = 0;
    await expect(
      payrollCorrectionService.markApplied(COMPANY, 'run-corr', [{ correctionId: 'correction-1', payslipId: 'payslip-new' }]),
    ).rejects.toThrow(/changed while this payroll run was calculating/i);
  });

  it('reduceRemaining shrinks the leftover and keeps the row PENDING', async () => {
    await payrollCorrectionService.reduceRemaining(COMPANY, [
      { correctionId: 'correction-1', remainingAmount: new Prisma.Decimal('-150000') },
    ]);
    expect(state.updates[0].where).toMatchObject({ status: PayrollCorrectionStatus.PENDING });
    expect(String(state.updates[0].data.remainingAmount)).toBe('-150000');
    expect(state.updates[0].data.status).toBeUndefined();
  });
});
