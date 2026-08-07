import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { assetService } from './asset.service';
import { Result } from '@/shared/core/Result';

export class AssetController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await assetService.findAll(req.query.companyId as string, req.query.status as string))); }
    catch (error) { next(error); }
  }
  async findById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await assetService.findById(req.params.id as string))); }
    catch (error) { next(error); }
  }
  async getDepreciation(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query;
      res.json(Result.success(await assetService.getDepreciation(req.params.id as string, {
        method: q.method as string | undefined,
        salvageValue: q.salvageValue ? Number(q.salvageValue) : undefined,
        usefulLifeYears: q.usefulLifeYears ? Number(q.usefulLifeYears) : undefined,
        asOfMonths: q.asOfMonths ? Number(q.asOfMonths) : undefined,
      })));
    } catch (error) { next(error); }
  }
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await assetService.create(req.body))); }
    catch (error) { next(error); }
  }
  async assign(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await assetService.assign(req.params.id as string, req.body, req.user!.id))); }
    catch (error) { next(error); }
  }
  async returnAsset(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.body;
      res.json(Result.updated(await assetService.returnAsset(req.params.id as string, assignmentId, req.body)));
    }
    catch (error) { next(error); }
  }
}
export const assetController = new AssetController();
