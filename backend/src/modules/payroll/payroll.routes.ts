import multer from 'multer';
import { Router } from 'express';
import payrollPaymentRoutes from './payroll-payment.routes';
import payrollFormulaRoutes from './payroll-formula.routes';
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
import { idParamSchema, payrollRunIdParamSchema, payslipIdParamSchema, employeeSalaryListQuerySchema, employeeThrParamSchema, employeeThrQuerySchema, payrollUnlockSchema, setPayslipPinSchema, payslipPinUnlockSchema } from './payroll.validation';
import { rateLimit } from 'express-rate-limit';
import { auditLog, auditView } from '@/shared/middleware/AuditLog';
import { requireCompanyPayrollAccess } from './payroll-access';
import { annualTaxRecapQuerySchema, arrearsQuerySchema, bpjsReportQuerySchema, registerArrearsSchema } from './payroll-arrears.dto';

// Memory storage: the importer parses the buffer and never needs a path.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.use('/payment-batches', payrollPaymentRoutes);
router.use('/formulas', payrollFormulaRoutes);
router.use(['/employee-salaries', '/employees/:employeeId/thr', '/runs', '/periods', '/payslips', '/arrears', '/annual-tax-recap', '/bukti-potong-1721-a1', '/bpjs-report', '/sipp-wage-export'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// All routes require authentication
router.use(authenticate);
router.use(requireCompanyAccess());
// These resources contain company totals or operate on every employee. Guard
// before audit middleware can read the old aggregate record.
router.use(['/runs', '/periods'], requireCompanyPayrollAccess);

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
  validate(employeeSalaryListQuerySchema, 'query'),
  auditView({ action: 'VIEW_SALARY_LIST', entity: 'EmployeeSalary' }),
  payrollController.findAllEmployeeSalaries.bind(payrollController)
);

router.get(
  '/employee-salaries/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(idParamSchema, 'params'),
  auditView({ action: 'VIEW_SALARY', entity: 'EmployeeSalary' }),
  payrollController.findEmployeeSalaryById.bind(payrollController)
);

router.post(
  '/employee-salaries',
  authorize({ resource: 'payroll', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'EmployeeSalary', redactFields: ['baseSalary', 'components', 'notes', 'employee'] }),
  validate(createEmployeeSalarySchema, 'body'),
  payrollController.createEmployeeSalary.bind(payrollController)
);

router.patch(
  '/employee-salaries/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'EmployeeSalary', model: 'employeeSalary', redactFields: ['baseSalary', 'components', 'notes', 'employee'] }),
  validate(idParamSchema, 'params'),
  validate(updateEmployeeSalarySchema, 'body'),
  payrollController.updateEmployeeSalary.bind(payrollController)
);

router.get(
  '/employees/:employeeId/thr',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(employeeThrParamSchema, 'params'),
  validate(employeeThrQuerySchema, 'query'),
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

// ==================== Laporan iuran BPJS bulanan ====================
// Includes the employer share, which payslips never show — and which is most of
// what BPJS is owed.
router.get(
  '/bpjs-report',
  authorize({ resource: 'payroll', action: 'read' }),
  requireCompanyPayrollAccess,
  validate(bpjsReportQuerySchema, 'query'),
  auditView({ action: 'VIEW_BPJS_REPORT', entity: 'PayrollPeriod' }),
  payrollController.bpjsReport.bind(payrollController)
);

// The same wages, shaped to fill SIPP Online's Upload Upah template. Not an
// upload file: SIPP issues the template per company and defines its structure.
router.get(
  '/sipp-wage-export',
  authorize({ resource: 'payroll', action: 'read' }),
  requireCompanyPayrollAccess,
  validate(bpjsReportQuerySchema, 'query'),
  auditView({ action: 'VIEW_SIPP_WAGE_EXPORT', entity: 'PayrollPeriod' }),
  payrollController.sippWageExport.bind(payrollController)
);

// ==================== Rekap PPh21 tahunan (bahan 1721-A1) ====================
// Figures only, and no-store: an annual recap is a year of one person's income
// in a single response.
router.get(
  '/annual-tax-recap',
  authorize({ resource: 'payroll', action: 'read' }),
  requireCompanyPayrollAccess,
  validate(annualTaxRecapQuerySchema, 'query'),
  payrollController.annualTaxRecapSummary.bind(payrollController)
);

router.get(
  '/annual-tax-recap/:employeeId',
  authorize({ resource: 'payroll', action: 'read' }),
  requireCompanyPayrollAccess,
  validate(annualTaxRecapQuerySchema, 'query'),
  auditView({ action: 'VIEW_ANNUAL_TAX_RECAP', entity: 'Payslip' }),
  payrollController.annualTaxRecap.bind(payrollController)
);

// The same figures laid out as Formulir 1721-A1. Registered after
// '/annual-tax-recap/:employeeId' would have swallowed it, so it comes first.
router.get(
  '/bukti-potong-1721-a1/:employeeId',
  authorize({ resource: 'payroll', action: 'read' }),
  requireCompanyPayrollAccess,
  validate(annualTaxRecapQuerySchema, 'query'),
  auditView({ action: 'VIEW_BUKTI_POTONG_1721_A1', entity: 'Payslip' }),
  payrollController.buktiPotong1721A1.bind(payrollController)
);

// ==================== Arrears (rapel periode tertutup) ====================
// Money for a period that can no longer be re-run, so the same guards as runs:
// payroll company access before the audit middleware reads anything.
router.get(
  '/arrears',
  authorize({ resource: 'payroll', action: 'read' }),
  requireCompanyPayrollAccess,
  validate(arrearsQuerySchema, 'query'),
  payrollController.findAllArrears.bind(payrollController)
);

router.post(
  '/arrears',
  authorize({ resource: 'payroll', action: 'create' }),
  requireCompanyPayrollAccess,
  auditLog({ action: 'CREATE', entity: 'PayrollArrears' }),
  validate(registerArrearsSchema, 'body'),
  payrollController.registerArrears.bind(payrollController)
);

router.delete(
  '/arrears/:id',
  authorize({ resource: 'payroll', action: 'update' }),
  requireCompanyPayrollAccess,
  auditLog({ action: 'CANCEL', entity: 'PayrollArrears', model: 'payrollArrears' }),
  validate(idParamSchema, 'params'),
  payrollController.cancelArrears.bind(payrollController)
);

// ==================== Payroll Periods ====================
router.get(
  '/periods',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(employeeSalaryListQuerySchema.pick({ companyId: true }), 'query'),
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
  validate(idParamSchema, 'params'),
  payrollController.getAttendanceSummary.bind(payrollController)
);
router.put(
  '/periods/:id/confirm-attendance',
  authorize({ resource: 'payroll', action: 'update' }),
  auditLog({ action: 'CONFIRM_ATTENDANCE', entity: 'PayrollPeriod', model: 'payrollPeriod' }),
  validate(idParamSchema, 'params'),
  payrollController.confirmAttendanceReview.bind(payrollController)
);

// ==================== Payroll Runs ====================
router.get(
  '/runs',
  authorize({ resource: 'payroll', action: 'read' }),
  parsePagination,
  validate(employeeSalaryListQuerySchema.pick({ companyId: true }), 'query'),
  payrollController.findAllPayrollRuns.bind(payrollController)
);

router.get(
  '/runs/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payrollRunIdParamSchema, 'params'),
  payrollController.findPayrollRunById.bind(payrollController)
);

router.get(
  '/runs/:id/journal',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payrollRunIdParamSchema, 'params'),
  auditView({ action: 'VIEW_PAYROLL_JOURNAL', entity: 'PayrollRun' }),
  payrollController.payrollRunJournal.bind(payrollController)
);

router.post(
  '/salaries/import',
  authorize({ resource: 'payroll', action: 'process' }),
  auditLog({ action: 'IMPORT_SALARY_MASTER', entity: 'EmployeeSalary' }),
  upload.single('file'),
  payrollController.importSalaryMaster.bind(payrollController)
);

router.post(
  '/runs',
  authorize({ resource: 'payroll', action: 'process' }),
  auditLog({ action: 'CREATE_RUN', entity: 'PayrollRun' }),
  validate(createPayrollRunSchema, 'body'),
  payrollController.createPayrollRun.bind(payrollController)
);

router.patch(
  '/runs/:id/void',
  authorize({ resource: 'payroll', action: 'approve' }),
  auditLog({ action: 'VOID', entity: 'PayrollRun', model: 'payrollRun', getEntityId: (req) => req.params.id as string }),
  validate(payrollRunIdParamSchema, 'params'),
  payrollController.voidPayrollRun.bind(payrollController)
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

// ==================== Payslips — self-service PIN ====================
// Rute self (tanpa authorize admin): identitas selalu dari sesi. Backstop utama
// brute-force adalah lockout counter di kolom users.payslip_pin_*; limiter
// in-memory ini hanya meredam volume request per IP.
const payslipPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan PIN slip gaji. Coba lagi beberapa menit lagi.' },
});

