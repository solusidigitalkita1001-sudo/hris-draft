import { Request, Response, NextFunction } from 'express';
import { departmentService } from '../services/department.service';
import { Result } from '@/shared/core/Result';

export class DepartmentController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, divisionId } = req.query;
      const departments = await departmentService.findAll(
        companyId as string,
        divisionId as string | undefined
      );
      res.status(200).json(Result.success(departments));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentService.findById(req.params.id as string);
      res.status(200).json(Result.success(department));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentService.create(req.body);
      res.status(201).json(Result.created(department, 'Department created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(department, 'Department updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await departmentService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Department deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getHierarchy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const hierarchy = await departmentService.getHierarchy(companyId as string);
      res.status(200).json(Result.success(hierarchy));
    } catch (error) {
      next(error);
    }
  }
}

export const departmentController = new DepartmentController();
