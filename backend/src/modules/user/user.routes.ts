import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { createUserSchema, updateUserSchema } from './user.dto';
import { assignUserRolesSchema } from '@/modules/rbac/rbac.dto';

const router = Router();

router.use(authenticate);

router.get('/', authorize({ resource: 'user', action: 'read' }), userController.findAll.bind(userController));
router.get('/:id', authorize({ resource: 'user', action: 'read' }), userController.findById.bind(userController));
router.post('/', authorize({ resource: 'user', action: 'create' }), validate(createUserSchema), userController.create.bind(userController));
router.put('/:id', authorize({ resource: 'user', action: 'update' }), validate(updateUserSchema), userController.update.bind(userController));
router.delete('/:id', authorize({ resource: 'user', action: 'delete' }), userController.delete.bind(userController));

// User role management
router.put('/:id/roles', authorize({ resource: 'rbac', action: 'update' }), validate(assignUserRolesSchema), userController.assignRoles.bind(userController));
router.get('/:id/roles', authorize({ resource: 'rbac', action: 'read' }), userController.getUserRoles.bind(userController));

export default router;
