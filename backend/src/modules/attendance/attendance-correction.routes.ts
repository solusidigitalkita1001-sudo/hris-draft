import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { attendanceCorrectionController } from './attendance-correction.controller';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/', authorize({ resource: 'attendance', action: 'read' }), attendanceCorrectionController.findAll.bind(attendanceCorrectionController));
router.get('/:id', authorize({ resource: 'attendance', action: 'read' }), attendanceCorrectionController.findById.bind(attendanceCorrectionController));
router.post('/', authorize({ resource: 'attendance', action: 'create' }), attendanceCorrectionController.create.bind(attendanceCorrectionController));
router.put('/:id/approve', authorize({ resource: 'attendance', action: 'update' }), attendanceCorrectionController.approve.bind(attendanceCorrectionController));
router.put('/:id/reject', authorize({ resource: 'attendance', action: 'update' }), attendanceCorrectionController.reject.bind(attendanceCorrectionController));

export default router;
