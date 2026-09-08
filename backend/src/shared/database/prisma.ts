import { enforceTenantScope } from './tenant-scope';
import { PrismaClient } from '@prisma/client';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentCompanyId, isSystemContext } from '@/shared/context/RequestContext';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Task 2.8 (OPS-003): pin connection pool sizing on the datasource URL so the
// pool doesn't exhaust under concurrent payroll/report load.
function buildDatabaseUrl(): string {
  try {
    const url = new URL(config.database.url);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(config.database.connectionLimit));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(config.database.poolTimeout));
    }
    return url.toString();
  } catch {
    return config.database.url; // leave untouched if it isn't a parseable URL
  }
}

const COMPANY_SCOPED_MODELS = new Set([
  'WorkflowTemplate',
  'WorkflowInstance',
  'WorkflowInstanceStep',
  'WorkflowInstanceLog',
  'LeaveRequest',
  'LeaveBalance',
  'LeaveType',
  'Loan',
  'LoanType',
  'BusinessTrip',
  'TravelAdvance',
  'ExpenseClaim',
  'Reimbursement',
  'ExpenseApproval',
  'ShiftSwapRequest',
  'ShiftFormula',
  'OvertimeRequest',
  'Attendance',
  'AttendanceCorrection',
  'AttendanceFaceLog',
  'Branch',
  'Division',
  'Department',
  'SubDepartment',
  'Position',
  'Role',
  'SalaryComponent',
  'EmployeeSalary',
  'PayrollPeriod',
  'PayrollRun',
  'PayrollFormulaVersion',
  'PayrollFormulaAudit',
  'PayrollFormulaCalculation',
  'PayrollPaymentBatch',
  'PayrollPaymentTransaction',
  'PayrollPaymentLog',
  'PayrollPaymentOperation',
  'PayrollLoanDeductionSnapshot',
  'Payslip',
  'BenefitPlan',
  'BenefitEnrollment',
  'AssetCategory',
  'Asset',
  'AssetAssignment',
  'AssetPatrolLog',
  'ClaimCategoryLimit',
  'EarnedWageAccess',
  'DailyActivity',
  'TaskAssignment',
  'WorkCalendar',
  'NationalHoliday',
  'PermissionRequest',
  'Notification',
  'DocumentCategory',
  'Document',
  'ESignatureTransaction',
  'TrainingCategory',
  'TrainingCourse',
  'TrainingEnrollment',
  'JobPosting',
  'Candidate',
  'JobApplication',
  'Interview',
  'Announcement',
  'Survey',
  'Employee',
  'EmployeeCompanyAssignment',
  'EmployeeCareerTransaction',
  'EmployeeShiftOverride',
  'OnboardingChecklist',
  'Resignation',
  'EmployeeFamily',
  'EmployeeEducation',
  'EmployeeEmergencyContact',
  'EmployeeTraining',
  'EmployeeSkill',
  'EmployeeExperience',
  'EmployeeAttachment',
  'EmployeeBankAccount',
  'PerformanceMethod',
  'PerformanceMethodVersion',
  'PerformanceFormula',
  'PerformanceIndicator',
  'PerformanceComponent',
  'PerformanceGradeRule',
  'PerformancePeriod',
  'PerformancePlanningAssignment',
  'PerformancePlanningTarget',
  'PerformancePlanningTargetProgress',
  'PerformancePlanningEvidence',
  'PerformanceResult',
  'PerformanceCalibrationSession',
  'PerformanceCalibrationParticipant',
  'PerformanceCalibrationDecision',
  'PerformanceResultDispute',
  'PerformanceDevelopmentRecommendation',
  'PerformanceResultAttachment',
  'PerformanceAutomationSchedule',
  'ReviewCycle',
  'PerformanceReview',
  'FeedbackRequest',
  'Goal',
  'AuditLog',
  'CompanySetting',
]);

function attachCompanyScopeMiddleware(client: PrismaClient): PrismaClient {
  client.$use(async (params, next) => {
    if (!params.model || !COMPANY_SCOPED_MODELS.has(params.model)) return next(params);
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      if (isSystemContext()) return next(params);
      throw new Error(`Tenant context is required for ${params.model}.${params.action}`);
    }
    await enforceTenantScope(params, companyId);
    return next(params);
  });
  return client;
}

function createPrismaClient(): PrismaClient {
  const isDev = config.app.env === 'development';
  const client = new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  const slowMs = config.database.slowQueryMs;
  client.$on('query' as never, (e: any) => {
    if (e.duration >= slowMs) {
      logger.warn('Slow database query', { duration: `${e.duration}ms` });
    } else if (isDev) {
      // Bound parameters can contain bank routing, salaries, tokens, and employee PII.
      logger.debug('Database query completed', { duration: `${e.duration}ms` });
    }
  });

  attachCompanyScopeMiddleware(client);

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Task 2.9 (OPS-004): route heavy read-only queries to a replica when one is
// configured; otherwise this is just the primary. Read-heavy repositories can
// opt in by using `prismaRead` for findMany/aggregate; writes/transactions must
// stay on `prisma`. No hard dependency — absent env => single primary.
const globalForReplica = globalThis as unknown as { prismaRead?: PrismaClient };

function createReadClient(): PrismaClient {
  if (!config.database.readReplicaUrl) return prisma;
  const replica = new PrismaClient({
    datasources: { db: { url: config.database.readReplicaUrl } },
    log: [{ level: 'error', emit: 'stdout' }],
  });
  attachCompanyScopeMiddleware(replica);
  logger.info('Read replica configured — routing reads to replica');
  return replica;
}

export const prismaRead: PrismaClient = globalForReplica.prismaRead ?? createReadClient();

if (process.env.NODE_ENV !== 'production') {
  globalForReplica.prismaRead = prismaRead;
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

export default prisma;
