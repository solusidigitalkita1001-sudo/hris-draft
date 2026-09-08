jest.mock('./administration.repository', () => ({ administrationRepository: { findMyDataScopeByUser: jest.fn() } }));
import { AdministrationService } from './administration.service';
import { administrationRepository } from './administration.repository';
import { ForbiddenError } from '@/shared/exceptions/AppError';
const service = new AdministrationService();
const user = { id: 'u', companyId: 'A', employeeId: 'e', roles: ['MANAGER'] };
describe('data scope fail-closed', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each(['employee', 'attendance', 'payroll', 'leave', 'ALL'])('denies unavailable hierarchy for %s', (resource) => {
    expect(() => service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM' }, user, resource)).toThrow(ForbiddenError);
  });
  it('rejects self scope without employee identity', () => {
    expect(() => service.resolveEmployeeFilterForCurrentUser({ scopeType: 'EMPLOYEE_SELF' }, { ...user, employeeId: undefined })).toThrow(ForbiddenError);
  });
  it.each(['BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY'])('rejects invalid %s', (scopeType) => {
    for (const scopeValue of [undefined, '', ' , ', 'invalid']) {
      expect(() => service.resolveEmployeeFilterForCurrentUser({ scopeType, scopeValue }, user)).toThrow();
    }
  });
  it('rejects unknown scopes', () => {
    expect(() => service.resolveEmployeeFilterForCurrentUser({ scopeType: 'UNKNOWN' }, user)).toThrow(ForbiddenError);
  });
  it('preserves explicit self filtering', () => {
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'EMPLOYEE_SELF' }, user)).toEqual({ id: 'e' });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'EMPLOYEE_SELF' }, user, 'leave')).toEqual({ employeeId: 'e' });
  });
  it.each(['COMPANY_ADMIN', 'GROUP_ADMIN', 'MANAGER'])('denies cross-company lookup for %s', async (role) => {
    await expect(service.findMyDataScopeByUser('B', { ...user, roles: [role] })).rejects.toThrow(ForbiddenError);
    expect(administrationRepository.findMyDataScopeByUser).not.toHaveBeenCalled();
  });
  it('allows explicitly assigned companies', async () => {
    await service.findMyDataScopeByUser('B', { ...user, companyScope: ['A', 'B'] });
    expect(administrationRepository.findMyDataScopeByUser).toHaveBeenCalledWith('B', ['MANAGER'], 'ALL');
  });
});
