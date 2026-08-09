import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import {
  createUserSchema,
  updateUserSchema,
  createUserCompanyAccessSchema,
  updateUserCompanyAccessSchema,
} from './user.dto';
import { assignUserRolesSchema } from '@/modules/rbac/rbac.dto';
import { auditLog } from '@/shared/middleware/AuditLog';

const router = Router();

router.use(authenticate);

router.get('/', authorize({ resource: 'user', action: 'read' }), userController.findAll.bind(userController));
router.get('/:id', authorize({ resource: 'user', action: 'read' }), userController.findById.bind(userController));
router.post('/', authorize({ resource: 'user', action: 'create' }), auditLog({ action: 'CREATE', entity: 'User' }), validate(createUserSchema), userController.create.bind(userController));
router.put('/:id', authorize({ resource: 'user', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'User', model: 'user', getEntityId: (req) => req.params.id as string }), validate(updateUserSchema), userController.update.bind(userController));
router.delete('/:id', authorize({ resource: 'user', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'User', model: 'user', getEntityId: (req) => req.params.id as string }), userController.delete.bind(userController));

// User role management
router.put('/:id/roles', authorize({ resource: 'rbac', action: 'update' }), auditLog({ action: 'ASSIGN_ROLES', entity: 'User', getEntityId: (req) => req.params.id as string }), validate(assignUserRolesSchema), userController.assignRoles.bind(userController));
router.get('/:id/roles', authorize({ resource: 'rbac', action: 'read' }), userController.getUserRoles.bind(userController));

// User company access management
router.get('/:id/company-access', authorize({ resource: 'user', action: 'read' }), userController.findCompanyAccesses.bind(userController));
router.post('/:id/company-access', authorize({ resource: 'user', action: 'update' }), validate(createUserCompanyAccessSchema), userController.createCompanyAccess.bind(userController));
router.put('/:id/company-access/:accessId', authorize({ resource: 'user', action: 'update' }), validate(updateUserCompanyAccessSchema), userController.updateCompanyAccess.bind(userController));
router.delete('/:id/company-access/:accessId', authorize({ resource: 'user', action: 'update' }), userController.deleteCompanyAccess.bind(userController));

export default router;
