import { Prisma } from '@prisma/client';
import { ConflictError } from '@/shared/exceptions/AppError';

let transactionMock: jest.Mock;
jest.mock('@/shared/database/prisma', () => {
  transactionMock = jest.fn();
  const client = { $transaction: transactionMock };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('@/shared/security/employee-data-scope', () => ({
  employeeAccessWhere: jest.fn(async () => ({})),
}));
jest.mock('@/shared/context/RequestContext', () => ({
  getCurrentCompanyId: () => 'company-a',
  getCurrentUser: () => ({ id: 'actor', roles: ['HR_MANAGER'], permissions: ['payroll:read', 'payroll:update'] }),
  isSystemContext: () => false,
  runInSystemContext: (_reason: string, work: () => unknown) => work(),
}));

import { employeeSalaryService } from './employee-salary.service';

/**
 * Serializable isolation plus a company row lock still loses races. The loser
 * used to receive the raw driver error, which the HTTP boundary turned into a
 * 500 — the real-database suite caught exactly that under CI contention. A
 * concurrent edit is a conflict the client may retry, so it must be a 409.
 */
const writeConflict = () => new Prisma.PrismaClientKnownRequestError('write conflict', {
  code: 'P2034', clientVersion: '5.0.0',
});

const input = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  baseSalary: 1000,
  effectiveDate: '2026-10-01T00:00:00Z',
};

describe('salary allocation under contention', () => {
  beforeEach(() => transactionMock.mockReset());

  it('retries a write conflict twice, then reports a retryable conflict', async () => {
    transactionMock.mockRejectedValue(writeConflict());

    await expect(employeeSalaryService.create(input as never)).rejects.toBeInstanceOf(ConflictError);
    await expect(employeeSalaryService.create(input as never)).rejects.toMatchObject({ statusCode: 409 });
    // Three attempts per call: the initial one plus two retries.
    expect(transactionMock).toHaveBeenCalledTimes(6);
  });

  it('succeeds when a retry wins the race', async () => {
    transactionMock
      .mockRejectedValueOnce(writeConflict())
      .mockResolvedValueOnce({ id: 'salary-1' });

    await expect(employeeSalaryService.create(input as never)).resolves.toEqual({ id: 'salary-1' });
    expect(transactionMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['lock wait timeout', new Prisma.PrismaClientUnknownRequestError('Lock wait timeout exceeded', { clientVersion: '5.0.0' })],
    ['deadlock', new Prisma.PrismaClientUnknownRequestError('Deadlock found when trying to get lock', { clientVersion: '5.0.0' })],
  ])('treats a %s as the same conflict', async (_label, error) => {
    transactionMock.mockRejectedValue(error);
    await expect(employeeSalaryService.create(input as never)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('leaves an unrelated failure untouched', async () => {
    transactionMock.mockRejectedValue(new Error('Disk on fire'));

    await expect(employeeSalaryService.create(input as never)).rejects.toThrow('Disk on fire');
    // No retry for a failure that is not a race.
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
