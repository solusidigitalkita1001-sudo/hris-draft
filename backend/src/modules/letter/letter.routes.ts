import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog, auditView } from '@/shared/middleware/AuditLog';
import { letterController } from './letter.controller';
import { renderLetterSchema, upsertLetterTemplateSchema } from './letter.dto';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Reads follow document:read, writes document:update — a letter template is
// document content, and the same people who manage documents own it.
router.get('/placeholders', authorize({ resource: 'document', action: 'read' }), letterController.placeholders.bind(letterController));
router.get('/templates', authorize({ resource: 'document', action: 'read' }), letterController.list.bind(letterController));

router.put(
  '/templates',
  authorize({ resource: 'document', action: 'update' }),
  auditLog({ action: 'UPSERT_LETTER_TEMPLATE', entity: 'LetterTemplate' }),
  validate(upsertLetterTemplateSchema),
  letterController.upsert.bind(letterController),
);

router.delete(
  '/templates/:id',
  authorize({ resource: 'document', action: 'delete' }),
  auditLog({ action: 'DEACTIVATE_LETTER_TEMPLATE', entity: 'LetterTemplate', model: 'letterTemplate' }),
  letterController.remove.bind(letterController),
);

// Rendering reads an employee's details into a document, so it is audit-viewed
// like every other read of that data — a letter must not be a quiet way out.
router.post(
  '/templates/:id/render',
  authorize({ resource: 'document', action: 'read' }),
  auditView({ action: 'RENDER_LETTER', entity: 'Employee' }),
  validate(renderLetterSchema),
  letterController.render.bind(letterController),
);

export default router;
