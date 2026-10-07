jest.mock('@/shared/database/prisma', () => {
  const client = { employee: { findFirst: jest.fn(async () => null) } };
  return { __esModule: true, default: client, prisma: client };
});

import { prisma } from '@/shared/database/prisma';
import { EmployeeRepository } from './employee.repository';

const repository = new EmployeeRepository();
const findFirst = prisma.employee.findFirst as unknown as jest.Mock;

describe('employee email lookup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not filter deletedAt, because the unique index does not either', () => {
    repository.findByEmail('siti@example.test');

    const where = findFirst.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toEqual({ email: 'siti@example.test' });
    expect(where).not.toHaveProperty('deletedAt');
  });
});
