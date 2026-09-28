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
import { employeeAccessWhere } from './employee-data-scope';

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
