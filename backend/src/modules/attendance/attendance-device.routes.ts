import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { attendanceDeviceController } from './attendance-device.controller';
import { authenticateDevice } from './attendance-device.middleware';
import {
  attendanceDeviceQuerySchema,
  attendanceDevicePunchBatchSchema,
  attendanceDevicePunchQuerySchema,
  registerAttendanceDeviceSchema,
  updateAttendanceDeviceSchema,
} from './attendance-device.dto';

const router = Router();

/**
 * Two audiences on one router, and deliberately not a shared `router.use`:
 *
 *  - the terminal posts punches with its own device credential, no session;
 *  - HR registers and inspects terminals with a normal session.
 *
 * Mixing them under one authentication middleware is how a device credential
 * ends up accepted on an HR endpoint, so each route names what it requires.
 */

// Terminal-facing. Static path first so it is never read as /:id.
router.post(
  '/punches',
  authenticateDevice,
  validate(attendanceDevicePunchBatchSchema),
  attendanceDeviceController.ingest.bind(attendanceDeviceController),
);

// HR-facing.
router.get(
  '/',
  authenticate,
  requireCompanyAccess(),
  authorize({ resource: 'attendance', action: 'read' }),
  validate(attendanceDeviceQuerySchema, 'query'),
  attendanceDeviceController.list.bind(attendanceDeviceController),
);
router.post(
  '/',
  authenticate,
  requireCompanyAccess(),
  authorize({ resource: 'attendance', action: 'create' }),
  validate(registerAttendanceDeviceSchema),
  attendanceDeviceController.register.bind(attendanceDeviceController),
);
router.patch(
  '/:id',
  authenticate,
  requireCompanyAccess(),
  authorize({ resource: 'attendance', action: 'update' }),
  validate(updateAttendanceDeviceSchema),
  attendanceDeviceController.update.bind(attendanceDeviceController),
);
router.get(
  '/:id/punches',
  authenticate,
  requireCompanyAccess(),
  authorize({ resource: 'attendance', action: 'read' }),
  validate(attendanceDevicePunchQuerySchema, 'query'),
  attendanceDeviceController.punchLog.bind(attendanceDeviceController),
);

export default router;
