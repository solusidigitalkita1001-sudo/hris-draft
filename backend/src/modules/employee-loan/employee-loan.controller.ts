import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { employeeLoanService } from './employee-loan.service';
import { Result } from '@/shared/core/Result';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';

export class EmployeeLoanController {
  async findLoanTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      if (!companyId) return res.status(400).json(Result.error('companyId is required'));
      const data = await employeeLoanService.findLoanTypes(companyId);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const status = req.query.status as string | undefined;
      if (!companyId) return res.status(400).json(Result.error('companyId is required'));
      const data = await employeeLoanService.findAll(companyId, status);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findMyLoans(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = req.query.employeeId as string;
      const status = req.query.status as string | undefined;
      if (!employeeId) return res.status(400).json(Result.error('employeeId is required'));
      const data = await employeeLoanService.findMyLoans(employeeId, status);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeLoanService.findById(req.params.id as string);
      if (!data) return res.status(404).json(Result.error('Loan not found'));
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { loanTypeId, amount, totalInstallments, installmentAmount, reason } = req.body;
      const employeeId = req.user!.employeeId;
      const companyId = req.user!.companyId;

      if (!employeeId) throw new BadRequestError('User has no associated employee record');
      if (!companyId) throw new BadRequestError('User has no associated company');

      const loan = await employeeLoanService.createLoan({
        loanTypeId,
        amount,
        totalInstallments,
        installmentAmount,
        reason,
        companyId,
        employeeId,
        remainingBalance: amount,
      });

      res.status(201).json(Result.created(loan));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await employeeLoanService.approveLoan(
        req.params.id as string,
        req.user!.id,
        req.user!.employeeId
      );
      res.json(Result.updated(result, 'Loan approved via workflow'));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await employeeLoanService.rejectLoan(
        req.params.id as string,
        req.user!.id,
        req.user!.employeeId,
        req.body?.reason ?? req.body?.notes
      );
      res.json(Result.updated(result, 'Loan rejected via workflow'));
    } catch (error) { next(error); }
  }

  async getWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await employeeLoanService.getWorkflow(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async applyWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await employeeLoanService.applyWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' }
      );
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async getInstallments(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeLoanService.getInstallments(req.params.id as string);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async getAmortization(req: Request, res: Response, next: NextFunction) {
    try {
      const method = req.query.method === 'EFFECTIVE' ? 'EFFECTIVE' : 'FLAT';
      const data = await employeeLoanService.buildAmortization(req.params.id as string, method);
      if (!data) throw new NotFoundError('Loan not found');
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }
}

export const employeeLoanController = new EmployeeLoanController();
