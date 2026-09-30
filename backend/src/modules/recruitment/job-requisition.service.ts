import { JobRequisitionStatus, Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';

export const REQUISITION_REQUIRED_SETTING = 'recruitment_requisition_required';

export interface CreateRequisitionInput {
  code: string;
  title: string;
  headcount: number;
  reason: string;
  departmentId?: string;
  positionId?: string;
  budgetPerHire?: number;
  targetStartDate?: string;
  notes?: string;
}

/**
 * Man power planning: an approved headcount request before a vacancy opens
 * (GAP-22).
 *
 * Whether it is **required** is a per-company setting, which was the decision.
 * A company whose headcount budget is controlled centrally switches it on and
 * gets the control it is paying for; a company without that control would
 * otherwise gain a mandatory extra step for every replacement of someone who
 * resigned — bureaucracy with nothing behind it.
 *
 * The requisition itself exists either way, so a company can use it as a record
 * of intent before turning it into a gate.
 */
export class JobRequisitionService {
  async isRequired(companyId: string): Promise<boolean> {
    const setting = await prisma.companySetting.findUnique({
      where: { companyId_key: { companyId, key: REQUISITION_REQUIRED_SETTING } },
      select: { value: true },
    });
    return setting?.value === 'true';
  }

  async create(companyId: string, input: CreateRequisitionInput) {
    if (!Number.isInteger(input.headcount) || input.headcount < 1) {
      throw new BadRequestError('Headcount must be a positive whole number');
    }

    for (const [field, id] of [['departmentId', input.departmentId], ['positionId', input.positionId]] as const) {
      if (!id) continue;
      const exists = field === 'departmentId'
        ? await prisma.department.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } })
        : await prisma.position.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
      if (!exists) throw new BadRequestError(`${field} does not belong to the active company`);
    }

    const duplicate = await prisma.jobRequisition.findFirst({ where: { code: input.code }, select: { id: true } });
    if (duplicate) throw new BadRequestError('A requisition with this code already exists');

    const requisition = await prisma.jobRequisition.create({
      data: {
        companyId,
        code: input.code,
        title: input.title,
        headcount: input.headcount,
        reason: input.reason,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        budgetPerHire: input.budgetPerHire !== undefined ? new Prisma.Decimal(input.budgetPerHire) : null,
        targetStartDate: input.targetStartDate ? new Date(input.targetStartDate) : null,
        notes: input.notes,
        requestedBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('Job requisition created', { id: requisition.id, companyId, headcount: requisition.headcount });
    return requisition;
  }

  async list(companyId: string, filters: { status?: JobRequisitionStatus } = {}) {
    return prisma.jobRequisition.findMany({
      where: { companyId, deletedAt: null, ...(filters.status ? { status: filters.status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
        _count: { select: { postings: true } },
      },
    });
  }

  async submit(companyId: string, id: string) {
    return this.transition(companyId, id, JobRequisitionStatus.DRAFT, {
      status: JobRequisitionStatus.SUBMITTED,
    });
  }

  async approve(companyId: string, id: string) {
    const actorId = getCurrentUser()?.id ?? null;
    const requisition = await prisma.jobRequisition.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true, requestedBy: true },
    });
    if (!requisition) throw new NotFoundError('Job requisition not found');
    // Maker-checker on headcount budget: the person asking for a head does not
    // get to grant it to themselves.
    if (requisition.requestedBy && requisition.requestedBy === actorId) {
      throw new BadRequestError('The requester cannot approve their own requisition');
    }

    return this.transition(companyId, id, JobRequisitionStatus.SUBMITTED, {
      status: JobRequisitionStatus.APPROVED,
      approvedBy: actorId,
      approvedAt: new Date(),
    });
  }

  async reject(companyId: string, id: string, reason: string) {
    return this.transition(companyId, id, JobRequisitionStatus.SUBMITTED, {
      status: JobRequisitionStatus.REJECTED,
      rejectedReason: reason.slice(0, 255),
      approvedBy: getCurrentUser()?.id ?? null,
      approvedAt: new Date(),
    });
  }

  async cancel(companyId: string, id: string) {
    const requisition = await prisma.jobRequisition.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!requisition) throw new NotFoundError('Job requisition not found');
    const cancellable: JobRequisitionStatus[] = [
      JobRequisitionStatus.DRAFT,
      JobRequisitionStatus.SUBMITTED,
      JobRequisitionStatus.APPROVED,
    ];
    if (!cancellable.includes(requisition.status)) {
      throw new BadRequestError(`A ${requisition.status} requisition cannot be cancelled`);
    }

    const result = await prisma.jobRequisition.updateMany({
      where: { id, companyId, status: requisition.status },
      data: { status: JobRequisitionStatus.CANCELLED },
    });
    if (result.count === 0) throw new BadRequestError('This requisition changed while you were cancelling it');
    return { id, status: JobRequisitionStatus.CANCELLED };
  }

  private async transition(companyId: string, id: string, from: JobRequisitionStatus, data: Prisma.JobRequisitionUpdateManyMutationInput) {
    const requisition = await prisma.jobRequisition.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!requisition) throw new NotFoundError('Job requisition not found');
    if (requisition.status !== from) {
      throw new BadRequestError(`Requisition must be ${from} for this action; it is ${requisition.status}`);
    }

    // Conditional on the expected status: two approvers acting at once must not
    // both succeed on a headcount decision.
    const result = await prisma.jobRequisition.updateMany({ where: { id, companyId, status: from }, data });
    if (result.count === 0) throw new BadRequestError('This requisition was decided by someone else a moment ago');

    return prisma.jobRequisition.findFirstOrThrow({
      where: { id },
      select: { id: true, code: true, status: true, headcount: true, approvedAt: true, rejectedReason: true },
    });
  }

  /**
   * Check a posting against the requisition rules before it is created.
   *
   * Called by the recruitment service; returns the requisition to attach when
   * one applies. Enforces three things that a bare foreign key cannot: the
   * requisition must be approved, it must belong to this company, and the
   * vacancies asked for must still fit inside the headcount that was granted —
   * otherwise the approval becomes a formality that any number of postings can
   * quietly exceed.
   */
  async resolveForPosting(companyId: string, requisitionId: string | undefined, vacancies: number) {
    const required = await this.isRequired(companyId);

    if (!requisitionId) {
      if (required) {
        throw new BadRequestError(
          'Perusahaan ini mewajibkan requisition yang sudah disetujui sebelum lowongan dibuka (recruitment_requisition_required)',
        );
      }
      return null;
    }

    const requisition = await prisma.jobRequisition.findFirst({
      where: { id: requisitionId, companyId, deletedAt: null },
      select: { id: true, status: true, headcount: true, postings: { select: { vacancies: true } } },
    });
    if (!requisition) throw new BadRequestError('Requisition not found in the active company');
    if (requisition.status !== JobRequisitionStatus.APPROVED) {
      throw new BadRequestError(`Requisition must be APPROVED to open a vacancy; it is ${requisition.status}`);
    }

    const alreadyOpened = requisition.postings.reduce((sum, posting) => sum + posting.vacancies, 0);
    if (alreadyOpened + vacancies > requisition.headcount) {
      throw new BadRequestError(
        `Requisition ini hanya menyetujui ${requisition.headcount} headcount; ${alreadyOpened} sudah dibuka`,
      );
    }

    return { id: requisition.id, fulfils: alreadyOpened + vacancies >= requisition.headcount };
  }

  /** Mark a requisition whose headcount is now fully opened. */
  async markFulfilled(companyId: string, requisitionId: string) {
    await prisma.jobRequisition.updateMany({
      where: { id: requisitionId, companyId, status: JobRequisitionStatus.APPROVED },
      data: { status: JobRequisitionStatus.FULFILLED },
    });
  }
}

export const jobRequisitionService = new JobRequisitionService();
