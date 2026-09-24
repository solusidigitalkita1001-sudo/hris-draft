import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate, validateRequest } from '@/shared/middleware/RequestValidator';
import { idempotency } from '@/shared/middleware/Idempotency';
import { announcementController } from './announcement.controller';
import { announcementIdParamsSchema, announcementListQuerySchema } from './announcement.dto';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/', validate(announcementListQuerySchema, 'query'), announcementController.list.bind(announcementController));
router.get('/unread-count', announcementController.unreadCount.bind(announcementController));
router.get('/:id', validateRequest({ params: announcementIdParamsSchema }), announcementController.detail.bind(announcementController));
router.put('/:id/read', validateRequest({ params: announcementIdParamsSchema }), idempotency(), announcementController.markRead.bind(announcementController));

export default router;
