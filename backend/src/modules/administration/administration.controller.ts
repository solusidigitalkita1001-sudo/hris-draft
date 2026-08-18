import { Request, Response, NextFunction } from 'express';
import { administrationService } from './administration.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

const extractUser = (req: AuthenticatedRequest) => ({
  id: req.user?.id ?? '',
  roles: req.user?.roles,
  companyId: req.user?.companyId,
  employeeId: req.user?.employeeId,
  companyScope: req.user?.companyScope,
});

export class AdministrationController {
  async listRoleMenuAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { companyId, roleCode } = req.query;
      const result = await administrationService.findRoleMenuAccessByRole(
        companyId as string,
        roleCode as string,
        extractUser(req)
      );
      res.status(200).json(Result.success(result));
    } catch (error) {
      next(error);
    }
  }

  async upsertRoleMenuAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await administrationService.upsertRoleMenuAccess(
        req.body,
        extractUser(req)
      );
      res.status(200).json(Result.updated(result, 'Role menu access saved'));
    } catch (error) {
      next(error);
    }
  }

  async bulkUpsertRoleMenuAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await administrationService.bulkUpsertRoleMenuAccess(
        req.body,
        extractUser(req)
      );
      res
        .status(200)
        .json(Result.updated(result, 'Role menu access bulk saved'));
    } catch (error) {
      next(error);
    }
  }

  async listRoleDataScope(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { companyId, roleCode, resource } = req.query;
      const result = await administrationService.findRoleDataScopeByRole(
        companyId as string,
        roleCode as string,
        resource as string | undefined,
        extractUser(req)
      );
      res.status(200).json(Result.success(result));
    } catch (error) {
      next(error);
    }
  }

  async upsertRoleDataScope(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await administrationService.upsertRoleDataScope(
        req.body,
        extractUser(req)
      );
      res.status(200).json(Result.updated(result, 'Role data scope saved'));
    } catch (error) {
      next(error);
    }
  }

  async getMyMenuAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { companyId } = req.query;
      const effectiveCompanyId =
        (companyId as string) ||
        req.company?.id ||
        req.user?.companyId ||
        '';
      const result = await administrationService.findMyMenuAccessByRoles(
        effectiveCompanyId,
        extractUser(req)
      );
      res.status(200).json(Result.success(result));
    } catch (error) {
      next(error);
    }
  }

  async getMyDataScope(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { companyId, resource } = req.query;
      const effectiveCompanyId =
        (companyId as string) ||
        req.company?.id ||
        req.user?.companyId ||
        '';
      const resourceStr = (resource as string) || 'ALL';
      const user = extractUser(req);

      const scope = await administrationService.findMyDataScopeByUser(
        effectiveCompanyId,
        user,
        resourceStr
      );

      const parsedFilter = administrationService.resolveEmployeeFilterForCurrentUser(
        scope,
        user,
        resourceStr
      );

      res.status(200).json(
        Result.success({
          roleCode: scope?.roleCode ?? null,
          scopeType: scope?.scopeType ?? 'ALL',
          scopeValue: scope?.scopeValue ?? null,
          resource: resourceStr,
          parsedFilter,
        })
      );
    } catch (error) {
      next(error);
    }
  }
}

export const administrationController = new AdministrationController();
