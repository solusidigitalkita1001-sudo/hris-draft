import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreatePermissionDTO, ApprovePermissionDTO } from './permission-request.dto';
import { ForbiddenError, ConflictError, NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';

export class PermissionRequestRepository {
  // Employee sees their own requests
  async findMyRequests(employeeId: string, status?: string) {
    const where: Prisma.PermissionRequestWhereInput = { employeeId };
    if (status) where.status = status as any;

    return prisma.permissionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
      },
    });
  }

  // Manager/admin sees requests in their company
  async findAll(companyId: string, status?: string) {
    const where: Prisma.PermissionRequestWhereInput = { companyId };
    if (status) where.status = status as any;

    return prisma.permissionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
      },
    });
  }

  async findById(id: string) {
    return prisma.permissionRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true, employeeNumber: true, departmentId: true } },
      },
    });
  }

  async create(data: CreatePermissionDTO & { companyId: string; employeeId: string }, requesterId?: string) {
    // Kebijakan bisnis: setiap pengajuan izin WAJIB menyertakan lampiran.
    if (!data.attachment?.trim()) {
      throw new BadRequestError('Pengajuan izin wajib menyertakan lampiran');
    }
    const request = await prisma.permissionRequest.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      } as any,
    });
    // Route through the workflow engine when a template exists (unified inbox,
    // delegation, SLA). Compensation: delete the request if the workflow can't
    // start, so it isn't left unapprovable.
    try {
      await this.startWorkflow({ id: request.id, companyId: data.companyId, employeeId: data.employeeId, type: (data as { type?: string }).type ?? 'OTHER' }, requesterId ?? 'system');
    } catch {
      await prisma.permissionRequest.delete({ where: { id: request.id } }).catch(() => undefined);
      throw new BadRequestError('Pengajuan izin gagal: workflow approval tidak dapat dimulai. Coba lagi atau hubungi admin.');
    }
    return request;
  }

  async cancel(id: string, employeeId: string) {
    return prisma.permissionRequest.updateMany({
      where: { id, employeeId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Refuse the direct path when a workflow is running for this request.
   *
   * `startWorkflow` says the intent plainly — "no template → keep the
   * direct-approve path" — but nothing enforced the other half. With a
   * template configured, `PATCH /:id/approve` still wrote APPROVED straight to
   * the row, so a configured approval chain could be finished by anybody
   * holding `permission-request:update`: the engine's step order, its assigned
   * approvers and its own self-approval rejection were all skipped. The
   * workflow action endpoint is the only way in once a chain exists.
   */
  private async assertNoRunningWorkflow(id: string) {
    const instance = await prisma.workflowInstance.findFirst({
      where: { referenceType: 'PERMISSION_REQUEST', referenceId: id },
      select: { id: true, status: true },
    });
    // PENDING and ESCALATED are the states where the chain is still deciding.
    // A cancelled chain was abandoned, and an APPROVED/REJECTED one has already
    // written the request's final status, which the status guard below catches.
    if (instance && (instance.status === 'PENDING' || instance.status === 'ESCALATED')) {
      throw new ForbiddenError(
        'This permission request is in an approval workflow; act on it through the workflow action '
        + 'so the configured approvers and their order are honoured',
      );
    }
  }

  async approve(id: string, approverId: string, data?: ApprovePermissionDTO & { approverEmployeeId?: string | null }) {
    await this.assertNoRunningWorkflow(id);
    return this.markApproved(id, approverId, data);
  }

  /** The status write itself, reached either directly or by the workflow engine. */
  private async markApproved(id: string, approverId: string, data?: ApprovePermissionDTO & { approverEmployeeId?: string | null }) {
    // [Finding #11] Self-approval guard: approver tidak boleh approve request milik sendiri
    const record = await this.findById(id);
    if (record && data?.approverEmployeeId && record.employeeId === data.approverEmployeeId) {
      throw new ForbiddenError('Self approval not allowed: you cannot approve your own permission request');
    }
    // Status guard: only a PENDING request can be approved — previously a
    // REJECTED/CANCELLED request could be flipped to APPROVED.
    const approved = await prisma.permissionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', approverId, approvedAt: new Date(), notes: data?.notes },
    });
    if (approved.count !== 1) throw new ConflictError('Permission request is no longer pending');
    return prisma.permissionRequest.findFirstOrThrow({ where: { id } });
  }

  async reject(id: string, approverId: string, data?: ApprovePermissionDTO & { approverEmployeeId?: string | null }) {
    await this.assertNoRunningWorkflow(id);
    return this.markRejected(id, approverId, data);
  }

  private async markRejected(id: string, approverId: string, data?: ApprovePermissionDTO & { approverEmployeeId?: string | null }) {
    // [Finding #11] Self-approval guard: approver tidak boleh reject request milik sendiri
    const record = await this.findById(id);
    if (record && data?.approverEmployeeId && record.employeeId === data.approverEmployeeId) {
      throw new ForbiddenError('Self approval not allowed: you cannot reject your own permission request');
    }
    const rejected = await prisma.permissionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', approverId, approvedAt: new Date(), notes: data?.notes },
    });
    if (rejected.count !== 1) throw new ConflictError('Permission request is no longer pending');
    return prisma.permissionRequest.findFirstOrThrow({ where: { id } });
  }

  // ── Workflow engine routing (centralized approval) ──────────────
  async startWorkflow(request: { id: string; companyId: string; employeeId: string; type: string }, requesterId: string) {
    const template = await workflowEngineRepository.findDefaultTemplate(request.companyId, 'PERMISSION_REQUEST', 'permission-request');
    if (!template) return false; // no template → keep the direct-approve path
    await workflowEngineRepository.startInstance(requesterId, {
      templateId: template.id,
      companyId: request.companyId,
      approvalType: 'PERMISSION_REQUEST',
      referenceType: 'PERMISSION_REQUEST',
      referenceId: request.id,
      payload: { employeeId: request.employeeId, type: request.type, companyId: request.companyId },
    });
    return true;
  }

  async applyWorkflowAction(
    id: string,
    userId: string,
    roles: string[],
    action: { action: 'APPROVE' | 'REJECT' | 'ESCALATE'; comment?: string },
    approverEmployeeId?: string | null,
  ) {
    const record = await this.findById(id);
    if (!record) throw new NotFoundError('Permission request not found');
    const instance = await prisma.workflowInstance.findFirst({
      where: { referenceType: 'PERMISSION_REQUEST', referenceId: id },
    });
    if (!instance) throw new NotFoundError('Workflow instance not found for this permission request');

    const updated = await workflowEngineRepository.applyAction(instance.id, userId, roles, action);
    if (!updated) throw new NotFoundError('Failed to update workflow instance');
    if (updated.status === 'APPROVED') {
      // The engine has already decided; going through `approve` would refuse
      // its own instance.
      await this.markApproved(id, userId, { notes: action.comment, approverEmployeeId } as ApprovePermissionDTO & { approverEmployeeId?: string | null });
    }
    if (action.action === 'REJECT') {
      await this.markRejected(id, userId, { notes: action.comment, approverEmployeeId } as ApprovePermissionDTO & { approverEmployeeId?: string | null });
    }
    return { permissionRequest: await this.findById(id), workflowInstance: updated };
  }
}

export const permissionRequestRepository = new PermissionRequestRepository();
