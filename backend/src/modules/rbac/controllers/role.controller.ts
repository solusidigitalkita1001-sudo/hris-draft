import { Request, Response, NextFunction } from 'express';
import { roleService } from '../rbac.service';
import { Result } from '@/shared/core/Result';

export class RoleController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, groupId } = req.query;
      const roles = await roleService.findAll(
        companyId as string | undefined,
        groupId as string | undefined
      );
      res.status(200).json(Result.success(roles));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.findById(req.params.id as string);
      res.status(200).json(Result.success(role));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.create(req.body);
      res.status(201).json(Result.created(role, 'Role created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(role, 'Role updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roleService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Role deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await roleService.getPermissions(req.params.id as string);
      res.status(200).json(Result.success(permissions));
    } catch (error) {
      next(error);
    }
  }

  async assignPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await roleService.assignPermissions(req.params.id as string, req.body);
      res.status(200).json(Result.updated(result, 'Permissions assigned successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const roleController = new RoleController();
