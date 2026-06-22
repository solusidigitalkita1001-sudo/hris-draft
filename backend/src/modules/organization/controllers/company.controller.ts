import { Request, Response, NextFunction } from 'express';
import { companyService } from '../services/company.service';
import { Result } from '@/shared/core/Result';

export class CompanyController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.query;
      const companies = await companyService.findAll(groupId as string | undefined);
      res.status(200).json(Result.success(companies));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.findById(req.params.id as string);
      res.status(200).json(Result.success(company));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.create(req.body);
      res.status(201).json(Result.created(company, 'Company created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(company, 'Company updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await companyService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Company deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const companyController = new CompanyController();