// Didaftarkan SEBELUM '/payslips/:id' agar 'pin' dan 'my' tidak tertangkap param :id.
router.put(
  '/payslips/pin',
  payslipPinLimiter,
  validate(setPayslipPinSchema, 'body'),
  payrollController.setPayslipPin.bind(payrollController)
);

router.get(
  '/payslips/pin/status',
  payrollController.getPayslipPinStatus.bind(payrollController)
);

router.post(
  '/payslips/my/unlock',
  payslipPinLimiter,
  validate(payslipPinUnlockSchema, 'body'),
  payrollController.unlockMyPayslips.bind(payrollController)
);

router.get(
  '/payslips/my/:id/pdf',
  validate(payslipIdParamSchema, 'params'),
  auditView({ action: 'DOWNLOAD_PAYSLIP', entity: 'Payslip' }),
  payrollController.downloadMyPayslipPdf.bind(payrollController)
);

router.get(
  '/payslips/my/:id',
  validate(payslipIdParamSchema, 'params'),
  auditView({ action: 'VIEW_PAYSLIP', entity: 'Payslip' }),
  payrollController.findMyPayslipDetail.bind(payrollController)
);

// ==================== Payslips ====================
router.post(
  '/payslips/unlock',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payrollUnlockSchema, 'body'),
  payrollController.unlockPayslips.bind(payrollController)
);

router.post(
  '/payslips/lock',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.lockPayslips.bind(payrollController)
);

router.get(
  '/payslips/:id/pdf',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payslipIdParamSchema, 'params'),
  auditView({ action: 'DOWNLOAD_PAYSLIP', entity: 'Payslip' }),
  payrollController.downloadPayslipPdf.bind(payrollController)
);

router.get(
  '/payslips/:id',
  authorize({ resource: 'payroll', action: 'read' }),
  validate(payslipIdParamSchema, 'params'),
  auditView({ action: 'VIEW_PAYSLIP', entity: 'Payslip' }),
  payrollController.findPayslipById.bind(payrollController)
);

router.get(
  '/payslips',
  authorize({ resource: 'payroll', action: 'read' }),
  payrollController.findMyPayslips.bind(payrollController)
);

export default router;
