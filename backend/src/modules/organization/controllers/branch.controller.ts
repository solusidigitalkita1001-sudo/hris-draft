import { Request, Response, NextFunction } from 'express';
import { branchService } from '../services/branch.service';
import { Result } from '@/shared/core/Result';

export class BranchController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.query;
      const branches = await branchService.findAll(companyId as string);
      res.status(200).json(Result.success(branches));
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchService.findById(req.params.id as string);
      res.status(200).json(Result.success(branch));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchService.create(req.body);
      res.status(201).json(Result.created(branch, 'Branch created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchService.update(req.params.id as string, req.body);
      res.status(200).json(Result.updated(branch, 'Branch updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await branchService.delete(req.params.id as string);
      res.status(200).json(Result.deleted('Branch deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getAttendancePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policy = await branchService.getAttendancePolicy(req.params.id as string);
      res.status(200).json(Result.success(policy));
    } catch (error) {
      next(error);
    }
  }

  async upsertAttendancePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policy = await branchService.upsertAttendancePolicy(req.params.id as string, req.body);
      res.status(200).json(Result.updated(policy, 'Branch attendance policy saved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async deleteAttendancePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await branchService.deleteAttendancePolicy(req.params.id as string);
      res.status(200).json(Result.deleted('Branch attendance policy deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const branchController = new BranchController();
