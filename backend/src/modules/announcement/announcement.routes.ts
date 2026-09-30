import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate, validateRequest } from '@/shared/middleware/RequestValidator';
import { idempotency } from '@/shared/middleware/Idempotency';
import { announcementController } from './announcement.controller';
import {
  announcementAdminQuerySchema,
  announcementIdParamsSchema,
  announcementListQuerySchema,
  announcementWriteSchema,
} from './announcement.dto';
import { authorize } from '@/shared/middleware/Authorize';
import { auditLog } from '@/shared/middleware/AuditLog';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
router.use(authenticate);
router.use(requireCompanyAccess());

// ==================== Sisi admin/HR ====================
// Static /manage prefix so it is never read as an announcement id. Membuat dan
// menerbitkan dipisah: menerbitkan adalah tindakan tersendiri, dengan
// permission tersendiri.
router.get(
  '/manage',
  authorize({ resource: 'announcement', action: 'read' }),
  validate(announcementAdminQuerySchema, 'query'),
  announcementController.adminList.bind(announcementController),
);
router.post(
  '/manage',
  authorize({ resource: 'announcement', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'Announcement' }),
  validate(announcementWriteSchema),
  announcementController.create.bind(announcementController),
);
router.get(
  '/manage/:id/readers',
  authorize({ resource: 'announcement', action: 'read' }),
  validateRequest({ params: announcementIdParamsSchema }),
  announcementController.readers.bind(announcementController),
);
router.put(
  '/manage/:id',
  authorize({ resource: 'announcement', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'Announcement', model: 'announcement' }),
  validateRequest({ params: announcementIdParamsSchema }),
  validate(announcementWriteSchema),
  announcementController.update.bind(announcementController),
);
router.patch(
  '/manage/:id/publish',
  authorize({ resource: 'announcement', action: 'approve' }),
  auditLog({ action: 'PUBLISH', entity: 'Announcement', model: 'announcement' }),
  validateRequest({ params: announcementIdParamsSchema }),
  idempotency(),
  announcementController.publish.bind(announcementController),
);
router.patch(
  '/manage/:id/archive',
  authorize({ resource: 'announcement', action: 'update' }),
  auditLog({ action: 'ARCHIVE', entity: 'Announcement', model: 'announcement' }),
  validateRequest({ params: announcementIdParamsSchema }),
  announcementController.archive.bind(announcementController),
);

router.get('/', validate(announcementListQuerySchema, 'query'), announcementController.list.bind(announcementController));
router.get('/unread-count', announcementController.unreadCount.bind(announcementController));
router.get('/:id', validateRequest({ params: announcementIdParamsSchema }), announcementController.detail.bind(announcementController));
router.put('/:id/read', validateRequest({ params: announcementIdParamsSchema }), idempotency(), announcementController.markRead.bind(announcementController));

export default router;
