import path from 'path';
import { resolvePrivatePath } from './private-path';
import { Router, Response } from 'express';
import prisma from '@/shared/database/prisma';
import config from '@/config';
import { AuthenticatedRequest, authenticate } from '@/shared/middleware/Authenticate';
import { authorize, authorizeRole } from '@/shared/middleware/Authorize';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { administrationService } from '@/modules/administration/administration.service';
import { ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';

async function employeeScope(req: AuthenticatedRequest, resource: string) {
  const user = req.user;
  const companyId = req.company?.id;
  if (!user || !companyId) throw new ForbiddenError('Company context is required');
  const scope = await administrationService.findMyDataScopeByUser(companyId, user, resource);
  const filter = administrationService.resolveEmployeeFilterForCurrentUser(scope, user, 'employee');
  return { ...filter, companyId };
}

function download(res: Response, file: string, name: string, next: (error?: unknown) => void) {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.download(file, name, error => { if (error) next(error); });
}

export const privateFilesRouter = Router();
privateFilesRouter.use(authenticate, requireCompanyAccess());
privateFilesRouter.get('/receipts/:id', authorizeRole('GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER', 'EMPLOYEE'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const employee = await employeeScope(req, 'travel');
    const user = req.user!;
    if (!user.employeeId) throw new ForbiddenError('Employee identity is required');
    const administersClaims = user.roles?.some(role => ['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF'].includes(role));
    const claim = await prisma.expenseClaim.findFirst({
      where: {
        id: req.params.id as string, companyId: req.company!.id, employee,
        OR: [
          { employeeId: user.employeeId }, { approvals: { some: { approverId: user.id } } },
          ...(administersClaims ? [{ companyId: req.company!.id }] : []),
        ],
      },
      select: { receiptFilePath: true },
    });
    if (!claim?.receiptFilePath) throw new NotFoundError('Receipt not found');
    const pathname = new URL(claim.receiptFilePath, config.app.url).pathname;
    const prefix = '/uploads/travel-expenses/receipts/';
    if (!pathname.startsWith(prefix)) throw new NotFoundError('Receipt not found');
    const relative = decodeURIComponent(pathname.slice(prefix.length));
    const file = await resolvePrivatePath(path.resolve('uploads/travel-expenses/receipts'), relative);
    download(res, file, path.basename(file), next);
  } catch (error) { next(error); }
});

privateFilesRouter.get('/performance-evidence/:id', authorize({ resource: 'performance', action: 'read' }), async (req: AuthenticatedRequest, res, next) => {
  try {
    const employee = await employeeScope(req, 'performance');
    const actor = req.user!.employeeId;
    if (!actor) throw new ForbiddenError('Employee identity is required');
    const evidence = await prisma.performancePlanningEvidence.findFirst({
      where: {
        id: req.params.id as string, companyId: req.company!.id,
        assignment: { deletedAt: null, employee },
        OR: [
          { assignment: { employeeId: actor } },
          { target: { reviewerId: actor } },
          { target: { approverId: actor } },
          { target: { reviewerId: null }, assignment: { reviewerId: actor } },
          { target: { approverId: null }, assignment: { approverId: actor } },
        ],
      },
      select: { fileName: true, originalName: true },
    });
    if (!evidence) throw new NotFoundError('Evidence not found');
    if (path.basename(evidence.fileName) !== evidence.fileName) throw new ForbiddenError('Invalid file location');
    const file = await resolvePrivatePath(path.resolve(config.upload.uploadPath, 'performance/evidence'), evidence.fileName);
    download(res, file, evidence.originalName, next);
  } catch (error) { next(error); }
});
