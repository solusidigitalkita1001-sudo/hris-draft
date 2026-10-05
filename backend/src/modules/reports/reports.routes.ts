import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { reportsController } from './reports.controller';
import {
  attendanceReportQuerySchema,
  dashboardSummaryQuerySchema,
  headcountReportQuerySchema,
  leaveBalanceReportQuerySchema,
  leaveReportQuerySchema,
  payrollReportQuerySchema,
  recruitmentReportQuerySchema,
  turnoverReportQuerySchema,
} from './reports.dto';
import { validate } from '@/shared/middleware/RequestValidator';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { auditView } from '@/shared/middleware/AuditLog';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// `/summary` was the one report route with no authorize(): it returns
// company-wide headcount, attendance and leave figures to anyone holding
// company access. Every sibling route gates on report:read, and nothing
// called this endpoint — `getDashboardSummary` exists in the frontend service
// with no caller — so closing it costs nothing.
router.get('/summary', authorize({ resource: 'report', action: 'read' }), validate(dashboardSummaryQuerySchema, 'query'), reportsController.dashboardSummary.bind(reportsController));
router.get('/headcount', authorize({ resource: 'report', action: 'read' }), validate(headcountReportQuerySchema, 'query'), reportsController.headcount.bind(reportsController));
router.get('/attendance', authorize({ resource: 'report', action: 'read' }), validate(attendanceReportQuerySchema, 'query'), reportsController.attendance.bind(reportsController));
router.get('/leave', authorize({ resource: 'report', action: 'read' }), validate(leaveReportQuerySchema, 'query'), reportsController.leave.bind(reportsController));
router.get('/payroll', authorize({ resource: 'report', action: 'read' }), validate(payrollReportQuerySchema, 'query'), auditView({ action: 'VIEW_PAYROLL_REPORT', entity: 'Report' }), reportsController.payroll.bind(reportsController));
router.get('/leave-balance', authorize({ resource: 'report', action: 'read' }), validate(leaveBalanceReportQuerySchema, 'query'), reportsController.leaveBalance.bind(reportsController));
router.get('/turnover', authorize({ resource: 'report', action: 'read' }), validate(turnoverReportQuerySchema, 'query'), reportsController.turnover.bind(reportsController));
router.get('/recruitment', authorize({ resource: 'report', action: 'read' }), validate(recruitmentReportQuerySchema, 'query'), reportsController.recruitment.bind(reportsController));

export default router;
