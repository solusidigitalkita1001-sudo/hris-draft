import { SeverancePaymentStatus } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  resignation: Row | null;
  existing: Row | null;
  created: Row[];
  updated: Array<{ where: Row; data: Row }>;
  updates: Array<{ where: Row; data: Row }>;
  updateCount: number;
  figures: Row;
} = {
  resignation: null, existing: null, created: [], updated: [], updates: [], updateCount: 1,
  figures: {},
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    resignation: { findFirst: jest.fn(async () => state.resignation) },
    severancePayment: {
      findFirst: jest.fn(async () => state.existing),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'severance-1', ...data };
        state.created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updated.push({ where, data });
        return { id: where.id, ...data };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { count: state.updateCount };
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => ({ id: 'user-hr' }) }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));
jest.mock('@/modules/onboarding/onboarding.service', () => ({
  onboardingService: { calculateFinalPayroll: jest.fn(async () => state.figures) },
}));

import { payrollSeveranceService } from './payroll-severance.service';
import { onboardingService } from '@/modules/onboarding/onboarding.service';

const COMPANY = 'company-a';

beforeEach(() => {
  jest.clearAllMocks();
  state.resignation = { id: 'resignation-1', status: 'APPROVED', employeeId: 'employee-1' };
  state.existing = null;
  state.created = []; state.updated = []; state.updates = [];
  state.updateCount = 1;
  state.figures = {
    total: 36_000_000, tax: 1_800_000, netTotal: 34_200_000,
    tenureYears: 6.2, severanceMonths: 7, longServiceMonths: 3,
    severancePay: 28_000_000, longServicePay: 6_000_000,
    leaveCompensation: 2_000_000, compensationOfRights: 0,
    monthlyWage: 4_000_000, unusedLeaveDays: 11, cumulativeGross: 36_000_000, taxIsFinal: true,
  };
});

describe('registering a severance payment', () => {
  it('freezes gross, final tax and net from calculateFinalPayroll, with the working in basis', async () => {
    await payrollSeveranceService.register(COMPANY, {
      resignationId: 'resignation-1', reason: 'TERMINATION',
    } as never);

    expect(onboardingService.calculateFinalPayroll).toHaveBeenCalledWith('resignation-1', { reason: 'TERMINATION' });
    const created = state.created[0];
    expect(String(created.grossAmount)).toBe('36000000');
    expect(String(created.taxAmount)).toBe('1800000');
    expect(String(created.netAmount)).toBe('34200000');
    expect(created.registeredBy).toBe('user-hr');
    expect(created.basis).toMatchObject({ reason: 'TERMINATION', taxIsFinal: true, severanceMonths: 7 });
  });

  it('refuses a resignation that is not approved yet', async () => {
    state.resignation = { id: 'resignation-1', status: 'SUBMITTED', employeeId: 'employee-1' };
    await expect(payrollSeveranceService.register(COMPANY, { resignationId: 'resignation-1' } as never))
      .rejects.toThrow(/approved exit/i);
  });

  it('404s a resignation outside the active company', async () => {
    state.resignation = null;
    await expect(payrollSeveranceService.register(COMPANY, { resignationId: 'resignation-1' } as never))
      .rejects.toThrow(/not found/i);
  });

  it('refuses a second registration while one is PENDING or APPLIED', async () => {
    for (const status of [SeverancePaymentStatus.PENDING, SeverancePaymentStatus.APPLIED]) {
      state.existing = { id: 'severance-existing', status };
      await expect(payrollSeveranceService.register(COMPANY, { resignationId: 'resignation-1' } as never))
        .rejects.toThrow(new RegExp(`already exists \\(${status}\\)`));
    }
  });

  it('revives a CANCELLED row with fresh figures instead of duplicating it', async () => {
    state.existing = { id: 'severance-cancelled', status: SeverancePaymentStatus.CANCELLED };

    await payrollSeveranceService.register(COMPANY, { resignationId: 'resignation-1' } as never);

    expect(state.created).toHaveLength(0);
    expect(state.updated[0].where).toMatchObject({ id: 'severance-cancelled' });
    expect(state.updated[0].data).toMatchObject({ status: SeverancePaymentStatus.PENDING, appliedRunId: null, payslipId: null });
  });

  it('refuses a calculation that pays nothing', async () => {
    state.figures = { ...state.figures, total: 0, tax: 0, netTotal: 0 };
    await expect(payrollSeveranceService.register(COMPANY, { resignationId: 'resignation-1' } as never))
      .rejects.toThrow(/nothing to pay/i);
  });
});

describe('cancel and claim races', () => {
  it('cancels a pending payment', async () => {
    state.existing = { id: 'severance-1', status: SeverancePaymentStatus.PENDING };
    await expect(payrollSeveranceService.cancel(COMPANY, 'severance-1')).resolves.toMatchObject({
      status: SeverancePaymentStatus.CANCELLED,
    });
  });

  it('refuses to cancel an applied payment', async () => {
    state.existing = { id: 'severance-1', status: SeverancePaymentStatus.APPLIED };
    await expect(payrollSeveranceService.cancel(COMPANY, 'severance-1')).rejects.toThrow(/Only pending/i);
  });

  it('refuses to cancel a row a run claimed mid-cancellation', async () => {
    state.existing = { id: 'severance-1', status: SeverancePaymentStatus.PENDING };
    state.updateCount = 0;
    await expect(payrollSeveranceService.cancel(COMPANY, 'severance-1')).rejects.toThrow(/claimed by a payroll run/i);
  });

  it('markApplied writes the trace conditionally on PENDING and fails on a lost race', async () => {
    await payrollSeveranceService.markApplied(COMPANY, 'run-sev', [{ severancePaymentId: 'severance-1', payslipId: 'payslip-1' }]);
    expect(state.updates[0].where).toMatchObject({ id: 'severance-1', companyId: COMPANY, status: SeverancePaymentStatus.PENDING });
    expect(state.updates[0].data).toMatchObject({ status: SeverancePaymentStatus.APPLIED, payslipId: 'payslip-1', appliedRunId: 'run-sev' });

    state.updateCount = 0;
    await expect(
      payrollSeveranceService.markApplied(COMPANY, 'run-sev', [{ severancePaymentId: 'severance-1', payslipId: 'payslip-1' }]),
    ).rejects.toThrow(/changed while this payroll run was calculating/i);
  });
});
