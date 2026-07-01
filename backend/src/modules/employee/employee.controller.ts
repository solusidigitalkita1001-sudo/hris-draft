import { Request, Response, NextFunction } from 'express';
import { employeeService } from './employee.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

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

  async findCareerTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await employeeService.findCareerTransactions(req.params.id as string);
      res.json(Result.success(items));
    } catch (error) {
      next(error);
    }
  }

  async createCareerTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const transaction = await employeeService.createCareerTransaction(
        req.params.id as string,
        req.body,
        req.user?.id
      );
      res.status(201).json(Result.created(transaction));
    } catch (error) {
      next(error);
    }
  }

  async importCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId || req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId is required' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, message: 'CSV file is required' });
        return;
      }
      const result = await employeeService.importCsv(companyId, req.file);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId is required' });
        return;
      }
      const csv = await employeeService.exportCsv(companyId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const employeeController = new EmployeeController();
