import type { Request, Response } from 'express';
import { companySettingsService } from './company-settings.service';
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
    res.json({
      success: true,
      code: 'OK',
      message: 'Company settings loaded',
      data: settings,
    });
  }

  async findByKey(req: Request<GetSettingByKeyParamsDTO>, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const value = await companySettingsService.getSettingByKey(req.params.key, explicitCompanyId);
    res.json({
      success: true,
      code: 'OK',
      message: 'Setting value loaded',
      data: { key: req.params.key, value },
    });
  }

  async upsertByKey(
    req: Request<SetSettingByKeyParamsDTO, unknown, SetSettingByKeyBodyDTO>,
    res: Response,
  ) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const result = await companySettingsService.setSetting(req.params.key, req.body.value, explicitCompanyId);
    res.status(200).json({
      success: true,
      code: 'OK',
      message: 'Setting saved',
      data: { id: result.id, key: result.key },
    });
  }

  async bulkUpsert(req: Request<unknown, unknown, BulkUpsertSettingsDTO>, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    await companySettingsService.bulkUpsertSettings(req.body, explicitCompanyId);
    res.status(200).json({
      success: true,
      code: 'OK',
      message: `${Object.keys(req.body).length} settings saved successfully`,
    });
  }

  async deleteByKey(req: Request<DeleteSettingByKeyParamsDTO>, res: Response) {
    const explicitCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    await companySettingsService.deleteSetting(req.params.key, explicitCompanyId);
    res.json({
      success: true,
      code: 'OK',
      message: `Setting key '${req.params.key}' deleted. (Will fallback to default value if default exists).`,
    });
  }
}

export const companySettingsController = new CompanySettingsController();
