import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { authenticate, type AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { validateFileMagicBytes } from '@/shared/middleware/FileValidation';
import { auditLog } from '@/shared/middleware/AuditLog';
import { permissionRequestController } from './permission-request.controller';
import { createPermissionSchema, approvePermissionSchema } from './permission-request.dto';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';
import { idempotency } from '@/shared/middleware/Idempotency';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { permissionAttachmentOwnerDirectory } from '@/shared/storage/permission-attachment-reference';
import { BadRequestError } from '@/shared/exceptions/AppError';
import config from '@/config';

const router = Router();

// Lampiran izin mengikuti pola lampiran cuti: file privat per
// <companyId>/<employeeId>, nama acak (UUID), diunduh hanya lewat endpoint
// terotorisasi /private-files/permission-attachments/:permissionRequestId.
const uploadDirectory = path.resolve(process.cwd(), 'uploads/permission-requests/attachments');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req: AuthenticatedRequest, _file, cb) => {
    try {
      const directory = path.join(uploadDirectory, permissionAttachmentOwnerDirectory(req.user?.companyId, req.user?.employeeId));
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

router.get('/', authorize({ resource: 'permission-request', action: 'read' }), permissionRequestController.findAll.bind(permissionRequestController));
router.get('/my', permissionRequestController.findMyRequests.bind(permissionRequestController));
router.get('/:id', authorize({ resource: 'permission-request', action: 'read' }), permissionRequestController.findById.bind(permissionRequestController));
router.post('/', validate(createPermissionSchema), idempotency(), permissionRequestController.create.bind(permissionRequestController));
// Upload lampiran izin (lampiran SELALU wajib pada pengajuan izin).
// Tanpa authorize tambahan, konsisten dengan POST / (self-service karyawan).
router.post(
  '/attachments',
  upload.single('attachment'),
  validateFileMagicBytes(),
  permissionRequestController.uploadAttachment.bind(permissionRequestController)
);
router.patch('/:id/cancel', permissionRequestController.cancel.bind(permissionRequestController));
router.patch('/:id/approve', authorize({ resource: 'permission-request', action: 'update' }), auditLog({ action: 'APPROVE', entity: 'PermissionRequest', model: 'permissionRequest' }), validate(approvePermissionSchema), permissionRequestController.approve.bind(permissionRequestController));
router.patch('/:id/reject', authorize({ resource: 'permission-request', action: 'update' }), auditLog({ action: 'REJECT', entity: 'PermissionRequest', model: 'permissionRequest' }), validate(approvePermissionSchema), permissionRequestController.reject.bind(permissionRequestController));
router.patch('/:id/workflow-action', authorize({ resource: 'permission-request', action: 'update' }), auditLog({ action: 'WORKFLOW_ACTION', entity: 'PermissionRequest', model: 'permissionRequest' }), validate(workflowActionSchema), permissionRequestController.applyWorkflowAction.bind(permissionRequestController));

export default router;
