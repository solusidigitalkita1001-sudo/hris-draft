import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { permissionRequestController } from './permission-request.controller';
import { createPermissionSchema, approvePermissionSchema } from './permission-request.dto';

const router = Router();
router.use(authenticate);

router.get('/', authorize({ resource: 'permission-request', action: 'read' }), permissionRequestController.findAll.bind(permissionRequestController));
router.get('/my', permissionRequestController.findMyRequests.bind(permissionRequestController));
router.get('/:id', authorize({ resource: 'permission-request', action: 'read' }), permissionRequestController.findById.bind(permissionRequestController));
router.post('/', validate(createPermissionSchema), permissionRequestController.create.bind(permissionRequestController));
router.patch('/:id/cancel', permissionRequestController.cancel.bind(permissionRequestController));
router.patch('/:id/approve', authorize({ resource: 'permission-request', action: 'update' }), auditLog({ action: 'APPROVE', entity: 'PermissionRequest', model: 'permissionRequest' }), validate(approvePermissionSchema), permissionRequestController.approve.bind(permissionRequestController));
router.patch('/:id/reject', authorize({ resource: 'permission-request', action: 'update' }), auditLog({ action: 'REJECT', entity: 'PermissionRequest', model: 'permissionRequest' }), validate(approvePermissionSchema), permissionRequestController.reject.bind(permissionRequestController));

export default router;
