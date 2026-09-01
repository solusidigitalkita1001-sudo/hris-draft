import { ewaService } from './ewa.service';
import { ewaRepository } from './ewa.repository';
import * as advisoryLock from '@/shared/database/advisory-lock';
import { runInRequestContext } from '@/shared/context/RequestContext';
import { BadRequestError } from '@/shared/exceptions/AppError';

describe('EWAService reservation enforcement', () => {
  const periodStart = new Date('2026-08-01T00:00:00.000Z');
  const periodEnd = new Date('2026-08-31T23:59:59.999Z');
  const user = {
    id: 'user-1',
    email: 'employee@example.com',
    employeeId: 'employee-1',
    companyId: 'company-1',
    companyScope: ['company-1'],
    roles: ['EMPLOYEE'],
  };

  beforeEach(() => {
    jest.spyOn(ewaService as any, 'resolvePeriod').mockResolvedValue({
      payrollPeriodId: null,
      periodStart,
      periodEnd,
    });
    jest.spyOn(ewaService, 'calculateEarnedGrossToDate').mockResolvedValue({
      earnedGrossToDate: 10_000_000,
      baseSalary: 10_000_000,
      presentDays: 22,
      workDaysInPeriod: 22,
      overtimePay: 0,
      dailyRate: 10_000_000 / 22,
    });
    jest.spyOn(advisoryLock, 'withDatabaseAdvisoryLock').mockImplementation(
      async (_namespace, _key, operation) => operation({} as any),
    );
    jest.spyOn(ewaRepository, 'findByRequestCode').mockResolvedValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  it('counts PENDING requests as reserved and blocks a second request over the limit', async () => {
    const findReserved = jest.spyOn(ewaRepository, 'findByEmployeePeriodStatus')
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ amountRequested: 4_000_000 }] as any);
    const create = jest.spyOn(ewaRepository, 'create').mockResolvedValue({ id: 'ewa-1' } as any);

    await runInRequestContext({ user }, () =>
      ewaService.createRequest({ amountRequested: 4_000_000, reason: 'first' } as any),
    );

    await expect(
      runInRequestContext({ user }, () =>
        ewaService.createRequest({ amountRequested: 2_000_000, reason: 'second' } as any),
      ),
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(findReserved).toHaveBeenCalledTimes(2);
    expect(findReserved.mock.calls[0]?.[4]).toEqual(['PENDING', 'APPROVED', 'PAID']);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('executes the reservation read and insert inside the same advisory-lock callback', async () => {
    const tx = { marker: 'transaction-client' } as any;
    const lock = jest.spyOn(advisoryLock, 'withDatabaseAdvisoryLock').mockImplementation(
      async (_namespace, _key, operation) => operation(tx),
    );
    const findReserved = jest.spyOn(ewaRepository, 'findByEmployeePeriodStatus').mockResolvedValue([] as any);
    const create = jest.spyOn(ewaRepository, 'create').mockResolvedValue({ id: 'ewa-1' } as any);

    await runInRequestContext({ user }, () =>
      ewaService.createRequest({ amountRequested: 1_000_000 } as any),
    );

    expect(lock).toHaveBeenCalledWith('ewa-limit', 'company-1:employee-1', expect.any(Function));
    expect(findReserved.mock.calls[0]?.[5]).toBe(tx);
    expect(create.mock.calls[0]?.[1]).toBe(tx);
  });
});
