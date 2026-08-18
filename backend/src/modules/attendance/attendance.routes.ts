import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { attendanceController } from './attendance.controller';
import {
  attendanceContextQuerySchema,
  attendanceQuerySchema,
  checkoutAttendanceSchema,
  createAttendanceSchema,
  createOvertimeSchema,
} from './attendance.dto';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Attendance Records
router.get('/', authorize({ resource: 'attendance', action: 'read' }), validate(attendanceQuerySchema, 'query'), attendanceController.findAll.bind(attendanceController));
router.get('/context', authorize({ resource: 'attendance', action: 'read' }), validate(attendanceContextQuerySchema, 'query'), attendanceController.getContext.bind(attendanceController));
router.get('/summary', authorize({ resource: 'attendance', action: 'read' }), attendanceController.getSummary.bind(attendanceController));
router.get('/report', authorize({ resource: 'attendance', action: 'read' }), attendanceController.getReport.bind(attendanceController));
router.get('/:id', authorize({ resource: 'attendance', action: 'read' }), attendanceController.findById.bind(attendanceController));
router.post('/', authorize({ resource: 'attendance', action: 'create' }), validate(createAttendanceSchema), attendanceController.create.bind(attendanceController));
router.patch('/:id/checkout', authorize({ resource: 'attendance', action: 'update' }), validate(checkoutAttendanceSchema), attendanceController.checkOut.bind(attendanceController));
router.patch('/:id/correction', authorize({ resource: 'attendance', action: 'update' }), attendanceController.correction.bind(attendanceController));
router.delete('/:id', authorize({ resource: 'attendance', action: 'delete' }), attendanceController.delete.bind(attendanceController));

// Overtime
router.get('/overtime', authorize({ resource: 'attendance', action: 'read' }), attendanceController.findAllOvertime.bind(attendanceController));
router.post('/overtime', authorize({ resource: 'attendance', action: 'create' }), validate(createOvertimeSchema), attendanceController.createOvertime.bind(attendanceController));
router.get('/overtime/:id/pay', authorize({ resource: 'attendance', action: 'read' }), attendanceController.calculateOvertimePay.bind(attendanceController));
router.patch('/overtime/:id/approve', authorize({ resource: 'attendance', action: 'approve' }), attendanceController.approveOvertime.bind(attendanceController));
router.patch('/overtime/:id/reject', authorize({ resource: 'attendance', action: 'approve' }), attendanceController.rejectOvertime.bind(attendanceController));
router.get('/overtime/:id/workflow', authorize({ resource: 'attendance', action: 'read' }), attendanceController.getOvertimeWorkflow.bind(attendanceController));
router.patch('/overtime/:id/workflow-action', authorize({ resource: 'attendance', action: 'approve' }), validate(workflowActionSchema), attendanceController.applyOvertimeWorkflowAction.bind(attendanceController));

export default router;
