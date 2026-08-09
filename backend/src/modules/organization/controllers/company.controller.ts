import { Response, NextFunction } from 'express';
import { companyService } from '../services/company.service';
import { branchRepository } from '../repositories/branch.repository';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

export class CompanyController {
  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.query;
      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
      const companyScope = req.user?.companyScope || [];
      const companies = await companyService.findAll(
        groupId as string | undefined,
        isSuperAdmin ? undefined : companyScope
      );
      res.status(200).json(Result.success(companies));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
      const companyScope = req.user?.companyScope || [];
      const company = await companyService.findById(
        req.params.id as string,
        isSuperAdmin ? undefined : companyScope
      );
      res.status(200).json(Result.success(company));
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.create(req.body);
      res.status(201).json(Result.created(company, 'Company created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(company, 'Company updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await companyService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Company deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getDefaultAttendancePolicy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(Result.success(await branchRepository.findCompanyDefaultPolicy(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async upsertDefaultAttendancePolicy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(Result.updated(await branchRepository.upsertCompanyDefaultPolicy(req.params.id as string, req.body)));
    } catch (error) { next(error); }
  }

  async deleteDefaultAttendancePolicy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await branchRepository.softDeleteCompanyDefaultPolicy(req.params.id as string);
      res.json(Result.deleted('Company default attendance policy deleted'));
    } catch (error) { next(error); }
  }
}

export const companyController = new CompanyController();
