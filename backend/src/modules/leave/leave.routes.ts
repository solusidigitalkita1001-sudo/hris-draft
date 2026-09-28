import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { authenticate, type AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { discardUploadOnFailure, validateFileMagicBytes } from '@/shared/middleware/FileValidation';
import { auditLog } from '@/shared/middleware/AuditLog';
import { leaveController } from './leave.controller';
import { createLeaveTypeSchema, createLeaveRequestSchema, createLeaveBalanceSchema } from './leave.dto';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';
import { idempotency } from '@/shared/middleware/Idempotency';
import { leaveAttachmentOwnerDirectory } from '@/shared/storage/leave-attachment-reference';
import { BadRequestError } from '@/shared/exceptions/AppError';
import config from '@/config';

const router = Router();

// Lampiran cuti mengikuti pola receipt travel-expense: file privat per
// <companyId>/<employeeId>, nama acak (UUID), dan diunduh hanya lewat
// endpoint terotorisasi /private-files/leave-attachments/:leaveRequestId.
const uploadDirectory = path.resolve(process.cwd(), 'uploads/leave/attachments');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req: AuthenticatedRequest, _file, cb) => {
    try {
      const directory = path.join(uploadDirectory, leaveAttachmentOwnerDirectory(req.user?.companyId, req.user?.employeeId));
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    } catch (error) { cb(error as Error, ''); }
  },
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!config.upload.allowedMimes.includes(file.mimetype)) {
      cb(new BadRequestError('Tipe file lampiran tidak didukung'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate);
router.use(requireCompanyAccess());

// Leave Types
router.get('/types', authorize({ resource: 'leave', action: 'read' }), leaveController.findAllLeaveTypes.bind(leaveController));
router.post('/types', authorize({ resource: 'leave', action: 'create' }), auditLog({ action: 'CREATE', entity: 'LeaveType' }), validate(createLeaveTypeSchema), leaveController.createLeaveType.bind(leaveController));

// Leave Requests
router.get('/', authorize({ resource: 'leave', action: 'read' }), leaveController.findAll.bind(leaveController));
// Static balance routes must be declared before /:id.
router.get('/balances/employee', authorize({ resource: 'leave', action: 'read' }), leaveController.getBalances.bind(leaveController));
router.post('/balances', authorize({ resource: 'leave', action: 'create' }), auditLog({ action: 'SET_BALANCE', entity: 'LeaveBalance' }), validate(createLeaveBalanceSchema), leaveController.setBalance.bind(leaveController));
router.post('/balances/accrue', authorize({ resource: 'leave', action: 'create' }), auditLog({ action: 'YEARLY_ACCRUE', entity: 'LeaveBalance' }), leaveController.triggerYearlyAccrual.bind(leaveController));
router.get('/:id', authorize({ resource: 'leave', action: 'read' }), leaveController.findById.bind(leaveController));
router.post('/', authorize({ resource: 'leave', action: 'create' }), validate(createLeaveRequestSchema), idempotency(), leaveController.create.bind(leaveController));
// Upload lampiran cuti (wajib untuk pengajuan < H-7 atau tipe cuti tertentu).
router.post(
  '/attachments',
  authorize({ resource: 'leave', action: 'create' }),
  upload.single('attachment'),
  discardUploadOnFailure(),
  validateFileMagicBytes(),
  leaveController.uploadAttachment.bind(leaveController)
);
router.patch('/:id/approve', authorize({ resource: 'leave', action: 'approve' }), auditLog({ action: 'APPROVE', entity: 'LeaveRequest', model: 'leaveRequest' }), leaveController.approve.bind(leaveController));
router.patch('/:id/reject', authorize({ resource: 'leave', action: 'approve' }), auditLog({ action: 'REJECT', entity: 'LeaveRequest', model: 'leaveRequest' }), leaveController.reject.bind(leaveController));
// Self-service: ownership/permission is enforced in the service (own request
// or leave:approve), so no route-level authorize that plain employees lack.
router.patch('/:id/cancel', auditLog({ action: 'CANCEL', entity: 'LeaveRequest', model: 'leaveRequest' }), leaveController.cancel.bind(leaveController));

// Workflow integration endpoints
router.get('/:id/workflow', authorize({ resource: 'leave', action: 'read' }), leaveController.getWorkflow.bind(leaveController));
router.patch('/:id/workflow-action', authorize({ resource: 'leave', action: 'approve' }), auditLog({ action: 'WORKFLOW_ACTION', entity: 'LeaveRequest', model: 'leaveRequest' }), validate(workflowActionSchema), leaveController.applyWorkflowAction.bind(leaveController));

export default router;
