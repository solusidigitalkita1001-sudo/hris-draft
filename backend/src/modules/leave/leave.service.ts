import { leaveRepository } from './leave.repository';
import { CreateLeaveTypeDTO, CreateLeaveRequestDTO, CreateLeaveBalanceDTO } from './leave.dto';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '@/shared/exceptions/AppError';
import { assertPayrollRangeOpen } from '@/shared/payroll/payroll-period-guard';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';
import { calculateCarryOver, calculateProratedEntitlement } from '@/shared/leave/accrual';
import { leaveNeedsAttachment } from '@/shared/leave/attachment-policy';
import {
  evaluateLeaveBalance,
  leaveBalanceViolationMessage,
  leaveBalanceYear,
} from '@/shared/leave/balance-policy';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import { getCurrentCompanyId, getCurrentRoles, getRequestContext } from '@/shared/context/RequestContext';
import type { WorkflowActionDTO } from '@/modules/workflow-engine/workflow-engine.dto';

type WorkflowSource = 'WORKFLOW' | 'LEGACY';

export class LeaveService {
  async findAllLeaveTypes(companyId: string) {
    return leaveRepository.findAllLeaveTypes(companyId);
  }

  async createLeaveType(data: CreateLeaveTypeDTO) {
    const type = await leaveRepository.createLeaveType(data);
    logger.info('Leave type created', { typeId: type.id, code: type.code });
    return type;
  }

  async findAllLeaveRequests(companyId: string, filters?: any) {
    return leaveRepository.findAllLeaveRequests(companyId, filters);
  }

  async findLeaveRequestById(id: string) {
    const request = await leaveRepository.findLeaveRequestById(id);
    if (!request) throw new NotFoundError('Leave request not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && request.companyId !== currentCompanyId) {
      throw new NotFoundError('Leave request not found');
    }

    return request;
  }

  private async resolveDefaultWorkflowTemplateId(companyId: string): Promise<string> {
    const template = await workflowEngineRepository.findDefaultTemplate(
      companyId,
      'LEAVE_REQUEST',
      'leave'
    );
    if (!template) {
      throw new BadRequestError(
        'No default leave workflow template configured for company. Please run seed.'
      );
    }
    return template.id;
  }

