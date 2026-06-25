import { Request, Response, NextFunction } from 'express';
import { employeeService } from './employee.service';
import { Result } from '@/shared/core/Result';

export class EmployeeController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const cid = req.query.companyId as string;
      const query = {
        companyId: cid,
        departmentId: req.query.departmentId as string | undefined,
        positionId: req.query.positionId as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };
      const result = await employeeService.findAll(query);
      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.findById(req.params.id as string);
      res.json(Result.success(employee));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.create(req.body);
      res.status(201).json(Result.created(employee));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.update(req.params.id as string, req.body);
      res.json(Result.updated(employee));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.delete(req.params.id as string);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.updateStatus(req.params.id as string, req.body.status);
      res.json(Result.updated(employee));
    } catch (error) {
      next(error);
    }
  }
}

export const employeeController = new EmployeeController();
