import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { roleService } from '@/modules/rbac/rbac.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

export class UserController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await userService.findAll(page, limit);
      res.status(200).json(Result.paginated(result.data, result.total, result.page, result.limit));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.findById(req.params.id as string);
      res.status(200).json(Result.success(user));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.create(req.body);
      res.status(201).json(Result.created(user, 'User created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(user, 'User updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('User deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async assignRoles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await roleService.assignToUser(req.params.id as string, req.body);
      res.status(200).json(Result.updated(result, 'Roles assigned successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getUserRoles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await roleService.getUserRoles(req.params.id as string);
      res.status(200).json(Result.success(roles));
    } catch (error) {
      next(error);
    }
  }

  async findCompanyAccesses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accesses = await userService.findCompanyAccesses(req.params.id as string);
      res.status(200).json(Result.success(accesses));
    } catch (error) {
      next(error);
    }
  }

  async createCompanyAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const access = await userService.createCompanyAccess(req.params.id as string, req.body);
      res.status(201).json(Result.created(access, 'User company access created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async updateCompanyAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const access = await userService.updateCompanyAccess(
        req.params.id as string,
        req.params.accessId as string,
        req.body
      );
      res.status(200).json(Result.updated(access, 'User company access updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async deleteCompanyAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deleteCompanyAccess(req.params.id as string, req.params.accessId as string);
      res.status(200).json(Result.deleted('User company access deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
