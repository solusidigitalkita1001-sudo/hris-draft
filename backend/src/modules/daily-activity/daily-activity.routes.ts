import { Router } from 'express';
import {
  createDailyActivitySchema,
  updateDailyActivitySchema,
  completeDailyActivitySchema,
  listDailyActivitiesSchema,
} from './daily-activity.dto';
import { validate } from '@/shared/middleware/RequestValidator';
import { authorize } from '@/shared/middleware/Authorize';
import { dailyActivityController } from './daily-activity.controller';
import { auditLog } from '@/shared/middleware/AuditLog';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();

// Authentication must run before authorization so req.user and the
// AsyncLocalStorage tenant context are available to every downstream query.
router.use(authenticate);
router.use(requireCompanyAccess());

router.get(
  '/my',
  authorize({ resource: 'daily-activity', action: 'read' }),
  dailyActivityController.getMyActivities.bind(dailyActivityController),
);
router.post(
  '/',
  authorize({ resource: 'daily-activity', action: 'create' }),
  validate(createDailyActivitySchema),
  auditLog({ action: 'create', entity: 'Daily_Activity', model: 'DailyActivity' }),
  dailyActivityController.createRequest.bind(dailyActivityController),
);
router.get(
  '/:id',
  authorize({ resource: 'daily-activity', action: 'read' }),
  dailyActivityController.getRequestById.bind(dailyActivityController),
);
router.put(
  '/:id',
  authorize({ resource: 'daily-activity', action: 'update' }),
  validate(updateDailyActivitySchema),
  auditLog({ action: 'update', entity: 'Daily_Activity', model: 'DailyActivity' }),
  dailyActivityController.updateRequest.bind(dailyActivityController),
);
router.post(
  '/:id/complete',
  authorize({ resource: 'daily-activity', action: 'update' }),
  validate(completeDailyActivitySchema),
  auditLog({ action: 'process', entity: 'Daily_Activity', model: 'DailyActivity' }),
  dailyActivityController.completeRequest.bind(dailyActivityController),
);
router.delete(
  '/:id',
  authorize({ resource: 'daily-activity', action: 'delete' }),
  auditLog({ action: 'delete', entity: 'Daily_Activity', model: 'DailyActivity' }),
  dailyActivityController.deleteRequest.bind(dailyActivityController),
);
router.get(
  '/',
  authorize({ resource: 'daily-activity', action: 'read' }),
  validate(listDailyActivitiesSchema, 'query'),
  dailyActivityController.listRequests.bind(dailyActivityController),
);

export default router;
