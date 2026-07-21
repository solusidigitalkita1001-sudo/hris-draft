import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { auditLogController } from './audit-log.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize({ resource: 'audit-log', action: 'read' }), auditLogController.findAll.bind(auditLogController));
router.get('/export', authorize({ resource: 'audit-log', action: 'read' }), auditLogController.exportCsv.bind(auditLogController));
router.get('/:id', authorize({ resource: 'audit-log', action: 'read' }), auditLogController.findById.bind(auditLogController));

export default router;