  async createLeaveRequest(data: CreateLeaveRequestDTO) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) =>
      ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(r)
    );

    if (currentUser?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      if (data.employeeId !== currentUser.employeeId) {
        throw new ForbiddenError('IDOR: Employee cannot create leave request for other employees');
      }
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end.getTime() < start.getTime()) {
      throw new BadRequestError('Tanggal selesai cuti harus setelah atau sama dengan tanggal mulai');
    }

    // Kebijakan H-7: pengajuan kurang dari 7 hari kalender sebelum tanggal
    // mulai wajib menyertakan lampiran (aturan murni di shared/leave/attachment-policy).
    if (leaveNeedsAttachment(start, new Date()) && !data.attachment) {
      throw new BadRequestError('Pengajuan cuti kurang dari H-7 wajib menyertakan lampiran');
    }

    // LeaveType rules (checklist §13): per-request cap and attachment flag.
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: data.leaveTypeId, companyId: data.companyId, deletedAt: null },
      select: { maxDays: true, requiresAttachment: true, name: true },
    });
    if (!leaveType) throw new NotFoundError('Leave type not found');
    if (leaveType.requiresAttachment && !data.attachment) {
      throw new BadRequestError(`Jenis cuti ${leaveType.name} wajib menyertakan lampiran dokumen`);
    }
    const computedTotalDays = await leaveRepository.countLeaveDays(data.employeeId, data.companyId, start, end);
    if (leaveType.maxDays && computedTotalDays > leaveType.maxDays) {
      throw new BadRequestError(`Jenis cuti ${leaveType.name} maksimal ${leaveType.maxDays} hari per pengajuan (diajukan ${computedTotalDays} hari kerja)`);
    }

    // Overlap: an employee cannot hold two pending/approved requests covering
    // the same dates — both would deduct the balance while payroll counts the
    // dates once.
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: data.employeeId,
        deletedAt: null,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true, startDate: true, endDate: true, status: true },
    });
    if (overlap) {
      throw new ConflictError(`Sudah ada pengajuan cuti ${overlap.status} yang tumpang tindih pada rentang tanggal tersebut`);
    }

    // Saldo divalidasi SEBELUM request dibuat. Sebelumnya cek ini hanya menolak
    // saat baris saldo ADA dan sudah 0, sehingga jenis cuti tanpa alokasi sama
    // sekali (mis. Sick Leave yang tidak diseed) lolos masuk lalu baru ditolak
    // di meja approver oleh finalizeApprovalEffects.
    //
    // Berlaku untuk SEMUA jenis cuti — termasuk yang isPaid=false — karena
    // finalizeApprovalEffects juga mewajibkan baris saldo ada dan mencukupi
    // untuk semua jenis. Melonggarkan aturan di sini hanya akan mengembalikan
    // bug yang sama pada jenis yang dilonggarkan.
    const balanceYear = leaveBalanceYear(start);
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        year: balanceYear,
      },
      select: { remainingDays: true },
    });
    const balanceViolation = evaluateLeaveBalance({
      leaveTypeName: leaveType.name,
      year: balanceYear,
      requestedDays: computedTotalDays,
      remainingDays: balance ? Number(balance.remainingDays) : null,
    });
    if (balanceViolation) {
      throw new BadRequestError(leaveBalanceViolationMessage(balanceViolation, 'REQUESTER'));
    }

    const requesterId = currentUser?.id ?? undefined;

    // Not a DB transaction: startInstance commits in its own transaction, so
    // atomicity is achieved by compensating (deleting the fresh request) when
    // the workflow cannot start — an approval-less request is unapprovable.
    {
      // totalDays yang sudah divalidasi (cap per jenis + saldo) diteruskan agar
      // angka yang tersimpan persis angka yang diuji, bukan hasil hitung ulang.
      const request = await leaveRepository.createLeaveRequest(data, computedTotalDays);

      try {
        const templateId = await this.resolveDefaultWorkflowTemplateId(data.companyId);
        await workflowEngineRepository.startInstance(requesterId ?? 'system', {
          templateId,
          companyId: data.companyId,
          approvalType: 'LEAVE_REQUEST',
          referenceType: 'LEAVE_REQUEST',
          referenceId: request.id,
          payload: {
            leaveTypeId: data.leaveTypeId,
            totalDays: computedTotalDays,
            reason: data.reason,
            startDate: data.startDate,
            endDate: data.endDate,
            employeeId: data.employeeId,
            companyId: data.companyId,
          },
        });
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for leave request; rolling back request', {
          leaveRequestId: request.id,
          error: wfErr?.message,
        });
        await prisma.leaveRequest.delete({ where: { id: request.id } }).catch(() => undefined);
        throw new BadRequestError('Pengajuan cuti gagal: workflow approval tidak dapat dimulai. Coba lagi atau hubungi admin.');
      }

      logger.info('Leave request created with workflow', {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
      });
      return request;
    }
  }

  /**
   * Cancellation with balance restoration (checklist §13): the requester may
   * cancel their own request; managers need leave:approve. Cancelling an
   * APPROVED request returns the deducted days under the same row locks the
   * approval used, and is blocked once the period's payroll is locked.
   */
  async cancelLeave(id: string, userId: string, actorEmployeeId?: string | null) {
    const request = await leaveRepository.findLeaveRequestById(id);
    if (!request) throw new NotFoundError('Leave request not found');

    const ctx = getRequestContext();
    const permissions = ctx?.user?.permissions ?? [];
    const roles = ctx?.user?.roles ?? [];
    const isOwn = Boolean(actorEmployeeId && request.employeeId === actorEmployeeId);
    const mayManage = roles.includes('SUPER_ADMIN')
      || permissions.includes('leave:approve') || permissions.includes('leave:*');
    if (!isOwn && !mayManage) {
      throw new ForbiddenError('Hanya pemilik pengajuan atau approver yang dapat membatalkan cuti');
    }

    if (request.status === 'PENDING') {
      const cancelled = await prisma.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (cancelled.count !== 1) throw new ConflictError('Pengajuan cuti sudah diproses; muat ulang lalu coba lagi');
      await workflowEngineRepository.cancelInstanceByReference('LEAVE_REQUEST', id, userId, 'Cuti dibatalkan oleh pemohon/HR');
      return leaveRepository.findLeaveRequestById(id);
    }

    if (request.status === 'APPROVED') {
      await assertPayrollRangeOpen(request.companyId, request.startDate, request.endDate);
      await prisma.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw<Array<{ id: string; status: string; total_days: number }>>`
          SELECT id, status, total_days FROM leave_requests WHERE id = ${id} AND company_id = ${request.companyId} FOR UPDATE`;
        if (!row || row.status !== 'APPROVED') throw new ConflictError('Pengajuan cuti berubah; muat ulang lalu coba lagi');
        const year = new Date(request.startDate).getFullYear();
        const [bal] = await tx.$queryRaw<Array<{ id: string; total_days: number; used_days: number }>>`
          SELECT id, total_days, used_days FROM leave_balances
          WHERE employee_id = ${request.employeeId} AND leave_type_id = ${request.leaveTypeId} AND year = ${year}
          AND company_id = ${request.companyId}
          FOR UPDATE`;
        if (bal) {
          const usedDays = Math.max(0, Number(bal.used_days) - Number(row.total_days));
          await tx.leaveBalance.update({
            where: { id: bal.id },
            data: { usedDays, remainingDays: Math.max(0, Number(bal.total_days) - usedDays) },
          });
        }
        await tx.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
      });
      logger.info('Approved leave cancelled with balance restored', { leaveRequestId: id, cancelledBy: userId });
      return leaveRepository.findLeaveRequestById(id);
    }

    throw new BadRequestError(`Pengajuan cuti berstatus ${request.status} tidak dapat dibatalkan`);
  }

  /**
   * Memastikan saldo cuti mencukupi tanpa mengubah apa pun. Dipakai sebagai
   * pra-syarat approve agar kegagalan saldo tidak menyisakan workflow yang
   * sudah disetujui di atas dokumen yang masih menunggu.
   */
  async assertLeaveBalanceSufficient(leaveRequestId: string) {
    const request = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, deletedAt: null },
      select: {
        companyId: true,
        employeeId: true,
        leaveTypeId: true,
        totalDays: true,
        startDate: true,
        status: true,
        leaveType: { select: { name: true } },
      },
    });
    if (!request) throw new NotFoundError('Leave request not found');
    if (request.status === 'APPROVED') return;

    const year = leaveBalanceYear(new Date(request.startDate));
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        companyId: request.companyId,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
      select: { remainingDays: true },
    });

    // Aturan yang sama dipakai saat pengajuan dibuat (createLeaveRequest),
    // hanya beda audiens pesan — supaya kedua gerbang tidak bisa berbeda.
    const violation = evaluateLeaveBalance({
      leaveTypeName: request.leaveType?.name ?? 'cuti',
      year,
      requestedDays: Number(request.totalDays),
      remainingDays: balance ? Number(balance.remainingDays) : null,
    });
    if (violation) {
      throw new BadRequestError(leaveBalanceViolationMessage(violation, 'APPROVER'));
    }
  }

  async finalizeApprovalEffects(leaveRequestId: string) {
    // Payroll lock: approving leave inside a reviewed/closed period would
    // change LEAVE_DAYS after the run consumed them.
    const pending = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, deletedAt: null },
      select: { companyId: true, startDate: true, endDate: true },
    });
    // Resolve the row through the active-company boundary before taking raw
    // locks. System jobs are the only unscoped context; HTTP SUPER_ADMIN calls
    // must already have an explicitly selected company.
    if (!pending) throw new NotFoundError('Leave request not found');
    await assertPayrollRangeOpen(pending.companyId, pending.startDate, pending.endDate);
    return prisma.$transaction(async (tx) => {
      const [req] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          employee_id: string;
          leave_type_id: string;
          total_days: number;
          start_date: Date;
        }>
      >`SELECT id, status, employee_id, leave_type_id, total_days, start_date
        FROM leave_requests WHERE id = ${leaveRequestId} AND company_id = ${pending.companyId} FOR UPDATE`;

      if (!req) throw new NotFoundError('Leave request not found');
      if (req.status === 'APPROVED') {
        return tx.leaveRequest.findUnique({ where: { id: leaveRequestId } });
      }

      const year = new Date(req.start_date).getFullYear();
      const [bal] = await tx.$queryRaw<
        Array<{ id: string; used_days: number; remaining_days: number }>
      >`SELECT id, used_days, remaining_days FROM leave_balances
        WHERE employee_id = ${req.employee_id} AND leave_type_id = ${req.leave_type_id} AND year = ${year}
        AND company_id = ${pending.companyId}
        FOR UPDATE`;

      if (!bal || bal.remaining_days < req.total_days) {
        throw new BadRequestError('Leave balance tidak cukup');
      }

      await tx.leaveBalance.update({
        where: { id: bal.id },
        data: {
          usedDays: bal.used_days + req.total_days,
          remainingDays: bal.remaining_days - req.total_days,
        },
      });

      const ctx = getRequestContext();
      const approvedBy = ctx?.user?.id ?? 'workflow';

      const approved = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
      });
      logger.info('Leave finalized approved via workflow', {
        id: leaveRequestId,
        employeeId: req.employee_id,
        days: req.total_days,
      });
      return approved;
    });
  }

  async applyWorkflowAction(
    leaveRequestId: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO & { source?: WorkflowSource },
    approverEmployeeId?: string | null
  ) {
    const leaveRequest = await this.findLeaveRequestById(leaveRequestId);

    const instance = await prisma.workflowInstance.findFirst({
      where: {
        referenceType: 'LEAVE_REQUEST',
        referenceId: leaveRequestId,
      },
    });

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this leave request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    // [Finding #11] Self-approval guard for all workflow action paths (APPROVE/REJECT)
    // => Diletakkan SETELAH cross-company scope check agar NotFoundError scope menang duluan
    //    (urutan defense-in-depth: identify object → scope ownership → rule check)
    if ((action.action === 'APPROVE' || action.action === 'REJECT')) {
      const ctx = getRequestContext();
      const resolvedApproverEmployeeId = approverEmployeeId ?? ctx?.user?.employeeId;
      if (resolvedApproverEmployeeId && resolvedApproverEmployeeId === leaveRequest.employeeId) {
        throw new ForbiddenError(
          `Self approval not allowed: you cannot ${action.action.toLowerCase()} your own leave request`
        );
      }
    }

    // Saldo divalidasi SEBELUM transisi engine. Bila dicek hanya saat
    // finalisasi, transisi sudah ter-commit lebih dulu sehingga instance
    // berakhir APPROVED sementara dokumennya tetap PENDING — dan langkah
    // approval tidak bisa diulang, jadi pengajuan macet selamanya.
    if (action.action === 'APPROVE') {
      await this.assertLeaveBalanceSufficient(leaveRequestId);
    }

    const updatedInstance = await workflowEngineRepository.applyAction(
      instance.id,
      userId,
      roles,
      { action: action.action, comment: action.comment }
    );

    if (updatedInstance && updatedInstance.status === 'APPROVED') {
      await this.finalizeApprovalEffects(leaveRequestId);
    }

    if (action.action === 'REJECT') {
      await leaveRepository.updateLeaveStatus(
        leaveRequestId,
        'REJECTED',
        undefined,
        action.comment
      );
    }

    const finalLeave = await leaveRepository.findLeaveRequestById(leaveRequestId);
    return { leaveRequest: finalLeave, workflowInstance: updatedInstance };
  }

  async approveLeave(id: string, userId: string, approverEmployeeId?: string | null) {
    const roles = getCurrentRoles();
    // [Finding #11] Self-approval guard: approver tidak boleh approve leave request milik sendiri
    const request = await this.findLeaveRequestById(id);
    const ctx = getRequestContext();
    const resolvedApproverEmployeeId = approverEmployeeId ?? ctx?.user?.employeeId;
    if (resolvedApproverEmployeeId && resolvedApproverEmployeeId === request.employeeId) {
      throw new ForbiddenError('Cannot approve your own leave request');
    }
    return this.applyWorkflowAction(id, userId, roles, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    }, resolvedApproverEmployeeId);
  }

  async rejectLeave(id: string, reason?: string, approverEmployeeId?: string | null) {
    const ctx = getRequestContext();
    const userId = ctx?.user?.id ?? 'legacy';
    const roles = ctx?.user?.roles ?? [];

    const request = await this.findLeaveRequestById(id);
    const resolvedApproverEmployeeId = approverEmployeeId ?? ctx?.user?.employeeId;
    if (resolvedApproverEmployeeId && resolvedApproverEmployeeId === request.employeeId) {
      throw new ForbiddenError('Cannot reject your own leave request');
    }

    return this.applyWorkflowAction(id, userId, roles, {
      action: 'REJECT',
      comment: reason ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    }, resolvedApproverEmployeeId);
  }

  async getLeaveWorkflow(id: string) {
    const instance = await prisma.workflowInstance.findFirst({
      where: {
        referenceType: 'LEAVE_REQUEST',
        referenceId: id,
      },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: { select: { id: true, name: true, approvalType: true } },
      },
    });

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this leave request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }

  async getLeaveBalances(employeeId: string) {
    return leaveRepository.findLeaveBalances(employeeId);
  }

  async setLeaveBalance(data: CreateLeaveBalanceDTO) {
    return leaveRepository.upsertLeaveBalance(data);
  }

  async accrueAnnualBalance(params: {
    employeeId: string;
    leaveTypeId: string;
    year?: number;
    maxCarryOver?: number;
  }) {
    const year = params.year ?? new Date().getFullYear();
    const { employee, leaveType, previousBalance, currentBalance } = await leaveRepository.findAccrualInputs(
      params.employeeId,
      params.leaveTypeId,
      year
    );

    if (!employee) throw new NotFoundError('Employee not found');
    if (!leaveType) throw new NotFoundError('Leave type not found');
    if (!leaveType.isAnnual) {
      throw new BadRequestError('Akrual hanya berlaku untuk tipe cuti tahunan (isAnnual)');
    }
    if (!employee.joinDate) {
      throw new BadRequestError('Tanggal masuk (joinDate) karyawan belum diisi, tidak bisa pro-rate');
    }

    // Accrual must be safe to run twice. Deriving the carry-over from last
    // year's remainingDays only works the first time: expiry zeroes that field
    // immediately afterwards, so a second run would compute zero and write
    // totalDays back down, destroying the days the employee carried. Once a
    // row for this year exists, the figure it recorded is the truth.
    const entitlement = calculateProratedEntitlement({
      joinDate: employee.joinDate,
      year,
      annualQuota: leaveType.maxDays,
    });
    const carryOver = currentBalance
      ? currentBalance.carryOverDays
      : calculateCarryOver({
          previousRemaining: previousBalance?.remainingDays ?? 0,
          maxCarryOver: params.maxCarryOver,
        });
    const totalDays = entitlement + carryOver;

    const balance = await leaveRepository.upsertAccruedBalance({
      employeeId: employee.id,
      companyId: employee.companyId,
      leaveTypeId: leaveType.id,
      year,
      totalDays,
      carryOverDays: carryOver,
    });

    logger.info('Leave balance accrued', {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      year,
      entitlement,
      carryOver,
      totalDays,
    });

    return { ...balance, breakdown: { entitlement, carryOver, totalDays } };
  }
}

export const leaveService = new LeaveService();
