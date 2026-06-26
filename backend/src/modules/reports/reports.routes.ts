import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { reportsController } from './reports.controller';

const router = Router();
router.use(authenticate);

router.get('/headcount', authorize({ resource: 'report', action: 'read' }), reportsController.headcount.bind(reportsController));
router.get('/attendance', authorize({ resource: 'report', action: 'read' }), reportsController.attendance.bind(reportsController));
router.get('/leave', authorize({ resource: 'report', action: 'read' }), reportsController.leave.bind(reportsController));
router.get('/payroll', authorize({ resource: 'report', action: 'read' }), reportsController.payroll.bind(reportsController));
router.get('/turnover', authorize({ resource: 'report', action: 'read' }), reportsController.turnover.bind(reportsController));
router.get('/recruitment', authorize({ resource: 'report', action: 'read' }), reportsController.recruitment.bind(reportsController));

export default router;
