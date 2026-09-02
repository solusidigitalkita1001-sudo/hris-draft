import { Router } from 'express';
import { administrationController } from './administration.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate } from '@/shared/middleware/RequestValidator';
import {
  upsertRoleMenuAccessSchema,
  bulkUpsertRoleMenuAccessSchema,
  upsertRoleDataScopeSchema,
} from './administration.dto';

const router = Router();

router.use(authenticate);

router.get(
  '/role-menu-access/my',
  requireCompanyAccess(),
  administrationController.getMyMenuAccess.bind(administrationController)
);

router.get(
  '/role-data-scope/my',
  requireCompanyAccess(),
  administrationController.getMyDataScope.bind(administrationController)
);

router.get(
  '/role-menu-access',
  requireCompanyAccess(),
  authorize({ resource: 'rbac', action: 'update' }),
  administrationController.listRoleMenuAccess.bind(administrationController)
);

router.post(
  '/role-menu-access',
  requireCompanyAccess(),
  authorize({ resource: 'rbac', action: 'update' }),
  validate(upsertRoleMenuAccessSchema),
  administrationController.upsertRoleMenuAccess.bind(administrationController)
);

router.post(
  '/role-menu-access/bulk-upsert',
  requireCompanyAccess(),
  authorize({ resource: 'rbac', action: 'update' }),
  validate(bulkUpsertRoleMenuAccessSchema),
  administrationController.bulkUpsertRoleMenuAccess.bind(administrationController)
);

router.get(
  '/role-data-scope',
  requireCompanyAccess(),
  authorize({ resource: 'rbac', action: 'update' }),
  administrationController.listRoleDataScope.bind(administrationController)
);

router.post(
  '/role-data-scope',
  requireCompanyAccess(),
  authorize({ resource: 'rbac', action: 'update' }),
  validate(upsertRoleDataScopeSchema),
  administrationController.upsertRoleDataScope.bind(administrationController)
);

export default router;
