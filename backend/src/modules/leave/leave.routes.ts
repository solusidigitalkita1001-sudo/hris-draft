import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { leaveController } from './leave.controller';
import { createLeaveTypeSchema, createLeaveRequestSchema, createLeaveBalanceSchema } from './leave.dto';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Leave Types
router.get('/types', authorize({ resource: 'leave', action: 'read' }), leaveController.findAllLeaveTypes.bind(leaveController));
router.post('/types', authorize({ resource: 'leave', action: 'create' }), auditLog({ action: 'CREATE', entity: 'LeaveType' }), validate(createLeaveTypeSchema), leaveController.createLeaveType.bind(leaveController));

// Leave Requests
router.get('/', authorize({ resource: 'leave', action: 'read' }), leaveController.findAll.bind(leaveController));
router.get('/:id', authorize({ resource: 'leave', action: 'read' }), leaveController.findById.bind(leaveController));
router.post('/', authorize({ resource: 'leave', action: 'create' }), validate(createLeaveRequestSchema), leaveController.create.bind(leaveController));
router.patch('/:id/approve', authorize({ resource: 'leave', action: 'approve' }), auditLog({ action: 'APPROVE', entity: 'LeaveRequest', model: 'leaveRequest' }), leaveController.approve.bind(leaveController));
router.patch('/:id/reject', authorize({ resource: 'leave', action: 'approve' }), auditLog({ action: 'REJECT', entity: 'LeaveRequest', model: 'leaveRequest' }), leaveController.reject.bind(leaveController));

// Workflow integration endpoints
router.get('/:id/workflow', authorize({ resource: 'leave', action: 'read' }), leaveController.getWorkflow.bind(leaveController));
router.patch('/:id/workflow-action', authorize({ resource: 'leave', action: 'approve' }), auditLog({ action: 'WORKFLOW_ACTION', entity: 'LeaveRequest', model: 'leaveRequest' }), validate(workflowActionSchema), leaveController.applyWorkflowAction.bind(leaveController));

// Leave Balances
router.get('/balances/employee', authorize({ resource: 'leave', action: 'read' }), leaveController.getBalances.bind(leaveController));
router.post('/balances', authorize({ resource: 'leave', action: 'create' }), auditLog({ action: 'SET_BALANCE', entity: 'LeaveBalance' }), validate(createLeaveBalanceSchema), leaveController.setBalance.bind(leaveController));
router.post('/balances/accrue', authorize({ resource: 'leave', action: 'create' }), auditLog({ action: 'YEARLY_ACCRUE', entity: 'LeaveBalance' }), leaveController.triggerYearlyAccrual.bind(leaveController));

export default router;
