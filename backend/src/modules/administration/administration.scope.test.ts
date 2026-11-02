jest.mock('./administration.repository', () => ({ administrationRepository: { findMyDataScopeByUser: jest.fn() } }));
jest.mock('@/shared/security/manager-team', () => ({ resolveManagedEmployeeIds: jest.fn().mockResolvedValue([]) }));
import { AdministrationService, COMPANY_WIDE_DEFAULT_ROLES } from './administration.service';
import { administrationRepository } from './administration.repository';
import { resolveManagedEmployeeIds } from '@/shared/security/manager-team';
import { ForbiddenError } from '@/shared/exceptions/AppError';
const service = new AdministrationService();
const user = { id: 'u', companyId: 'A', employeeId: 'e', roles: ['MANAGER'] };
describe('data scope fail-closed', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each(['employee', 'attendance', 'payroll', 'leave', 'ALL'])('a configured MANAGER_TEAM row without an employee identity fails closed (throws) (%s)', (resource) => {
    expect(() => service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM' }, { ...user, employeeId: undefined }, resource)).toThrow(ForbiddenError);
  });
  it('keeps a manager who heads no unit on their own record instead of denying every read', () => {
    // A MANAGER_TEAM scope used to throw on an empty team, which took the
    // manager's own data with it — a manager not yet registered as a unit head
    // lost access to everything, their own records included.
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM' }, user)).toEqual({ id: { in: ['e'] } });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM' }, user, 'leave')).toEqual({ employeeId: { in: ['e'] } });
  });
  it('scopes a manager who heads a team to that team, and does not add themselves to it', () => {
    // Widening a configured team scope with the holder's own record would
    // widen every path it governs, writes included.
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM', teamEmployeeIds: ['t1'] }, user)).toEqual({ id: { in: ['t1'] } });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM', teamEmployeeIds: ['t1', 't1', 't2'] }, user)).toEqual({ id: { in: ['t1', 't2'] } });
  });
  it('MANAGER_TEAM scopes to the pre-resolved team ids', () => {
    const mgrTeam = { ...user, teamEmployeeIds: ['e', 't1', 't2'] };
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM' }, mgrTeam)).toEqual({ id: { in: ['e', 't1', 't2'] } });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'MANAGER_TEAM' }, mgrTeam, 'leave')).toEqual({ employeeId: { in: ['e', 't1', 't2'] } });
  });
  it('rejects a configured self scope without employee identity', () => {
    expect(() => service.resolveEmployeeFilterForCurrentUser({ scopeType: 'EMPLOYEE_SELF' }, { ...user, employeeId: undefined })).toThrow(ForbiddenError);
  });
  /**
   * `User.employeeId` is nullable and deleting an employee sets it to null, so
   * an ordinary account with no employee link is a real state. The computed
   * default governs every such account on every route the scope middleware
   * touches, and throwing there turned one broken link into a blanket 403
   * (CompanyScope turns the throw into "Unable to resolve data access scope").
   * It matches no record instead: just as closed, and the API keeps answering.
   */
  it.each(['EMPLOYEE_SELF', 'MANAGER_TEAM'])('matches no record, rather than denying, for a default %s scope with no employee link', (scopeType) => {
    const orphan = { ...user, employeeId: undefined };
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType, isDefault: true }, orphan)).toEqual({ id: { in: [] } });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType, isDefault: true }, orphan, 'leave')).toEqual({ employeeId: { in: [] } });
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

/**
 * S-H1: a role with no RoleDataScope row resolved to "no filter", which the
 * callers read as the whole company. No seed or migration ever wrote such a
 * row, so every employee held a company-wide predicate and could read every
 * colleague's salary. The absence of configuration now means "own record
 * only", except for the roles that exist to work across the company.
 */
