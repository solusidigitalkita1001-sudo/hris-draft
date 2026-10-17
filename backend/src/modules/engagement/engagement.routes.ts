import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { engagementController } from './engagement.controller';
import { createPostSchema, feedQuerySchema, giveKudosSchema, kudosQuerySchema } from './engagement.dto';
import { idParamSchema } from '@/modules/payroll/payroll.validation';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Self-service: menulis dan berterima kasih butuh identitas karyawan, bukan izin.
router.get('/posts', validate(feedQuerySchema, 'query'), engagementController.listFeed.bind(engagementController));
router.post('/posts', validate(createPostSchema), engagementController.createPost.bind(engagementController));
router.delete('/posts/:id', validate(idParamSchema, 'params'), engagementController.deleteOwnPost.bind(engagementController));
// Moderasi memakai izin kanal komunikasi yang sudah ada; diaudit karena
// menurunkan tulisan orang lain.
router.delete('/posts/:id/moderate',
  authorize({ resource: 'announcement', action: 'approve' }),
  auditLog({ action: 'MODERATE', entity: 'FeedPost', getEntityId: (req) => req.params.id as string }),
  validate(idParamSchema, 'params'),
  engagementController.moderatePost.bind(engagementController));

router.get('/kudos', validate(kudosQuerySchema, 'query'), engagementController.listKudos.bind(engagementController));
router.post('/kudos', validate(giveKudosSchema), engagementController.giveKudos.bind(engagementController));

export default router;
