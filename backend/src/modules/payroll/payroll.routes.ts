import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
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
  createPayrollRunSchema,
} from './payroll.dto';
import { idParamSchema } from './payroll.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

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
  validate(createSalaryComponentSchema, 'body'),
  payrollController.createSalaryComponent.bind(payrollController)
);

router.patch(
  '/salary-components/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  validate(idParamSchema, 'params'),
  validate(updateSalaryComponentSchema, 'body'),
  payrollController.updateSalaryComponent.bind(payrollController)
);

router.delete(
  '/salary-components/:id',
  authorize({ resource: 'payroll', action: 'delete' }),
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
  validate(createEmployeeSalarySchema, 'body'),
  payrollController.createEmployeeSalary.bind(payrollController)
);

router.patch(
  '/employee-salaries/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  validate(idParamSchema, 'params'),
  validate(updateEmployeeSalarySchema, 'body'),
  payrollController.updateEmployeeSalary.bind(payrollController)
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
  validate(createPayrollPeriodSchema, 'body'),
  payrollController.createPayrollPeriod.bind(payrollController)
);

router.patch(
  '/periods/:id/close',
  authorize({ resource: 'payroll', action: 'update' }),
  validate(idParamSchema, 'params'),
  payrollController.closePayrollPeriod.bind(payrollController)
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
  validate(idParamSchema, 'params'),
  payrollController.findPayrollRunById.bind(payrollController)
);

router.post(
  '/runs',
  authorize({ resource: 'payroll', action: 'process' }),
  validate(createPayrollRunSchema, 'body'),
  payrollController.createPayrollRun.bind(payrollController)
);

router.patch(
  '/runs/:id/approve',
  authorize({ resource: 'payroll', action: 'approve' }),
  validate(idParamSchema, 'params'),
  payrollController.approvePayrollRun.bind(payrollController)
);

router.patch(
  '/runs/:id/disburse',
  authorize({ resource: 'payroll', action: 'approve' }),
  validate(idParamSchema, 'params'),
  payrollController.disbursePayrollRun.bind(payrollController)
);

// ==================== Payslips ====================
router.get(
  '/payslips/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(idParamSchema, 'params'),
  payrollController.findPayslipById.bind(payrollController)
);

router.get(
  '/payslips',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.findMyPayslips.bind(payrollController)
);

export default router;
