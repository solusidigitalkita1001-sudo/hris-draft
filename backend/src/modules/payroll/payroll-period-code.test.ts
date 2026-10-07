jest.mock('@/shared/database/prisma', () => {
  const client = { payrollPeriod: { findFirst: jest.fn(async () => null) } };
  return { __esModule: true, default: client, prisma: client };
});

import { prisma } from '@/shared/database/prisma';
import { PayrollRepository } from './payroll.repository';

const repository = new PayrollRepository();
const findFirst = prisma.payrollPeriod.findFirst as unknown as jest.Mock;

describe('payroll period code lookup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is scoped to one company', async () => {
    await repository.findPayrollPeriodByCode('company-1', 'P202606');

    expect(findFirst).toHaveBeenCalledWith({ where: { companyId: 'company-1', code: 'P202606' } });
  });

  it('counts a soft-deleted period as still holding its code', async () => {
    // The unique index does not know about deletedAt, so filtering soft-deleted
    // rows out here would let the conflict check pass and the insert fail --
    // a 500 where the caller should have seen a 409.
    await repository.findPayrollPeriodByCode('company-1', 'P202606');

    const where = findFirst.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).not.toHaveProperty('deletedAt');
  });
});
