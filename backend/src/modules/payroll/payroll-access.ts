import type { NextFunction, Request, Response } from 'express';
import { getCurrentCompanyId, getCurrentUser } from '@/shared/context/RequestContext';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { employeeAccessWhere } from '@/shared/security/employee-data-scope';

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
