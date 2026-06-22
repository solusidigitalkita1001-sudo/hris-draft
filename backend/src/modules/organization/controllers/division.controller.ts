import { Request, Response, NextFunction } from 'express';
import { divisionService } from '../services/division.service';
import { Result } from '@/shared/core/Result';

export class DivisionController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.query;
      const divisions = await divisionService.findAll(companyId as string);
      res.status(200).json(Result.success(divisions));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const division = await divisionService.findById(req.params.id as string);
      res.status(200).json(Result.success(division));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const division = await divisionService.create(req.body);
      res.status(201).json(Result.created(division, 'Division created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const division = await divisionService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(division, 'Division updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await divisionService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Division deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const divisionController = new DivisionController();
