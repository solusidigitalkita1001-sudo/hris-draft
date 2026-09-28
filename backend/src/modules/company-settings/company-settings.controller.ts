import type { Request, Response } from 'express';
import { companySettingsService } from './company-settings.service';
import { Result } from '@/shared/core/Result';
import type {
  BulkUpsertSettingsDTO,
  GetSettingByKeyParamsDTO,
  SetSettingByKeyBodyDTO,
  SetSettingByKeyParamsDTO,
  DeleteSettingByKeyParamsDTO,
} from './company-settings.dto';

export class CompanySettingsController {
  async findAll(req: Request, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const settings = await companySettingsService.getAllSettings(explicitCompanyId);
    res.json(Result.success(settings, 'Company settings loaded'));
  }

  async findByKey(req: Request<GetSettingByKeyParamsDTO>, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const value = await companySettingsService.getSettingByKey(req.params.key, explicitCompanyId);
    res.json(Result.success({ key: req.params.key, value }, 'Setting value loaded'));
  }

  async upsertByKey(
    req: Request<SetSettingByKeyParamsDTO, unknown, SetSettingByKeyBodyDTO>,
    res: Response,
  ) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const result = await companySettingsService.setSetting(req.params.key, req.body.value, explicitCompanyId);
    res.status(200).json(Result.success({ id: result.id, key: result.key }, 'Setting saved'));
  }

  async bulkUpsert(req: Request<unknown, unknown, BulkUpsertSettingsDTO>, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    await companySettingsService.bulkUpsertSettings(req.body, explicitCompanyId);
    res.status(200).json(Result.noContent(`${Object.keys(req.body).length} settings saved successfully`));
  }

  async deleteByKey(req: Request<DeleteSettingByKeyParamsDTO>, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    await companySettingsService.deleteSetting(req.params.key, explicitCompanyId);
    res.json(Result.deleted(`Setting key '${req.params.key}' deleted. (Will fallback to default value if default exists).`));
  }
}

export const companySettingsController = new CompanySettingsController();
