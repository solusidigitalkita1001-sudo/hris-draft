import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { reportsController } from './reports.controller';
import {
  attendanceReportQuerySchema,
  dashboardSummaryQuerySchema,
  headcountReportQuerySchema,
  leaveReportQuerySchema,
  payrollReportQuerySchema,
  recruitmentReportQuerySchema,
  turnoverReportQuerySchema,
} from './reports.dto';
import { validate } from '@/shared/middleware/RequestValidator';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/summary', validate(dashboardSummaryQuerySchema, 'query'), reportsController.dashboardSummary.bind(reportsController));
router.get('/headcount', authorize({ resource: 'report', action: 'read' }), validate(headcountReportQuerySchema, 'query'), reportsController.headcount.bind(reportsController));
router.get('/attendance', authorize({ resource: 'report', action: 'read' }), validate(attendanceReportQuerySchema, 'query'), reportsController.attendance.bind(reportsController));
router.get('/leave', authorize({ resource: 'report', action: 'read' }), validate(leaveReportQuerySchema, 'query'), reportsController.leave.bind(reportsController));
router.get('/payroll', authorize({ resource: 'report', action: 'read' }), validate(payrollReportQuerySchema, 'query'), reportsController.payroll.bind(reportsController));
router.get('/turnover', authorize({ resource: 'report', action: 'read' }), validate(turnoverReportQuerySchema, 'query'), reportsController.turnover.bind(reportsController));
router.get('/recruitment', authorize({ resource: 'report', action: 'read' }), validate(recruitmentReportQuerySchema, 'query'), reportsController.recruitment.bind(reportsController));

export default router;
