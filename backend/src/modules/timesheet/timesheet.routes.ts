import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { timesheetController } from './timesheet.controller';
import {
  createEntrySchema, createProjectSchema, entriesQuerySchema, myEntriesQuerySchema,
  reportQuerySchema, updateEntrySchema, updateProjectSchema,
} from './timesheet.dto';
import { idParamSchema } from '@/modules/payroll/payroll.validation';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Master proyek adalah struktur kerja perusahaan → izin org yang sudah ada.
router.get('/projects', timesheetController.listProjects.bind(timesheetController));
router.post('/projects',
  authorize({ resource: 'org', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'Project' }),
  validate(createProjectSchema),
  timesheetController.createProject.bind(timesheetController));
router.patch('/projects/:id',
  authorize({ resource: 'org', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'Project', model: 'project' }),
  validate(idParamSchema, 'params'),
  validate(updateProjectSchema),
  timesheetController.updateProject.bind(timesheetController));

// Self service: jam sendiri. SUBMITTED bisa diubah/dihapus; APPROVED terkunci.
router.post('/entries', validate(createEntrySchema), timesheetController.createEntry.bind(timesheetController));
router.get('/entries/my', validate(myEntriesQuerySchema, 'query'), timesheetController.listMine.bind(timesheetController));
router.patch('/entries/:id', validate(idParamSchema, 'params'), validate(updateEntrySchema), timesheetController.updateMine.bind(timesheetController));
router.delete('/entries/:id', validate(idParamSchema, 'params'), timesheetController.deleteMine.bind(timesheetController));

// Approval & rekap.
router.get('/entries',
  authorize({ resource: 'timesheet', action: 'read' }),
  validate(entriesQuerySchema, 'query'),
  timesheetController.list.bind(timesheetController));
router.post('/entries/:id/approve',
  authorize({ resource: 'timesheet', action: 'approve' }),
  auditLog({ action: 'APPROVE', entity: 'TimesheetEntry', model: 'timesheetEntry', getEntityId: (req) => req.params.id as string }),
  validate(idParamSchema, 'params'),
  timesheetController.approve.bind(timesheetController));
router.post('/entries/:id/reject',
  authorize({ resource: 'timesheet', action: 'approve' }),
  auditLog({ action: 'REJECT', entity: 'TimesheetEntry', model: 'timesheetEntry', getEntityId: (req) => req.params.id as string }),
  validate(idParamSchema, 'params'),
  timesheetController.reject.bind(timesheetController));
router.get('/report',
  authorize({ resource: 'timesheet', action: 'read' }),
  validate(reportQuerySchema, 'query'),
  timesheetController.report.bind(timesheetController));

export default router;
