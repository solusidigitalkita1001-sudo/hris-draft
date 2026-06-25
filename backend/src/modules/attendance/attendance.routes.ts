import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { attendanceController } from './attendance.controller';
import { createAttendanceSchema, createOvertimeSchema } from './attendance.dto';

const router = Router();
router.use(authenticate);

// Attendance Records
router.get('/', authorize({ resource: 'attendance', action: 'read' }), attendanceController.findAll.bind(attendanceController));
router.get('/:id', authorize({ resource: 'attendance', action: 'read' }), attendanceController.findById.bind(attendanceController));
router.post('/', authorize({ resource: 'attendance', action: 'create' }), validate(createAttendanceSchema), attendanceController.create.bind(attendanceController));
router.patch('/:id/checkout', authorize({ resource: 'attendance', action: 'update' }), attendanceController.checkOut.bind(attendanceController));
router.delete('/:id', authorize({ resource: 'attendance', action: 'delete' }), attendanceController.delete.bind(attendanceController));

// Overtime
router.get('/overtime', authorize({ resource: 'attendance', action: 'read' }), attendanceController.findAllOvertime.bind(attendanceController));
router.post('/overtime', authorize({ resource: 'attendance', action: 'create' }), validate(createOvertimeSchema), attendanceController.createOvertime.bind(attendanceController));
router.patch('/overtime/:id/approve', authorize({ resource: 'attendance', action: 'approve' }), attendanceController.approveOvertime.bind(attendanceController));
router.patch('/overtime/:id/reject', authorize({ resource: 'attendance', action: 'approve' }), attendanceController.rejectOvertime.bind(attendanceController));

export default router;
