import { Router } from 'express';
import {
  createEWARequestSchema,
  approveEWARequestSchema,
  rejectEWARequestSchema,
  markPaidEWARequestSchema,
  listEWARequestsSchema,
} from './ewa.dto';
import { validate } from '@/shared/middleware/RequestValidator';
import { authorize } from '@/shared/middleware/Authorize';
import { ewaController } from './ewa.controller';
import { auditLog } from '@/shared/middleware/AuditLog';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();

// Authentication must run before authorization so req.user and the
// AsyncLocalStorage tenant context are available to every downstream query.
router.use(authenticate);
router.use(requireCompanyAccess());

router.get(
  '/my',
  authorize({ resource: 'ewa', action: 'read' }),
  validate(listEWARequestsSchema, 'query'),
  ewaController.getMyRequests.bind(ewaController),
);
router.get(
  '/my/limit',
  authorize({ resource: 'ewa', action: 'read' }),
  ewaController.getMyLimit.bind(ewaController),
);
router.post(
  '/',
  authorize({ resource: 'ewa', action: 'create' }),
  validate(createEWARequestSchema),
  auditLog({ action: 'create', entity: 'EWA_Request', model: 'EarnedWageAccess' }),
  ewaController.createRequest.bind(ewaController),
);
router.get(
  '/:id',
  authorize({ resource: 'ewa', action: 'read' }),
  ewaController.getRequestById.bind(ewaController),
);
router.post(
  '/:id/cancel',
  authorize({ resource: 'ewa', action: 'update' }),
  auditLog({ action: 'cancel', entity: 'EWA_Request', model: 'EarnedWageAccess' }),
  ewaController.cancelRequest.bind(ewaController),
);
router.post(
  '/:id/approve',
  authorize({ resource: 'ewa', action: 'approve' }),
  validate(approveEWARequestSchema),
  auditLog({ action: 'approve', entity: 'EWA_Request', model: 'EarnedWageAccess' }),
  ewaController.approveRequest.bind(ewaController),
);
router.post(
  '/:id/reject',
  authorize({ resource: 'ewa', action: 'approve' }),
  validate(rejectEWARequestSchema),
  auditLog({ action: 'reject', entity: 'EWA_Request', model: 'EarnedWageAccess' }),
  ewaController.rejectRequest.bind(ewaController),
);
router.post(
  '/:id/mark-paid',
  authorize({ resource: 'ewa', action: 'disburse' }),
  validate(markPaidEWARequestSchema),
  auditLog({ action: 'disburse', entity: 'EWA_Request', model: 'EarnedWageAccess' }),
  ewaController.markPaid.bind(ewaController),
);
router.get(
  '/',
  authorize({ resource: 'ewa', action: 'read' }),
  validate(listEWARequestsSchema, 'query'),
  ewaController.listRequests.bind(ewaController),
);

export default router;
