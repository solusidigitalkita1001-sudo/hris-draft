import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { helpdeskController } from './helpdesk.controller';
import { commentSchema, createTicketSchema, ticketQuerySchema, updateTicketSchema } from './helpdesk.dto';
import { idParamSchema } from '@/modules/payroll/payroll.validation';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Self service: setiap karyawan boleh bertanya ke HR — tidak ada izin untuk
// itu, hanya autentikasi. Yang berizin adalah antrian perusahaan di bawah.
router.post('/my', validate(createTicketSchema), helpdeskController.createMine.bind(helpdeskController));
router.get('/my', helpdeskController.listMine.bind(helpdeskController));
router.post('/my/:id/comments', validate(idParamSchema, 'params'), validate(commentSchema), helpdeskController.commentMine.bind(helpdeskController));
router.post('/my/:id/close', validate(idParamSchema, 'params'), helpdeskController.closeMine.bind(helpdeskController));

// HR queue.
router.get('/queue',
  authorize({ resource: 'helpdesk', action: 'read' }),
  validate(ticketQuerySchema, 'query'),
  helpdeskController.listQueue.bind(helpdeskController));
router.get('/:id',
  authorize({ resource: 'helpdesk', action: 'read' }),
  validate(idParamSchema, 'params'),
  helpdeskController.getOne.bind(helpdeskController));
router.patch('/:id',
  authorize({ resource: 'helpdesk', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'HrTicket', model: 'hrTicket', getEntityId: (req) => req.params.id as string }),
  validate(idParamSchema, 'params'),
  validate(updateTicketSchema),
  helpdeskController.update.bind(helpdeskController));
router.post('/:id/comments',
  authorize({ resource: 'helpdesk', action: 'update' }),
  auditLog({ action: 'COMMENT', entity: 'HrTicket', getEntityId: (req) => req.params.id as string }),
  validate(idParamSchema, 'params'),
  validate(commentSchema),
  helpdeskController.comment.bind(helpdeskController));

export default router;
