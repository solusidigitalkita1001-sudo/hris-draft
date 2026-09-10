import type { Prisma } from '@prisma/client';
import { ForbiddenError } from '@/shared/exceptions/AppError';

// `relation` may be a dot path when the company lives more than one hop away
// (e.g. WorkflowConditionRule -> stage -> template.companyId).
const PARENT_SCOPES: Record<string, { relation: string; foreignKey: string }> = {
  WorkflowInstanceStep: { relation: 'instance', foreignKey: 'instanceId' },
  WorkflowInstanceLog: { relation: 'instance', foreignKey: 'instanceId' },
  ExpenseApproval: { relation: 'claim', foreignKey: 'claimId' },
  LoanInstallment: { relation: 'loan', foreignKey: 'loanId' },
  WorkCalendarDay: { relation: 'calendar', foreignKey: 'calendarId' },
  TrainingSession: { relation: 'course', foreignKey: 'courseId' },
  ExitClearance: { relation: 'resignation', foreignKey: 'resignationId' },
  InterviewFeedback: { relation: 'interview', foreignKey: 'interviewId' },
  FeedbackResponse: { relation: 'feedbackRequest', foreignKey: 'requestId' },
  PayslipComponent: { relation: 'payslip', foreignKey: 'payslipId' },
  BenefitDeduction: { relation: 'payslip', foreignKey: 'payslipId' },
  EmployeeSalaryComponent: { relation: 'employeeSalary', foreignKey: 'employeeSalaryId' },
  WorkflowStage: { relation: 'template', foreignKey: 'templateId' },
  WorkflowConditionRule: { relation: 'stage.template', foreignKey: 'stageId' },
};

type Data = Record<string, unknown>;
function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ForbiddenError('Invalid tenant-scoped input');
  return value as Data;
}

function enforceCompany(data: Data, companyId: string, creating: boolean) {
  if ('companyId' in data) {
    const supplied = typeof data.companyId === 'object' ? object(data.companyId).set : data.companyId;
    if (supplied !== companyId) throw new ForbiddenError('Cross-company mutation is not allowed');
  }
  if ('company' in data) {
    const relation = object(data.company);
    if (Object.keys(relation).length !== 1 || !relation.connect || object(relation.connect).id !== companyId) {
      throw new ForbiddenError('Cross-company relation is not allowed');
    }
  } else if (creating) {
    data.companyId = companyId;
  }
}

/** Intersect tenant constraints with caller filters; caller filters never grant access. */
export async function enforceTenantScope(params: Prisma.MiddlewareParams, companyId: string): Promise<void> {
  const parent = params.model ? PARENT_SCOPES[params.model] : undefined;
  const args: Data = params.args ?? {};
  params.args = args;
  const tenant = parent
    ? parent.relation.split('.').reduceRight<Data>((acc, key) => ({ [key]: acc }), { companyId })
    : { companyId };
  const filteredActions = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']);
  if (filteredActions.has(params.action)) {
    const where = args.where ? object(args.where) : {};
    // Keep unique selectors at top level for Prisma WhereUniqueInput.
    const prior = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
    args.where = { ...where, AND: [...prior, tenant] };
  }

  const checkData = async (input: unknown, creating: boolean) => {
    const data = object(input);
    if (!parent) {
      enforceCompany(data, companyId, creating);
      return;
    }
    // Parent-owned inserts are validated by their owning service/transaction.
    // A separate client lookup here cannot see a parent just inserted in that
    // transaction. Existing rows cannot be moved to a different parent.
    if (!creating && (parent.foreignKey in data || parent.relation.split('.')[0] in data)) {
      throw new ForbiddenError('Reassigning a tenant-owned parent is not allowed');
    }
  };
  if (params.action === 'create') await checkData(args.data, true);
  if (params.action === 'createMany') {
    for (const row of Array.isArray(args.data) ? args.data : [args.data]) await checkData(row, true);
  }
  if (params.action === 'update' || params.action === 'updateMany') await checkData(args.data, false);
  if (params.action === 'upsert') {
    await checkData(args.create, true);
    await checkData(args.update, false);
  }
}
