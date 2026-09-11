import { Router } from 'express';
import {
  createEWARequestSchema,
  approveEWARequestSchema,
  rejectEWARequestSchema,
  markPaidEWARequestSchema,
  listEWARequestsSchema,
  ewaIdParamSchema,
  ewaLimitQuerySchema,
} from './ewa.dto';
import { validate } from '@/shared/middleware/RequestValidator';
import { authorize } from '@/shared/middleware/Authorize';
import { ewaController } from './ewa.controller';
import { auditLog } from '@/shared/middleware/AuditLog';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { EWA_AUDIT_REDACTIONS } from './ewa-access';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Authentication must run before authorization so req.user and the
// AsyncLocalStorage tenant context are available to every downstream query.
router.use(authenticate);
router.use(requireCompanyAccess());

// Self-service: any authenticated employee reads their OWN EWA. The controller
// scopes strictly to the caller's employeeId, so no admin-level 'ewa:read'
// permission is required (that permission is for reading others' records).
router.get(
  '/my',
  validate(listEWARequestsSchema, 'query'),
  ewaController.getMyRequests.bind(ewaController),
);
router.get(
  '/my/limit',
  validate(ewaLimitQuerySchema, 'query'),
  ewaController.getMyLimit.bind(ewaController),
);
router.post(
  '/',
  authorize({ resource: 'ewa', action: 'create' }),
  validate(createEWARequestSchema),
  auditLog({ action: 'create', entity: 'EWA_Request', model: 'earnedWageAccess', redactFields: EWA_AUDIT_REDACTIONS }),
  ewaController.createRequest.bind(ewaController),
);
router.get(
  '/:id',
  authorize({ resource: 'ewa', action: 'read' }),
  validate(ewaIdParamSchema, 'params'),
  ewaController.getRequestById.bind(ewaController),
);
router.post(
  '/:id/cancel',
  authorize({ resource: 'ewa', action: 'update' }),
  validate(ewaIdParamSchema, 'params'),
  auditLog({ action: 'cancel', entity: 'EWA_Request', model: 'earnedWageAccess', redactFields: EWA_AUDIT_REDACTIONS }),
  ewaController.cancelRequest.bind(ewaController),
);
router.post(
  '/:id/approve',
  authorize({ resource: 'ewa', action: 'approve' }),
  validate(ewaIdParamSchema, 'params'),
  validate(approveEWARequestSchema),
  auditLog({ action: 'approve', entity: 'EWA_Request', model: 'earnedWageAccess', redactFields: EWA_AUDIT_REDACTIONS }),
  ewaController.approveRequest.bind(ewaController),
);
router.post(
  '/:id/reject',
  authorize({ resource: 'ewa', action: 'approve' }),
  validate(ewaIdParamSchema, 'params'),
  validate(rejectEWARequestSchema),
  auditLog({ action: 'reject', entity: 'EWA_Request', model: 'earnedWageAccess', redactFields: EWA_AUDIT_REDACTIONS }),
  ewaController.rejectRequest.bind(ewaController),
);
router.post(
  '/:id/mark-paid',
  authorize({ resource: 'ewa', action: 'disburse' }),
  validate(ewaIdParamSchema, 'params'),
  validate(markPaidEWARequestSchema),
  auditLog({ action: 'disburse', entity: 'EWA_Request', model: 'earnedWageAccess', redactFields: EWA_AUDIT_REDACTIONS }),
  ewaController.markPaid.bind(ewaController),
);
router.get(
  '/',
  authorize({ resource: 'ewa', action: 'read' }),
  validate(listEWARequestsSchema, 'query'),
  ewaController.listRequests.bind(ewaController),
);

export default router;