describe('fail-closed default when no role of the requester has a configured scope row', () => {
  const configured = jest.mocked(administrationRepository.findMyDataScopeByUser);
  beforeEach(() => {
    jest.clearAllMocks();
    configured.mockResolvedValue(null);
    jest.mocked(resolveManagedEmployeeIds).mockResolvedValue([]);
  });
  const effective = (roles: string[]) => service.findMyDataScopeByUser('A', { ...user, roles });

  it.each([...COMPANY_WIDE_DEFAULT_ROLES])('keeps %s company-wide, alone and alongside EMPLOYEE', async (role) => {
    // Every privileged user also holds EMPLOYEE (05-test-data.seed.ts), so the
    // default must be read off the whole role set, not one role at a time.
    await expect(effective([role])).resolves.toBeNull();
    await expect(effective([role, 'EMPLOYEE'])).resolves.toBeNull();
    await expect(effective(['EMPLOYEE', role, 'MANAGER'])).resolves.toBeNull();
  });

  it.each([
    { roles: ['EMPLOYEE'] },
    { roles: ['A_ROLE_THIS_TENANT_INVENTED'] },
    { roles: [] as string[] },
  ])('confines $roles to their own record', async ({ roles }) => {
    await expect(effective(roles)).resolves.toMatchObject({ scopeType: 'EMPLOYEE_SELF' });
  });

  it.each([
    { roles: ['MANAGER'] },
    { roles: ['MANAGER', 'EMPLOYEE'] },
  ])('confines $roles to the team they head plus themselves', async ({ roles }) => {
    jest.mocked(resolveManagedEmployeeIds).mockResolvedValue(['t1']);
    const scope = await effective(roles);
    expect(scope).toMatchObject({ scopeType: 'MANAGER_TEAM', teamEmployeeIds: ['t1'] });
    expect(resolveManagedEmployeeIds).toHaveBeenCalledWith('A', 'e');
    expect(service.resolveEmployeeFilterForCurrentUser(scope, { ...user, roles })).toEqual({ id: { in: ['t1'] } });
  });

  it('falls back to the manager own record only when they head nobody', async () => {
    const scope = await effective(['MANAGER']);
    expect(scope).toMatchObject({ scopeType: 'MANAGER_TEAM', teamEmployeeIds: [] });
    expect(service.resolveEmployeeFilterForCurrentUser(scope, user)).toEqual({ id: { in: ['e'] } });
  });

  it('leaves a configured row exactly as the existing merge resolved it', async () => {
    configured.mockResolvedValue({ roleCode: 'EMPLOYEE', scopeType: 'BRANCH_ONLY', scopeValue: 'branch-1' } as never);
    await expect(effective(['EMPLOYEE'])).resolves.toMatchObject({ scopeType: 'BRANCH_ONLY', scopeValue: 'branch-1' });
  });

  it('pre-resolves the team for a configured MANAGER_TEAM row too, so the filter never needs a second lookup', async () => {
    configured.mockResolvedValue({ roleCode: 'MANAGER', scopeType: 'MANAGER_TEAM', scopeValue: null } as never);
    jest.mocked(resolveManagedEmployeeIds).mockResolvedValue(['t1', 't2']);
    await expect(effective(['MANAGER'])).resolves.toMatchObject({ teamEmployeeIds: ['t1', 't2'] });
  });
});

describe('dynamic OWN_* data scopes (follow the employee on transfer)', () => {
  const mgr = { id: 'u', companyId: 'A', employeeId: 'e', roles: ['MANAGER'], branchId: 'branch-2', departmentId: 'dept-9', subDepartmentId: 'sub-3' };
  it('resolves OWN_BRANCH to the requester current branch (employee resource → branchId)', () => {
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'OWN_BRANCH' }, mgr)).toEqual({ branchId: 'branch-2' });
  });
  it('resolves OWN_DEPARTMENT / OWN_SUB_DEPARTMENT dynamically', () => {
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'OWN_DEPARTMENT' }, mgr)).toEqual({ departmentId: 'dept-9' });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'OWN_SUB_DEPARTMENT' }, mgr)).toEqual({ subDepartmentId: 'sub-3' });
  });
  it('follows a transfer: a new branch id produces a new filter automatically', () => {
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'OWN_BRANCH' }, { ...mgr, branchId: 'branch-NEW' })).toEqual({ branchId: 'branch-NEW' });
  });
  it('fails closed (empty set) when the requester has no such org unit', () => {
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'OWN_BRANCH' }, { ...mgr, branchId: null })).toEqual({ id: { in: [] } });
    expect(service.resolveEmployeeFilterForCurrentUser({ scopeType: 'OWN_BRANCH' }, { ...mgr, branchId: null }, 'leave')).toEqual({ employeeId: { in: [] } });
  });
});
