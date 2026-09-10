import { Response, NextFunction } from 'express';
import { groupService } from '../services/group.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

// undefined = unrestricted (SUPER_ADMIN); otherwise only the requester's group.
function allowedGroupIds(req: AuthenticatedRequest): string[] | undefined {
  if (req.user?.roles?.includes('SUPER_ADMIN')) return undefined;
  return req.user?.groupId ? [req.user.groupId] : [];
}

export class GroupController {
  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await groupService.findAll(allowedGroupIds(req));
      res.status(200).json(Result.success(groups));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await groupService.findById(req.params.id as string, allowedGroupIds(req));
      res.status(200).json(Result.success(group));
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await groupService.create(req.body);
      res.status(201).json(Result.created(group, 'Company group created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await groupService.update(req.params.id as string, req.body, allowedGroupIds(req));
      res.status(200).json(Result.updated(group, 'Company group updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await groupService.delete(req.params.id as string, allowedGroupIds(req));
      res.status(200).json(Result.deleted('Company group deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const groupController = new GroupController();
