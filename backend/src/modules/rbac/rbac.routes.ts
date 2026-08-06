import { Router } from 'express';
import { roleController } from './controllers/role.controller';
import { permissionController } from './controllers/permission.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
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
router.post('/', authorize({ resource: 'rbac', action: 'create' }), validate(createRoleSchema), roleController.create.bind(roleController));
router.put('/:id', authorize({ resource: 'rbac', action: 'update' }), validate(updateRoleSchema), roleController.update.bind(roleController));
router.delete('/:id', authorize({ resource: 'rbac', action: 'delete' }), roleController.delete.bind(roleController));

// Role permissions
router.get('/:id/permissions', authorize({ resource: 'rbac', action: 'read' }), roleController.getPermissions.bind(roleController));
router.put('/:id/permissions', authorize({ resource: 'rbac', action: 'update' }), validate(assignPermissionsSchema), roleController.assignPermissions.bind(roleController));

export default router;
