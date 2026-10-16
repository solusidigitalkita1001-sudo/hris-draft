import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { assetService } from './asset.service';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';

export class AssetController {
  async findMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.employeeId || !req.user.companyId) {
        throw new BadRequestError('Akun ini tidak tertaut ke data karyawan dan perusahaan');
      }
      const { status, page, limit } = req.query as unknown as {
        status: 'ACTIVE' | 'RETURNED' | 'ALL';
        page: number;
        limit: number;
      };
      const result = await assetService.findMine(
        req.user.companyId,
        req.user.employeeId,
        { status, page, limit },
      );
      res.json(Result.paginated(result.items, result.total, page, limit));
    } catch (error) { next(error); }
  }

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
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await assetService.update(req.user!.companyId!, req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }
  async delete(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await assetService.delete(req.params.id as string), 'Asset deleted')); }
    catch (error) { next(error); }
  }
  async transfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await assetService.transfer(req.user!.companyId!, req.params.id as string, req.body, req.user!.id))); }
    catch (error) { next(error); }
  }
  async outstanding(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await assetService.outstandingFor(req.user!.companyId!, req.params.employeeId as string))); }
    catch (error) { next(error); }
  }
  async listCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await assetService.listCategories(req.user!.companyId!))); }
    catch (error) { next(error); }
  }
  async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await assetService.createCategory(req.user!.companyId!, req.body))); }
    catch (error) { next(error); }
  }
  async updateCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await assetService.updateCategory(req.user!.companyId!, req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }
  async deleteCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await assetService.deleteCategory(req.user!.companyId!, req.params.id as string), 'Category deleted')); }
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
