import { employeeService } from './employee.service';
import { ConflictError } from '@/shared/exceptions/AppError';
import { employeeRepository } from './employee.repository';
import { prisma } from '@/shared/database/prisma';

jest.mock('./employee.repository', () => ({
  employeeRepository: {
    create: jest.fn(async (data: unknown) => data),
    findByEmployeeNumber: jest.fn(async () => null),
    findByEmail: jest.fn(async () => null),
  },
}));

jest.mock('@/shared/database/prisma', () => ({
  prisma: { employee: { findFirst: jest.fn(async () => null) } },
}));

jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const repo = employeeRepository as jest.Mocked<typeof employeeRepository>;
const findFirst = prisma.employee.findFirst as jest.Mock;

const payload = (over: Record<string, unknown> = {}) => ({
  companyId: 'company-1',
  firstName: 'Siti',
  lastName: 'Rahayu',
  employeeCategory: 'NON_FACTORY',
  employeeNumber: 'EMP-001',
  ...over,
}) as never;

beforeEach(() => {
  jest.clearAllMocks();
  repo.create.mockImplementation(async (data: unknown) => data as never);
  repo.findByEmployeeNumber.mockResolvedValue(null as never);
  repo.findByEmail.mockResolvedValue(null as never);
  findFirst.mockResolvedValue(null);
});

describe('email conflict on employee create', () => {
  it('accepts an email nobody holds', async () => {
    await employeeService.create(payload({ email: 'siti@example.test' }));

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'siti@example.test' }));
  });

  it('counts a soft-deleted employee as still holding its email', async () => {
    // Employee.email is unique across the installation and that index counts
    // soft-deleted rows. A check that filtered them out passed here and then
    // failed on the index -- 500 where the caller should have seen 409.
    repo.findByEmail.mockResolvedValue({ id: 'soft-deleted' } as never);

    await expect(employeeService.create(payload({ email: 'siti@example.test' })))
      .rejects.toThrow(ConflictError);
  });

  it('asks for exactly the email it was given', async () => {
    await employeeService.create(payload({ email: 'siti@example.test' }));

    expect(repo.findByEmail).toHaveBeenCalledWith('siti@example.test');
  });
});
