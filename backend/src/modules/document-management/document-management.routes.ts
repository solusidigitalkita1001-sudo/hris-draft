import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { documentManagementController } from './document-management.controller';

const router = Router();

const uploadDirectory = path.resolve(process.cwd(), 'uploads/documents');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
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
