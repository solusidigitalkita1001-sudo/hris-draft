import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { customFieldService } from './custom-field.service';
import type { CreateCustomFieldDTO, SetCustomFieldValuesDTO, UpdateCustomFieldDTO } from './custom-field.dto';

function companyOf(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class CustomFieldController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await customFieldService.listDefinitions(
        companyOf(req), req.query.includeInactive === 'true')));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const row = await customFieldService.createDefinition(companyOf(req), req.body as CreateCustomFieldDTO);
      res.status(201).json(Result.success(row, 'Custom field dibuat'));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await customFieldService.updateDefinition(
        companyOf(req), String(req.params.id), req.body as UpdateCustomFieldDTO)));
    } catch (error) { next(error); }
  }

  async valuesFor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await customFieldService.valuesFor(companyOf(req), String(req.params.employeeId))));
    } catch (error) { next(error); }
  }

  async setValues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(
        await customFieldService.setValues(companyOf(req), String(req.params.employeeId), req.body as SetCustomFieldValuesDTO),
        'Nilai custom field disimpan',
      ));
    } catch (error) { next(error); }
  }
}

export const customFieldController = new CustomFieldController();
