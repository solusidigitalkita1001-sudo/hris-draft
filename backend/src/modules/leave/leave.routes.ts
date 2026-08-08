import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { leaveController } from './leave.controller';
import { createLeaveTypeSchema, createLeaveRequestSchema, createLeaveBalanceSchema } from './leave.dto';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Leave Types
router.get('/types', authorize({ resource: 'leave', action: 'read' }), leaveController.findAllLeaveTypes.bind(leaveController));
router.post('/types', authorize({ resource: 'leave', action: 'create' }), validate(createLeaveTypeSchema), leaveController.createLeaveType.bind(leaveController));

// Leave Requests
router.get('/', authorize({ resource: 'leave', action: 'read' }), leaveController.findAll.bind(leaveController));
router.get('/:id', authorize({ resource: 'leave', action: 'read' }), leaveController.findById.bind(leaveController));
router.post('/', authorize({ resource: 'leave', action: 'create' }), validate(createLeaveRequestSchema), leaveController.create.bind(leaveController));
router.patch('/:id/approve', authorize({ resource: 'leave', action: 'approve' }), leaveController.approve.bind(leaveController));
router.patch('/:id/reject', authorize({ resource: 'leave', action: 'approve' }), leaveController.reject.bind(leaveController));

// Leave Balances
router.get('/balances/employee', authorize({ resource: 'leave', action: 'read' }), leaveController.getBalances.bind(leaveController));
router.post('/balances', authorize({ resource: 'leave', action: 'create' }), validate(createLeaveBalanceSchema), leaveController.setBalance.bind(leaveController));

export default router;
