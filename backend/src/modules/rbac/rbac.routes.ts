import { Router } from 'express';
import { roleController } from './controllers/role.controller';
import { permissionController } from './controllers/permission.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
} from './rbac.dto';
import { validateLogin } from '../auth/auth.validation';

const router = Router();

router.use(authenticate);

// Permissions catalog
router.get('/permissions/all', authorize({ resource: 'rbac', action: 'read' }), permissionController.findAll.bind(permissionController));

// Roles
router.get('/', authorize({ resource: 'rbac', action: 'read' }), roleController.findAll.bind(roleController));
router.get('/:id', authorize({ resource: 'rbac', action: 'read' }), roleController.findById.bind(roleController));
router.post('/', authorize({ resource: 'rbac', action: 'create' }), auditLog({ action: 'CREATE', entity: 'Role' }), validate(createRoleSchema), roleController.create.bind(roleController));
router.put('/:id', authorize({ resource: 'rbac', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Role', model: 'role' }), validate(updateRoleSchema), roleController.update.bind(roleController));
router.delete('/:id', authorize({ resource: 'rbac', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Role', model: 'role' }), roleController.delete.bind(roleController));

// Role permissions
router.get('/:id/permissions', authorize({ resource: 'rbac', action: 'read' }), roleController.getPermissions.bind(roleController));
router.put('/:id/permissions', authorize({ resource: 'rbac', action: 'update' }), auditLog({ action: 'ASSIGN_PERMISSIONS', entity: 'Role', model: 'role' }), validate(assignPermissionsSchema), roleController.assignPermissions.bind(roleController));

export default router;
