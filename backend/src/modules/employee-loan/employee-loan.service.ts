import { employeeLoanRepository } from './employee-loan.repository';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import { getRequestContext, getCurrentCompanyId, getCurrentRoles } from '@/shared/context/RequestContext';
import { logger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ForbiddenError, BadRequestError } from '@/shared/exceptions/AppError';
import prisma from '@/shared/database/prisma';
import type { WorkflowActionDTO } from '@/modules/workflow-engine/workflow-engine.dto';
import type { CreateLoanDTO } from './employee-loan.dto';

type WorkflowSource = 'WORKFLOW' | 'LEGACY';

const ELEVATED_ROLES = ['HR_STAFF', 'HR_MANAGER', 'COMPANY_ADMIN', 'GROUP_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FINANCE'];

export class EmployeeLoanService {
  async findLoanTypes(companyId: string) {
    return employeeLoanRepository.findLoanTypes(companyId);
  }

  async findLoanTypeById(id: string) {
    return employeeLoanRepository.findLoanTypeById(id);
  }

  async findAll(companyId: string, status?: string) {
    return employeeLoanRepository.findAll(companyId, status);
  }

  async findMyLoans(employeeId: string, status?: string) {
    return employeeLoanRepository.findMyLoans(employeeId, status);
  }

  async findById(id: string) {
    const loan = await employeeLoanRepository.findById(id);
    if (!loan) throw new NotFoundError('Loan not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && loan.companyId !== currentCompanyId) {
      throw new NotFoundError('Loan not found');
    }

    return loan;
  }

  private async resolveDefaultWorkflowTemplateId(companyId: string): Promise<string> {
    const template = await employeeLoanRepository.findWorkflowTemplateDefault(companyId);
    if (!template) {
      throw new BadRequestError(
        'No default loan workflow template configured for company. Please run seed.'
      );
    }
    return template.id;
  }

  async createLoan(data: CreateLoanDTO & { companyId: string; employeeId: string; remainingBalance: number }) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) => ELEVATED_ROLES.includes(r));

    if (currentUser?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      data.employeeId = currentUser.employeeId;
    }

    const loanType = await employeeLoanRepository.findLoanTypeById(data.loanTypeId);
    if (!loanType) throw new NotFoundError('Loan type not found');
    if (Number(data.amount) > Number(loanType.maxAmount)) {
      throw new BadRequestError(`Amount exceeds loan type maximum of ${loanType.maxAmount}`);
    }
    if (Number(data.totalInstallments) > loanType.maxInstallments) {
      throw new BadRequestError(`Installments exceed loan type maximum of ${loanType.maxInstallments}`);
    }

    const requesterId = currentUser?.id ?? undefined;

    return prisma.$transaction(async (tx) => {
      const loan = await employeeLoanRepository.create(data);

      try {
        const templateId = await this.resolveDefaultWorkflowTemplateId(data.companyId);
        await workflowEngineRepository.startInstance(requesterId ?? 'system', {
          templateId,
          companyId: data.companyId,
          approvalType: 'LOAN_REQUEST',
          referenceType: 'LOAN_REQUEST',
          referenceId: loan.id,
          payload: {
            amount: data.amount,
            tenor: data.totalInstallments,
            purpose: data.reason,
            employeeId: data.employeeId,
            interestRate: loanType.interestRate,
            totalRepayment: data.installmentAmount * data.totalInstallments,
            loanTypeId: data.loanTypeId,
            companyId: data.companyId,
          },
        });
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for loan', {
          loanId: loan.id,
          error: wfErr?.message,
        });
      }

      logger.info('Employee loan created with workflow', {
        employeeId: data.employeeId,
        loanTypeId: data.loanTypeId,
        amount: data.amount,
      });
      return loan;
    });
  }

  async finalizeApprovalEffects(loanId: string, approverId: string) {
    return employeeLoanRepository.applyApprovalEffects(loanId, approverId);
  }

  async finalizeRejectEffects(loanId: string, approverId: string, rejectionReason?: string) {
    return employeeLoanRepository.finalizeRejectEffects(loanId, approverId, rejectionReason);
  }

  async applyWorkflowAction(
    loanId: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO & { source?: WorkflowSource }
  ) {
    const loan = await this.findById(loanId);

    const instance = await employeeLoanRepository.findInstanceByLoanId(loanId);
    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this loan');
    }

    const currentCompanyId = getCurrentCompanyId();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    const updatedInstance = await workflowEngineRepository.applyAction(
      instance.id,
      userId,
      roles,
      { action: action.action, comment: action.comment }
    );

    if (updatedInstance && updatedInstance.status === 'APPROVED') {
      await this.finalizeApprovalEffects(loanId, userId);
    }

    if (action.action === 'REJECT') {
      await this.finalizeRejectEffects(loanId, userId, action.comment);
    }

    const finalLoan = await employeeLoanRepository.findById(loanId);
    return { loan: finalLoan, workflowInstance: updatedInstance };
  }

  async approveLoan(id: string, userId: string, approverEmployeeId?: string | null) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? getCurrentRoles();
    return this.applyWorkflowAction(id, userId, roles, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    });
  }

  async rejectLoan(id: string, userId: string, approverEmployeeId?: string | null, reason?: string) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? getCurrentRoles();
    return this.applyWorkflowAction(id, userId, roles, {
      action: 'REJECT',
      comment: reason ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    });
  }

  async getWorkflow(loanId: string) {
    const instance = await employeeLoanRepository.findInstanceByLoanId(loanId);
    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this loan');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }

  async getInstallments(loanId: string) {
    return employeeLoanRepository.getInstallments(loanId);
  }

  async buildAmortization(loanId: string, method?: 'FLAT' | 'EFFECTIVE') {
    return employeeLoanRepository.buildAmortization(loanId, method);
  }
}

export const employeeLoanService = new EmployeeLoanService();
