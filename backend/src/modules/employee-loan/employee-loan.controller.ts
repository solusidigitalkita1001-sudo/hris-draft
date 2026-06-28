import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { employeeLoanRepository } from './employee-loan.repository';
import { Result } from '@/shared/core/Result';

export class EmployeeLoanController {
  async findLoanTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      if (!companyId) return res.status(400).json(Result.error('companyId is required'));
      const data = await employeeLoanRepository.findLoanTypes(companyId);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const status = req.query.status as string | undefined;
      if (!companyId) return res.status(400).json(Result.error('companyId is required'));
      const data = await employeeLoanRepository.findAll(companyId, status);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findMyLoans(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = req.query.employeeId as string;
      const status = req.query.status as string | undefined;
      if (!employeeId) return res.status(400).json(Result.error('employeeId is required'));
      const data = await employeeLoanRepository.findMyLoans(employeeId, status);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeLoanRepository.findById(req.params.id as string);
      if (!data) return res.status(404).json(Result.error('Loan not found'));
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { loanTypeId, amount, totalInstallments, installmentAmount, reason } = req.body;
      const employeeId = req.body.employeeId;
      const companyId = req.body.companyId || (req as any).user?.companyId;

      const loan = await employeeLoanRepository.create({
        loanTypeId,
        amount,
        totalInstallments,
        installmentAmount,
        reason,
        companyId,
        employeeId,
        remainingBalance: amount,
      });

      // Auto-generate installments if approved amounts
      if (totalInstallments > 1) {
        await employeeLoanRepository.generateInstallments(loan.id, totalInstallments, installmentAmount, new Date());
      }

      res.status(201).json(Result.created(loan));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await employeeLoanRepository.approve(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Loan approved'));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await employeeLoanRepository.reject(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Loan rejected'));
    } catch (error) { next(error); }
  }

  async getInstallments(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeLoanRepository.getInstallments(req.params.id as string);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }
}

export const employeeLoanController = new EmployeeLoanController();
