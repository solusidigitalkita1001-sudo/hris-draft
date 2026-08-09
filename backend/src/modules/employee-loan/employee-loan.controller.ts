import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { employeeLoanRepository } from './employee-loan.repository';
import { Result } from '@/shared/core/Result';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';

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
      const employeeId = req.user!.employeeId;
      const companyId = req.user!.companyId;

      if (!employeeId) throw new BadRequestError('User has no associated employee record');
      if (!companyId) throw new BadRequestError('User has no associated company');

      const loanType = await employeeLoanRepository.findLoanTypeById(loanTypeId);
      if (!loanType) throw new NotFoundError('Loan type not found');
      if (Number(amount) > Number(loanType.maxAmount)) {
        throw new BadRequestError(`Amount exceeds loan type maximum of ${loanType.maxAmount}`);
      }
      if (Number(totalInstallments) > loanType.maxInstallments) {
        throw new BadRequestError(`Installments exceed loan type maximum of ${loanType.maxInstallments}`);
      }

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

      res.status(201).json(Result.created(loan));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const existingLoan = await employeeLoanRepository.findById(req.params.id as string);
      if (!existingLoan) {
        throw new NotFoundError('Loan not found');
      }

      if (existingLoan.status !== 'PENDING') {
        throw new BadRequestError('Only pending loans can be approved');
      }

      const data = await employeeLoanRepository.approve(
        req.params.id as string,
        req.user!.id,
        {
          totalInstallments: existingLoan.totalInstallments,
          installmentAmount: existingLoan.installmentAmount,
        },
        req.body
      );
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

  async getAmortization(req: Request, res: Response, next: NextFunction) {
    try {
      const method = req.query.method === 'EFFECTIVE' ? 'EFFECTIVE' : 'FLAT';
      const data = await employeeLoanRepository.buildAmortization(req.params.id as string, method);
      if (!data) throw new NotFoundError('Loan not found');
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }
}

export const employeeLoanController = new EmployeeLoanController();
