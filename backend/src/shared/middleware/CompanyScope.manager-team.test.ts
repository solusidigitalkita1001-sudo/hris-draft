jest.mock('./AuditLog', () => ({ createAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/modules/administration/administration.repository', () => ({
  administrationRepository: { findMyDataScopeByUser: jest.fn().mockResolvedValue(null) },
}));
jest.mock('@/shared/security/manager-team', () => ({ resolveManagedEmployeeIds: jest.fn().mockResolvedValue([]) }));

import { Response } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import { requireCompanyAccess } from './CompanyScope';
import { resolveManagedEmployeeIds } from '@/shared/security/manager-team';

/**
 * The scope injection in this middleware resolves OWN_* scopes but never the
 * MANAGER_TEAM one, so a MANAGER_TEAM scope reached the filter with no team
 * ids, threw, and was turned into "Unable to resolve data access scope" — a
 * 403 on every request the manager made, their own records included. Nothing
 * noticed because no RoleDataScope row existed anywhere; giving MANAGER a
 * fail-closed MANAGER_TEAM default would have made it everyone's problem.
 *
 * The team is now pre-resolved where the scope itself is resolved, so this
 * middleware, the payroll predicate and the private-file downloads all get
 * the same ids from one lookup.
 */
type Actor = NonNullable<AuthenticatedRequest['user']>;
const request = (user: Actor, query: Record<string, unknown> = {}) => ({
  originalUrl: '/api/employees', method: 'GET', user, params: {}, query, body: {},
}) as unknown as AuthenticatedRequest;

const manager: Actor = { id: 'u', email: 'u@example.com', roles: ['MANAGER', 'EMPLOYEE'], companyId: 'A', employeeId: 'e1' };

describe('MANAGER_TEAM scope injection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(resolveManagedEmployeeIds).mockResolvedValue([]);
  });

  /**
   * A team cannot be written into `employeeId`: every DTO validates it as a
   * single id, so the set would answer 422 — and the requester's own id would
   * hide the rest of the team, which is how a manager lost sight of the
   * attendance and leave they hold `att:approve` / `leave:approve` to decide.
   * The query is left alone and the team is enforced in full by the
   * server-side predicate those reads carry.
   */
  it('lets a manager through without narrowing the query to one employee', async () => {
    jest.mocked(resolveManagedEmployeeIds).mockResolvedValue(['t1', 't2']);
    const req = request(manager);
    const next = jest.fn();
    await requireCompanyAccess()(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(resolveManagedEmployeeIds).toHaveBeenCalledWith('A', 'e1');
    expect(req.query).toEqual({ companyId: 'A' });
  });

  it('lets a manager who heads no unit through as well', async () => {
    const req = request(manager);
    const next = jest.fn();
    await requireCompanyAccess()(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ companyId: 'A' });
  });

  it('still narrows an account with no employee link to nothing, rather than denying it', async () => {
    const req = request({ ...manager, roles: ['EMPLOYEE'], employeeId: undefined });
    const next = jest.fn();
    await requireCompanyAccess()(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ companyId: 'A' });
  });

  it('narrows an ordinary employee to their own id', async () => {
    const req = request({ ...manager, roles: ['EMPLOYEE'] });
    const next = jest.fn();
    await requireCompanyAccess()(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toMatchObject({ employeeId: 'e1' });
    expect(resolveManagedEmployeeIds).not.toHaveBeenCalled();
  });

  it('leaves an HR reader company-wide', async () => {
    const req = request({ ...manager, roles: ['HR_STAFF', 'EMPLOYEE'] });
    const next = jest.fn();
    await requireCompanyAccess()(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ companyId: 'A' });
  });
});
