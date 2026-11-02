jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  default: { employee: { findFirst: jest.fn() } },
  prisma: { employee: { findFirst: jest.fn() } },
}));
jest.mock('@/modules/administration/administration.service', () => ({
  administrationService: {
    findMyDataScopeByUser: jest.fn().mockResolvedValue(null),
    resolveEmployeeFilterForCurrentUser: jest.fn().mockReturnValue({}),
  },
}));

import { runInRequestContext } from '@/shared/context/RequestContext';
import { employeeAccessWhere, profileSalaryAccessWhere } from './employee-data-scope';

describe('employee data scope — mandatory active company (#9 option 1)', () => {
  it('denies SUPER_ADMIN when no company is selected', async () => {
    await expect(runInRequestContext({
      user: { id: 'sa', email: 'sa@example.com', roles: ['SUPER_ADMIN'] },
    }, () => employeeAccessWhere())).rejects.toThrow(/active company context/i);
  });

  it('scopes SUPER_ADMIN reads after an explicit company selection', async () => {
    await expect(runInRequestContext({
      user: { id: 'sa', email: 'sa@example.com', companyId: 'company-B', roles: ['SUPER_ADMIN'] },
    }, () => employeeAccessWhere())).resolves.toEqual({ companyId: 'company-B' });
  });
});

/**
 * `payroll:read` is no longer seeded for EMPLOYEE (it is what let every
 * employee read every colleague's salary), so the one salary an employee is
 * entitled to — their own — must not hang off that permission.
 */
describe('nested profile salary: own record needs no payroll permission', () => {
  const employee = { id: 'u', email: 'u@example.com', companyId: 'company-A', employeeId: 'e1', roles: ['EMPLOYEE'], permissions: ['employee:read'] };
  const own = { companyId: 'company-A', employeeId: 'e1', employee: { deletedAt: null } };

  it('returns an own-record predicate for an employee holding no payroll permission', async () => {
    await expect(runInRequestContext({ user: employee }, () => profileSalaryAccessWhere())).resolves.toEqual(own);
  });

  it('still denies an account not linked to an employee', async () => {
    await expect(runInRequestContext({ user: { ...employee, employeeId: undefined } }, () => profileSalaryAccessWhere()))
      .resolves.toEqual({ id: { in: [] } });
  });

  it('unions the own record with the payroll scope for a permitted reader', async () => {
    await expect(runInRequestContext({ user: { ...employee, permissions: ['payroll:read'] } }, () => profileSalaryAccessWhere()))
      .resolves.toEqual({ OR: [own, { companyId: 'company-A', employee: { deletedAt: null, AND: [{ companyId: 'company-A' }] } }] });
  });
});
