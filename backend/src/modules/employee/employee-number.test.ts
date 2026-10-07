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

/**
 * assertOrgUnitsInCompany only queries for the org unit ids it is given, so an
 * employee with none of them set reaches the numbering logic without any other
 * database access. That keeps this about the number and nothing else.
 */
const payload = (over: Record<string, unknown> = {}) => ({
  companyId: 'company-1',
  firstName: 'Siti',
  lastName: 'Rahayu',
  employeeCategory: 'NON_FACTORY',
  ...over,
}) as never;

beforeEach(() => {
  jest.clearAllMocks();
  repo.create.mockImplementation(async (data: unknown) => data as never);
  repo.findByEmployeeNumber.mockResolvedValue(null as never);
  findFirst.mockResolvedValue(null);
});

describe('employee number on create', () => {
  it('keeps the number the customer brought from its previous payroll', async () => {
    await employeeService.create(payload({ employeeNumber: 'EMP-001' }));

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ employeeNumber: 'EMP-001' }));
  });

  it('still generates one when none is given', async () => {
    await employeeService.create(payload());

    const saved = repo.create.mock.calls[0][0] as { employeeNumber: string };
    expect(saved.employeeNumber).toMatch(/^EMP-/);
  });

  it('refuses a number already taken inside the same company', async () => {
    findFirst.mockResolvedValue({ id: 'someone-else' });

    await expect(employeeService.create(payload({ employeeNumber: 'EMP-001' })))
      .rejects.toThrow(ConflictError);
  });

  it('counts a soft-deleted employee as still holding its number', async () => {
    // The unique index does not know about deletedAt, so a check that filtered
    // soft-deleted rows out would pass here and then fail on the database.
    findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      expect(where).not.toHaveProperty('deletedAt');
      return { id: 'soft-deleted' };
    });

    await expect(employeeService.create(payload({ employeeNumber: 'EMP-001' })))
      .rejects.toThrow(ConflictError);
  });

  it('lets a second company reuse a number the first company holds', async () => {
    // What the migration to @@unique([companyId, employeeNumber]) buys: the
    // lookup is scoped by company, so company-2 is free to use EMP-001 too.
    findFirst.mockImplementation(async ({ where }: { where: { companyId: string } }) =>
      (where.companyId === 'company-1' ? { id: 'first-tenant' } : null));

    await employeeService.create(payload({ companyId: 'company-2', employeeNumber: 'EMP-001' }));

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-2',
      employeeNumber: 'EMP-001',
    }));
  });

  it('generates a number when the field is sent blank', async () => {
    const saved = await employeeService.create(payload({ employeeNumber: '   ' }))
      .then(() => repo.create.mock.calls[0][0] as { employeeNumber: string });

    expect(saved.employeeNumber).toMatch(/^EMP-/);
  });
});
