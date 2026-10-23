import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { attendanceController } from './attendance.controller';
import {
  attendanceContextQuerySchema,
  attendanceQuerySchema,
  attendancePeriodQuerySchema,
  checkoutAttendanceSchema,
  createAttendanceSchema,
  myAttendanceQuerySchema,
  overtimeRequestSchema,
  selfCheckInSchema,
  selfCheckOutSchema,
  overtimeQuerySchema,
} from './attendance.dto';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';
import { idempotency } from '@/shared/middleware/Idempotency';
import multer from 'multer';
import { auditLog } from '@/shared/middleware/AuditLog';

// Memory storage: the importer parses the buffer and never needs a path.
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Employee self-service. Static paths must remain before /:id.
router.get('/me/today', attendanceController.getMyToday.bind(attendanceController));
router.get('/me', validate(myAttendanceQuerySchema, 'query'), attendanceController.findMine.bind(attendanceController));
router.post('/me/check-in', validate(selfCheckInSchema), idempotency(), attendanceController.checkInSelf.bind(attendanceController));
router.patch('/me/check-out', validate(selfCheckOutSchema), idempotency(), attendanceController.checkOutSelf.bind(attendanceController));

// Overtime. Keep these routes before /:id so GET /overtime is not interpreted
// as an attendance record whose id happens to be "overtime".
router.get('/overtime', authorize({ resource: 'attendance', action: 'read' }), validate(overtimeQuerySchema, 'query'), attendanceController.findAllOvertime.bind(attendanceController));
// Lembur diajukan karyawan untuk dirinya sendiri: controller memaksa
// employeeId dari sesi bagi siapa pun yang bukan HR/manajer, jadi pagar
// attendance:create — izin yang tidak dipegang karyawan — justru mengunci
// pengaju aslinya. HR/manajer tetap bisa mengajukan atas nama orang lain
// lewat pemeriksaan peran di controller.
router.post('/overtime', validate(overtimeRequestSchema), idempotency(), attendanceController.createOvertime.bind(attendanceController));
router.get('/overtime/:id/pay', authorize({ resource: 'attendance', action: 'read' }), attendanceController.calculateOvertimePay.bind(attendanceController));
router.patch('/overtime/:id/approve', authorize({ resource: 'attendance', action: 'approve' }), attendanceController.approveOvertime.bind(attendanceController));
router.patch('/overtime/:id/reject', authorize({ resource: 'attendance', action: 'approve' }), attendanceController.rejectOvertime.bind(attendanceController));
router.get('/overtime/:id/workflow', authorize({ resource: 'attendance', action: 'read' }), attendanceController.getOvertimeWorkflow.bind(attendanceController));
router.patch('/overtime/:id/workflow-action', authorize({ resource: 'attendance', action: 'approve' }), validate(workflowActionSchema), attendanceController.applyOvertimeWorkflowAction.bind(attendanceController));

// Attendance Records (admin/HR)
// GAP-44: riwayat absensi dari CSV (dry run via ?dryRun=true). Static path,
// declared before /:id like the others.
router.post('/import',
  authorize({ resource: 'attendance', action: 'create' }),
  auditLog({ action: 'IMPORT_ATTENDANCE_HISTORY', entity: 'Attendance' }),
  csvUpload.single('file'),
  attendanceController.importHistory.bind(attendanceController));
router.get('/', authorize({ resource: 'attendance', action: 'read' }), validate(attendanceQuerySchema, 'query'), attendanceController.findAll.bind(attendanceController));
router.get('/context', authorize({ resource: 'attendance', action: 'read' }), validate(attendanceContextQuerySchema, 'query'), attendanceController.getContext.bind(attendanceController));
router.get('/summary', authorize({ resource: 'attendance', action: 'read' }), validate(attendancePeriodQuerySchema, 'query'), attendanceController.getSummary.bind(attendanceController));
router.get('/report', authorize({ resource: 'attendance', action: 'read' }), validate(attendancePeriodQuerySchema, 'query'), attendanceController.getReport.bind(attendanceController));
router.get('/:id', authorize({ resource: 'attendance', action: 'read' }), attendanceController.findById.bind(attendanceController));
router.post('/', authorize({ resource: 'attendance', action: 'create' }), validate(createAttendanceSchema), attendanceController.create.bind(attendanceController));
router.patch('/:id/checkout', authorize({ resource: 'attendance', action: 'update' }), validate(checkoutAttendanceSchema), attendanceController.checkOut.bind(attendanceController));
router.patch('/:id/correction', authorize({ resource: 'attendance', action: 'update' }), attendanceController.correction.bind(attendanceController));
router.delete('/:id', authorize({ resource: 'attendance', action: 'delete' }), attendanceController.delete.bind(attendanceController));

export default router;
