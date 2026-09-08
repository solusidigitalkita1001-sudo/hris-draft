jest.mock('@/modules/administration/administration.service', () => ({ administrationService: {
  findMyDataScopeByUser: jest.fn(), resolveEmployeeFilterForCurrentUser: jest.fn(),
} }));
import { Response } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import { requireCompanyAccess } from './CompanyScope';
import { administrationService } from '@/modules/administration/administration.service';
import { ForbiddenError } from '@/shared/exceptions/AppError';
const lookup = jest.mocked(administrationService.findMyDataScopeByUser);
const resolve = jest.mocked(administrationService.resolveEmployeeFilterForCurrentUser);
describe('scope middleware failure propagation', () => {
  beforeEach(() => jest.resetAllMocks());
  it.each(['GET', 'POST', 'PATCH', 'DELETE'])('blocks %s on scope lookup failure', async (method) => {
    lookup.mockRejectedValue(new Error('database unavailable'));
    const next = jest.fn();
    await requireCompanyAccess()({ method, originalUrl: '/api/employees/other',
      user: { id: 'u', email: 'u@example.com', roles: ['MANAGER'], companyId: 'A' }, params: { id: 'other' }, query: {}, body: {},
    } as unknown as AuthenticatedRequest, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
  it('propagates manager hierarchy denial for forged employee IDs', async () => {
    lookup.mockResolvedValue({ scopeType: 'MANAGER_TEAM' } as Awaited<ReturnType<typeof lookup>>);
    resolve.mockImplementation(() => { throw new ForbiddenError('Hierarchy unavailable'); });
    const next = jest.fn();
    await requireCompanyAccess()({ originalUrl: '/api/payroll',
      user: { id: 'u', email: 'u@example.com', roles: ['MANAGER'], companyId: 'A' }, params: {}, query: { employeeId: 'forged' }, body: {},
    } as unknown as AuthenticatedRequest, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

it('looks up the employee resource under the configured versioned API prefix', async () => {
  lookup.mockResolvedValue(null);
  const next = jest.fn();
  await requireCompanyAccess()({ originalUrl: '/api/v1/employees?search=x',
    user: { id: 'u', email: 'u@example.com', roles: ['MANAGER'], companyId: 'A' }, params: {}, query: {}, body: {},
  } as unknown as AuthenticatedRequest, {} as Response, next);
  expect(lookup).toHaveBeenLastCalledWith('A', expect.any(Object), 'employee');
});

it('propagates only a validated company selection into database context', async () => {
  const { getCurrentCompanyId } = await import('@/shared/context/RequestContext');
  lookup.mockResolvedValue(null);
  const next = jest.fn(() => { expect(getCurrentCompanyId()).toBe('B'); });
  await requireCompanyAccess()({ originalUrl: '/api/v1/employees',
    user: { id: 'u', email: 'u@example.com', roles: ['HR_MANAGER'], companyId: 'A', companyScope: ['A', 'B'] },
    params: {}, query: { companyId: 'B' }, body: {},
  } as unknown as AuthenticatedRequest, {} as Response, next);
  expect(next).toHaveBeenCalledWith();
});
