import type { NextFunction, Request, Response } from 'express';
import { getCurrentCompanyId, getCurrentUser } from '@/shared/context/RequestContext';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { employeeAccessWhere } from '@/shared/security/employee-data-scope';
import { tagPermissions } from '@/shared/openapi/route-metadata';

/** HTTP services must use the selected company and actor, never caller-supplied identities. */
export async function payrollAccess(requestedCompanyId?: string, requestedActorId?: string) {
  const actor = getCurrentUser();
  const companyId = getCurrentCompanyId();
  if (!actor || !companyId) throw new ForbiddenError('Payroll access requires an authenticated company context');
  if (requestedCompanyId && requestedCompanyId !== companyId) throw new ForbiddenError('Payroll company does not match the active company');
  if (requestedActorId && requestedActorId !== actor.id) throw new ForbiddenError('Payroll actor does not match the authenticated user');
  const employeeWhere = await employeeAccessWhere('payroll');
  return { companyId, actor, employeeWhere };
}

/** A run, attendance confirmation or payment batch acts on the entire company. */
export async function companyPayrollAccess(requestedCompanyId?: string, requestedActorId?: string) {
  const access = await payrollAccess(requestedCompanyId, requestedActorId);
  // Only the server resolver's unrestricted company predicate is accepted.
  // Any additional current or future employee restriction fails closed.
  if (Object.keys(access.employeeWhere).some(key => key !== 'companyId')) {
    throw new ForbiddenError('Company-wide payroll scope is required for payroll runs, periods and payments');
  }
  return access;
}

export function requireCompanyPayrollAccess(_req: Request, _res: Response, next: NextFunction): void {
  companyPayrollAccess().then(() => next(), next);
}

const PAYROLL_READ_PERMISSIONS = ['payroll:read', 'payroll:*'];

/**
 * A by-employee payroll read that the owner of the data may always perform.
 *
 * Reading somebody else's figures still takes `payroll:read` plus, for the
 * company-wide endpoints, the company-wide payroll scope — the ordinary
 * guards. Reading one's OWN annual tax recap, bukti potong or THR takes
 * neither, because the EMPLOYEE role no longer holds `payroll:read` (it
 * authorizes the whole company's payroll) and nobody needs a company-wide
 * permission to see their own tax figures. The identity compared here comes
 * from the session, never from the request.
 *
 * Named `authorize…` so the route-guard audit recognises it as a guard, and
 * tagged with the permission it demands of everyone else so the generated
 * OpenAPI document keeps stating `payroll:read`.
 */
export function authorizeSelfOrPayrollRead(options: { companyWide?: boolean } = {}) {
  const { companyWide = false } = options;
  return tagPermissions((req: Request, _res: Response, next: NextFunction): void => {
    const actor = getCurrentUser();
    if (actor?.employeeId && req.params.employeeId === actor.employeeId) {
      next();
      return;
    }
    const permitted = actor?.roles?.includes('SUPER_ADMIN')
      || actor?.permissions?.some(permission => PAYROLL_READ_PERMISSIONS.includes(permission));
    if (!permitted) {
      next(new ForbiddenError('Insufficient permissions. Required: payroll:read'));
      return;
    }
    if (!companyWide) {
      next();
      return;
    }
    companyPayrollAccess().then(() => next(), next);
  }, [{ resource: 'payroll', action: 'read' }]);
}
