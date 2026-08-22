import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validateRequest } from '@/shared/middleware/RequestValidator';
import { companySettingsController } from './company-settings.controller';
import {
  getSettingByKeyParamsSchema,
  setSettingByKeyParamsSchema,
  setSettingByKeyBodySchema,
  deleteSettingByKeyParamsSchema,
  bulkUpsertSettingsSchema,
} from './company-settings.dto';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  authorize({ resource: 'settings', action: 'read' }),
  companySettingsController.findAll.bind(companySettingsController),
);

router.post(
  '/bulk',
  authorize({ resource: 'settings', action: 'update' }),
  validateRequest({ body: bulkUpsertSettingsSchema }),
  companySettingsController.bulkUpsert.bind(companySettingsController),
);

router.get(
  '/:key',
  authorize({ resource: 'settings', action: 'read' }),
  validateRequest({ params: getSettingByKeyParamsSchema }),
  companySettingsController.findByKey.bind(companySettingsController),
);

router.put(
  '/:key',
  authorize({ resource: 'settings', action: 'update' }),
  validateRequest({ params: setSettingByKeyParamsSchema, body: setSettingByKeyBodySchema }),
  companySettingsController.upsertByKey.bind(companySettingsController),
);

router.delete(
  '/:key',
  authorize({ resource: 'settings', action: 'update' }),
  validateRequest({ params: deleteSettingByKeyParamsSchema }),
  companySettingsController.deleteByKey.bind(companySettingsController),
);

export default router;
