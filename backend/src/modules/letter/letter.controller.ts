import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { letterService } from './letter.service';

function companyOf(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class LetterController {
  /** Daftar placeholder yang tersedia, supaya editor template bisa menjelaskan dirinya. */
  async placeholders(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(letterService.availablePlaceholders()));
    } catch (error) { next(error); }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await letterService.list(companyOf(req))));
    } catch (error) { next(error); }
  }

  async upsert(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await letterService.upsert(companyOf(req), req.body), 'Template surat disimpan'));
    } catch (error) { next(error); }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await letterService.remove(companyOf(req), req.params.id as string);
      res.json(Result.success(null, 'Template surat dinonaktifkan'));
    } catch (error) { next(error); }
  }

  async render(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await letterService.render(companyOf(req), req.params.id as string, req.body);
      res.json(Result.success(result, 'Surat dirender'));
    } catch (error) { next(error); }
  }
}

export const letterController = new LetterController();
