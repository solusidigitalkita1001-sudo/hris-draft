import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validateFileMagicBytes } from '@/shared/middleware/FileValidation';
import { documentManagementController } from './document-management.controller';

const router = Router();

const uploadDirectory = path.resolve(process.cwd(), 'uploads/documents');
fs.mkdirSync(uploadDirectory, { recursive: true });

// HR documents: pdf, images, and Office formats. Executables carry other
// signatures (or none) and are rejected by the magic-byte check.
const DOCUMENT_ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', // Office OOXML files are zip containers
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    // Task 1.2: store under an unguessable UUID; original name is kept in DB (fileName).
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Task 1.3: public signature-verified file serve — MUST be before authenticate.
router.get('/:id/file', documentManagementController.serveSignedFile.bind(documentManagementController));

router.use(authenticate);

router.get(
  '/categories',
  authorize({ resource: 'document', action: 'read' }),
  documentManagementController.findCategories.bind(documentManagementController)
);
router.post(
  '/categories',
  authorize({ resource: 'document', action: 'create' }),
  documentManagementController.createCategory.bind(documentManagementController)
);
router.get(
  '/',
  authorize({ resource: 'document', action: 'read' }),
  documentManagementController.findDocuments.bind(documentManagementController)
);
router.get(
  '/:id',
  authorize({ resource: 'document', action: 'read' }),
  documentManagementController.findDocumentById.bind(documentManagementController)
);
router.post(
  '/',
  authorize({ resource: 'document', action: 'create' }),
  upload.single('file'),
  validateFileMagicBytes(DOCUMENT_ALLOWED_MIMES),
  documentManagementController.createDocument.bind(documentManagementController)
);
router.get(
  '/:id/signed-url',
  authorize({ resource: 'document', action: 'read' }),
  documentManagementController.getSignedUrl.bind(documentManagementController)
);
router.get(
  '/:id/download',
  authorize({ resource: 'document', action: 'read' }),
  documentManagementController.downloadDocument.bind(documentManagementController)
);

export default router;
