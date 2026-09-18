import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate } from '@/shared/middleware/RequestValidator';
import { notificationController } from './notification.controller';
import { markReadSchema, notificationListQuerySchema } from './notification.dto';
import { registerMobileDeviceSchema, unregisterMobileDeviceSchema } from './mobile-device.dto';
import { idempotency } from '@/shared/middleware/Idempotency';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.post('/device-tokens', validate(registerMobileDeviceSchema), idempotency(), notificationController.registerDevice.bind(notificationController));
router.delete('/device-tokens', validate(unregisterMobileDeviceSchema), idempotency(), notificationController.unregisterDevice.bind(notificationController));
router.get('/', validate(notificationListQuerySchema, 'query'), notificationController.findAll.bind(notificationController));
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));
router.put('/read', validate(markReadSchema), notificationController.markAsRead.bind(notificationController));
router.put('/read-all', notificationController.markAllAsRead.bind(notificationController));
router.delete('/:id', notificationController.delete.bind(notificationController));

export default router;
