import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { parsePagination } from '@/shared/middleware/Pagination';
import { payrollController } from './payroll.controller';
import {
  createSalaryComponentSchema,
  updateSalaryComponentSchema,
  createEmployeeSalarySchema,
  updateEmployeeSalarySchema,
  createPayrollPeriodSchema,
  updatePayrollPeriodSchema,
  createPayrollRunSchema,
  calculatePph21Schema,
  calculateThrStandaloneSchema,
  calculateBpjsSchema,
  calculateJknSchema,
} from './payroll.dto';
import { idParamSchema, payrollRunIdParamSchema, payslipIdParamSchema } from './payroll.validation';
import { auditLog } from '@/shared/middleware/AuditLog';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireCompanyAccess());

// ==================== Salary Components ====================
router.get(
  '/salary-components',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.findAllSalaryComponents.bind(payrollController)
);

router.get(
  '/salary-components/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(idParamSchema, 'params'),
  payrollController.findSalaryComponentById.bind(payrollController)
);

router.post(
  '/salary-components',
  authorize({ resource: 'payroll', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'SalaryComponent' }),
  validate(createSalaryComponentSchema, 'body'),
  payrollController.createSalaryComponent.bind(payrollController)
);

router.patch(
  '/salary-components/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'SalaryComponent', model: 'salaryComponent' }),
  validate(idParamSchema, 'params'),
  validate(updateSalaryComponentSchema, 'body'),
  payrollController.updateSalaryComponent.bind(payrollController)
);

router.delete(
  '/salary-components/:id',
  authorize({ resource: 'payroll', action: 'delete' }),
  auditLog({ action: 'DELETE', entity: 'SalaryComponent', model: 'salaryComponent' }),
  validate(idParamSchema, 'params'),
  payrollController.deleteSalaryComponent.bind(payrollController)
);

// ==================== Employee Salaries ====================
router.get(
  '/employee-salaries',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.findAllEmployeeSalaries.bind(payrollController)
);

router.get(
  '/employee-salaries/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(idParamSchema, 'params'),
  payrollController.findEmployeeSalaryById.bind(payrollController)
);

router.post(
  '/employee-salaries',
  authorize({ resource: 'payroll', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'EmployeeSalary' }),
  validate(createEmployeeSalarySchema, 'body'),
  payrollController.createEmployeeSalary.bind(payrollController)
);

router.patch(
  '/employee-salaries/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'EmployeeSalary', model: 'employeeSalary' }),
  validate(idParamSchema, 'params'),
  validate(updateEmployeeSalarySchema, 'body'),
  payrollController.updateEmployeeSalary.bind(payrollController)
);

router.get(
  '/employees/:employeeId/thr',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.calculateEmployeeThr.bind(payrollController)
);

// ==================== Standalone Calculation Endpoints (B.1, B.2, B.3) ====================
router.post(
  '/calculate-pph21',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(calculatePph21Schema, 'body'),
  payrollController.calculatePph21.bind(payrollController)
);
router.post(
  '/calculate-thr',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(calculateThrStandaloneSchema, 'body'),
  payrollController.calculateThrStandalone.bind(payrollController)
);
router.post(
  '/calculate-bpjs',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(calculateBpjsSchema, 'body'),
  payrollController.calculateBpjs.bind(payrollController)
);
router.post(
  '/calculate-jkn',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(calculateJknSchema, 'body'),
  payrollController.calculateJkn.bind(payrollController)
);

// ==================== Payroll Periods ====================
router.get(
  '/periods',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.findAllPayrollPeriods.bind(payrollController)
);

router.get(
  '/periods/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(idParamSchema, 'params'),
  payrollController.findPayrollPeriodById.bind(payrollController)
);

router.post(
  '/periods',
  authorize({ resource: 'payroll', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'PayrollPeriod' }),
  validate(createPayrollPeriodSchema, 'body'),
  payrollController.createPayrollPeriod.bind(payrollController)
);

router.patch(
  '/periods/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'PayrollPeriod', model: 'payrollPeriod' }),
  validate(idParamSchema, 'params'),
  validate(updatePayrollPeriodSchema, 'body'),
  payrollController.updatePayrollPeriod.bind(payrollController)
);

router.patch(
  '/periods/:id/close',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'CLOSE_PERIOD', entity: 'PayrollPeriod', model: 'payrollPeriod' }),
  validate(idParamSchema, 'params'),
  payrollController.closePayrollPeriod.bind(payrollController)
);
router.get(
  '/periods/:id/attendance-summary',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.getAttendanceSummary.bind(payrollController)
);
router.put(
  '/periods/:id/confirm-attendance',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'CONFIRM_ATTENDANCE', entity: 'PayrollPeriod', model: 'payrollPeriod' }),
  payrollController.confirmAttendanceReview.bind(payrollController)
);

// ==================== Payroll Runs ====================
router.get(
  '/runs',
  authorize({ resource: 'payroll', action: 'read' }),
  parsePagination,
  payrollController.findAllPayrollRuns.bind(payrollController)
);

router.get(
  '/runs/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payrollRunIdParamSchema, 'params'),
  payrollController.findPayrollRunById.bind(payrollController)
);

router.post(
  '/runs',
  authorize({ resource: 'payroll', action: 'process' }),
  auditLog({ action: 'CREATE_RUN', entity: 'PayrollRun' }),
  validate(createPayrollRunSchema, 'body'),
  payrollController.createPayrollRun.bind(payrollController)
);

router.patch(
  '/runs/:id/approve',
  authorize({ resource: 'payroll', action: 'approve' }),
  auditLog({ action: 'APPROVE', entity: 'PayrollRun', model: 'payrollRun', getEntityId: (req) => req.params.id as string }),
  validate(payrollRunIdParamSchema, 'params'),
  payrollController.approvePayrollRun.bind(payrollController)
);

router.patch(
  '/runs/:id/disburse',
  authorize({ resource: 'payroll', action: 'disburse' }),
  auditLog({ action: 'DISBURSE', entity: 'PayrollRun', model: 'payrollRun', getEntityId: (req) => req.params.id as string }),
  validate(payrollRunIdParamSchema, 'params'),
  payrollController.disbursePayrollRun.bind(payrollController)
);

// B.6 Multibank Disbursement CSV Export Endpoint
router.get(
  '/runs/:id/disbursements',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payrollRunIdParamSchema, 'params'),
  payrollController.getDisbursements.bind(payrollController)
);

// ==================== Payslips ====================
router.get(
  '/payslips/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payslipIdParamSchema, 'params'),
  payrollController.findPayslipById.bind(payrollController)
);

router.get(
  '/payslips',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.findMyPayslips.bind(payrollController)
);

export default router;
