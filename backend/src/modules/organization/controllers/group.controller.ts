import { Request, Response, NextFunction } from 'express';
import { groupService } from '../services/group.service';
import { Result } from '@/shared/core/Result';

export class GroupController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await groupService.findAll();
      res.status(200).json(Result.success(groups));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await groupService.findById(req.params.id as string);
      res.status(200).json(Result.success(group));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await groupService.create(req.body);
      res.status(201).json(Result.created(group, 'Company group created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await groupService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(group, 'Company group updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await groupService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Company group deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const groupController = new GroupController();
