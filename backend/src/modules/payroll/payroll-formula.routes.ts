import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { Result } from '@/shared/core/Result';
import { payrollFormulaService, FormulaContext } from './payroll-formula.service';
import { auditLog } from '@/shared/middleware/AuditLog';
import { formulaComponentParams, formulaVersionParams, formulaDraftSchema, formulaPreviewSchema } from './payroll-formula.dto';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.use(authenticate, requireCompanyAccess());
// Reviewers need to simulate without receiving permission to edit components.
const authorizeSimulation = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  authorize({ resource: 'payroll', action: req.user?.permissions?.includes('payroll:approve') ? 'approve' : 'update' })(req, res, next);
function context(req: AuthenticatedRequest): FormulaContext {
  if (!req.company?.id || !req.user?.id) throw new ForbiddenError('Validated company and actor are required');
  return { companyId: req.company.id, actorId: req.user.id, ipAddress: req.ip,
    requestId: String(req.res?.getHeader('X-Request-Id') ?? '').slice(0, 100) || undefined };
}
function respond(work: (req: AuthenticatedRequest) => Promise<unknown>) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json(Result.success(await work(req))); } catch (error) { next(error); }
  };
}
router.get('/:componentId/versions', authorize({ resource: 'payroll', action: 'read' }), validate(formulaComponentParams, 'params'),
  respond(req => payrollFormulaService.list(context(req), req.params.componentId as string)));
router.post('/:componentId/versions', authorize({ resource: 'payroll', action: 'update' }), validate(formulaComponentParams, 'params'), validate(formulaDraftSchema),
  respond(req => payrollFormulaService.createDraft(context(req), req.params.componentId as string, req.body)));
router.post('/:componentId/versions/:versionId/preview', authorizeSimulation, validate(formulaVersionParams, 'params'), validate(formulaPreviewSchema),
  respond(req => payrollFormulaService.preview(context(req), req.params.componentId as string, req.params.versionId as string, req.body)));
router.post('/:componentId/versions/:versionId/publish', authorize({ resource: 'payroll', action: 'approve' }), auditLog({ action: 'PUBLISH_PAYROLL_FORMULA', entity: 'PayrollFormulaVersion', getEntityId: (req) => req.params.versionId as string }), validate(formulaVersionParams, 'params'),
  respond(req => payrollFormulaService.publish(context(req), req.params.componentId as string, req.params.versionId as string)));
export default router;
