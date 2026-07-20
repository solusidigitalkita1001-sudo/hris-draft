import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { payrollService } from './payroll.service';
import { Result } from '@/shared/core/Result';

export class PayrollController {
  // ==================== Salary Components ====================

  async findAllSalaryComponents(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await payrollService.findAllSalaryComponents(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findSalaryComponentById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findSalaryComponentById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createSalaryComponent(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updateSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.updateSalaryComponent(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async deleteSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await payrollService.deleteSalaryComponent(id);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  // ==================== Employee Salaries ====================

  async findAllEmployeeSalaries(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const employeeId = req.query.employeeId as string | undefined;
      const data = await payrollService.findAllEmployeeSalaries(companyId, employeeId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findEmployeeSalaryById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findEmployeeSalaryById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createEmployeeSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createEmployeeSalary(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updateEmployeeSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.updateEmployeeSalary(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  // ==================== Payroll Periods ====================

  async findAllPayrollPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await payrollService.findAllPayrollPeriods(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findPayrollPeriodById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findPayrollPeriodById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createPayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createPayrollPeriod(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updatePayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.updatePayrollPeriod(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async closePayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.closePayrollPeriod(id);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  // ==================== Payroll Runs ====================

  async findAllPayrollRuns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await payrollService.findAllPayrollRuns(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findPayrollRunById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findPayrollRunById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createPayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await payrollService.createPayrollRun(req.body, req.user?.id);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async approvePayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.approvePayrollRun(id, req.user!.id);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async disbursePayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.disbursePayrollRun(id, req.user!.id);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  // ==================== Payslips ====================

  async findPayslipById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await payrollService.findPayslipById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyPayslips(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        return res.status(400).json(Result.error('Employee ID is required'));
      }
      const data = await payrollService.findPayslipsByEmployee(employeeId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }
}

export const payrollController = new PayrollController();
