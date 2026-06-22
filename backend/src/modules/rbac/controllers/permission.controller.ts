import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../rbac.service';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';

export class PermissionController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { module } = req.query;
      const permissions = await permissionService.findAll(module as string | undefined);
      res.status(200).json(Result.success(permissions));
    } catch (error) {
      next(error);
    }
  }

  async getUserPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.params.userId as string) || req.user!.id;
      const permissions = await permissionService.getUserPermissions(userId);
      res.status(200).json(Result.success(permissions));
    } catch (error) {
      next(error);
    }
  }
}

export const permissionController = new PermissionController();
