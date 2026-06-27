import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { validate } from '@/shared/middleware/RequestValidator';
import { notificationController } from './notification.controller';
import { markReadSchema } from './notification.dto';

const router = Router();
router.use(authenticate);

router.get('/', notificationController.findAll.bind(notificationController));
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));
router.put('/read', validate(markReadSchema), notificationController.markAsRead.bind(notificationController));
router.put('/read-all', notificationController.markAllAsRead.bind(notificationController));
router.delete('/:id', notificationController.delete.bind(notificationController));

export default router;
