import { Request, Response, NextFunction } from 'express';
import { positionService } from '../services/position.service';
import { Result } from '@/shared/core/Result';

export class PositionController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, departmentId } = req.query;
      const positions = await positionService.findAll(
        companyId as string,
        departmentId as string | undefined
      );
      res.status(200).json(Result.success(positions));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const position = await positionService.findById(req.params.id as string);
      res.status(200).json(Result.success(position));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const position = await positionService.create(req.body);
      res.status(201).json(Result.created(position, 'Position created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const position = await positionService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(position, 'Position updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await positionService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Position deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const positionController = new PositionController();
