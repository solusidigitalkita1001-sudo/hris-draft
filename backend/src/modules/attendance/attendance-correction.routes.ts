import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { attendanceCorrectionController } from './attendance-correction.controller';
import { validate } from '@/shared/middleware/RequestValidator';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';
import {
  attendanceCorrectionListQuerySchema,
  createAttendanceCorrectionSchema,
  rejectAttendanceCorrectionSchema,
} from './attendance-correction.dto';
import { idempotency } from '@/shared/middleware/Idempotency';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/my', validate(attendanceCorrectionListQuerySchema.pick({ status: true }), 'query'), attendanceCorrectionController.findMine.bind(attendanceCorrectionController));
router.get('/my/:id', attendanceCorrectionController.findMineById.bind(attendanceCorrectionController));
router.get('/', authorize({ resource: 'attendance', action: 'read' }), validate(attendanceCorrectionListQuerySchema, 'query'), attendanceCorrectionController.findAll.bind(attendanceCorrectionController));
router.get('/:id', authorize({ resource: 'attendance', action: 'read' }), attendanceCorrectionController.findById.bind(attendanceCorrectionController));
router.post('/', validate(createAttendanceCorrectionSchema), idempotency(), attendanceCorrectionController.create.bind(attendanceCorrectionController));
router.put('/:id/approve', authorize({ resource: 'attendance', action: 'update' }), attendanceCorrectionController.approve.bind(attendanceCorrectionController));
router.put('/:id/reject', authorize({ resource: 'attendance', action: 'update' }), validate(rejectAttendanceCorrectionSchema), attendanceCorrectionController.reject.bind(attendanceCorrectionController));
router.patch('/:id/workflow-action', authorize({ resource: 'attendance', action: 'update' }), validate(workflowActionSchema), attendanceCorrectionController.applyWorkflowAction.bind(attendanceCorrectionController));

export default router;
