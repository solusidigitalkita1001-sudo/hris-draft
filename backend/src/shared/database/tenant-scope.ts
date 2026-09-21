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
  // Child tables whose tenant lives on a scoped parent (defense-in-depth: a
  // direct query on these would otherwise skip the tenant middleware entirely).
  DocumentSignature: { relation: 'document', foreignKey: 'documentId' },
  DocumentAccessLog: { relation: 'document', foreignKey: 'documentId' },
  SurveyQuestion: { relation: 'survey', foreignKey: 'surveyId' },
  SurveyResponse: { relation: 'survey', foreignKey: 'surveyId' },
  SurveyAnswer: { relation: 'response.survey', foreignKey: 'responseId' },
  ReviewSection: { relation: 'review', foreignKey: 'reviewId' },
  ReviewScore: { relation: 'section.review', foreignKey: 'sectionId' },
  GoalUpdate: { relation: 'goal', foreignKey: 'goalId' },
  TrainingMaterial: { relation: 'course', foreignKey: 'courseId' },
  TrainingAttendance: { relation: 'session.course', foreignKey: 'sessionId' },
  ShiftFormulaDay: { relation: 'shiftFormula', foreignKey: 'shiftFormulaId' },
  PerformanceGradeRange: { relation: 'gradeRule', foreignKey: 'gradeRuleId' },
  AnnouncementRead: { relation: 'announcement', foreignKey: 'announcementId' },
};

// Mutating Prisma actions. A no-company SUPER_ADMIN (implicit global mode) may
// read across tenants but must select a company before any of these (#9), so a
// company-less updateMany/deleteMany can never touch every tenant at once.
export const TENANT_WRITE_ACTIONS = new Set([
  'create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
]);

/** Throws when a no-company SUPER_ADMIN attempts a write; reads pass through. */
export function assertGlobalSuperAdminReadOnly(model: string, action: string): void {
  if (TENANT_WRITE_ACTIONS.has(action)) {
    throw new ForbiddenError(
      `Select a company before modifying tenant data — global SUPER_ADMIN mode is read-only (${model}.${action})`
    );
  }
}

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
  // Published platform announcements intentionally use companyId=null and are
  // visible to every authenticated tenant. All other company-scoped models
  // remain exact-company only. AnnouncementRead follows the same parent rule.
  const filteredActions = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']);
  const mayAccessPlatformAnnouncement = params.model === 'AnnouncementRead'
    || (params.model === 'Announcement' && !TENANT_WRITE_ACTIONS.has(params.action));
  const companyConstraint: Data = mayAccessPlatformAnnouncement
    ? { OR: [{ companyId }, { companyId: null }] }
    : { companyId };
  const tenant = parent
    ? parent.relation.split('.').reduceRight<Data>((acc, key) => ({ [key]: acc }), companyConstraint)
    : companyConstraint;
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
