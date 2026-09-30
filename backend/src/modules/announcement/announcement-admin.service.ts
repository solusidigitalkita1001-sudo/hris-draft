import { AnnouncementAudience, AnnouncementStatus, Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';

export interface AnnouncementWriteInput {
  title: string;
  content: string;
  audienceType: AnnouncementAudience;
  departmentIds?: string[];
  branchIds?: string[];
  positionIds?: string[];
  employeeIds?: string[];
  coverImageUrl?: string;
  /// The schema's own vocabulary: PINNED sits at the top of the dashboard,
  /// HIDDEN keeps a published announcement out of the list without archiving it.
  priority?: 'PINNED' | 'NORMAL' | 'HIDDEN';
  publishFrom?: string;
  publishUntil?: string;
  pinnedUntil?: string;
  allowComment?: boolean;
}

/** Which id list each audience type reads, and which must be empty. */
const AUDIENCE_TARGETS: Record<AnnouncementAudience, keyof AnnouncementWriteInput | null> = {
  ALL: null,
  COMPANY_WIDE: null,
  DEPARTMENT_ONLY: 'departmentIds',
  BRANCH_ONLY: 'branchIds',
  POSITION_ONLY: 'positionIds',
  EMPLOYEE_SPECIFIC: 'employeeIds',
};

/**
 * The write side of announcements.
 *
 * The read side was complete — audience targeting, publish window, pinning,
 * read tracking — and nothing could create a row for it to read. The portal was
 * a window onto data that only a seed script could produce.
 *
 * Two things this refuses that a thinner version would not:
 *
 * 1. **A targeted announcement with no targets.** `DEPARTMENT_ONLY` with an
 *    empty department list is visible to nobody; publishing it looks like
 *    communicating and reaches no one, which is worse than an error.
 * 2. **Targets from another company.** The audience lists are opaque JSON, so
 *    nothing downstream would catch a department id belonging to another
 *    tenant — it would simply never match, and the author would never know why
 *    their announcement was silent.
 */
export class AnnouncementAdminService {
  private actorUserId(): string {
    const actor = getCurrentUser();
    if (!actor?.id) throw new ForbiddenError('A signed-in user is required');
    return actor.id;
  }

  private async validateAudience(companyId: string, input: AnnouncementWriteInput) {
    const field = AUDIENCE_TARGETS[input.audienceType];

    // Lists that do not belong to the chosen audience are refused rather than
    // ignored: silently dropping them would leave the author believing the
    // announcement was narrower than it is.
    for (const [other, key] of Object.entries(AUDIENCE_TARGETS)) {
      if (!key || other === input.audienceType) continue;
      const value = input[key] as string[] | undefined;
      if (value?.length) {
        throw new BadRequestError(`${key} is only used with audienceType ${other}`);
      }
    }

    if (!field) return;

    const ids = [...new Set((input[field] as string[] | undefined) ?? [])];
    if (!ids.length) {
      throw new BadRequestError(
        `audienceType ${input.audienceType} needs at least one entry in ${field}; otherwise the announcement reaches nobody`,
      );
    }

    const found = field === 'departmentIds'
      ? await prisma.department.findMany({ where: { id: { in: ids }, companyId, deletedAt: null }, select: { id: true } })
      : field === 'branchIds'
        ? await prisma.branch.findMany({ where: { id: { in: ids }, companyId, deletedAt: null }, select: { id: true } })
        : field === 'positionIds'
          ? await prisma.position.findMany({ where: { id: { in: ids }, companyId, deletedAt: null }, select: { id: true } })
          : await prisma.employee.findMany({ where: { id: { in: ids }, companyId, deletedAt: null }, select: { id: true } });

    if (found.length !== ids.length) {
      const missing = ids.filter((id) => !found.some((row) => row.id === id));
      throw new BadRequestError(`${field} contains ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} outside this company`);
    }

    return ids;
  }

  private window(input: AnnouncementWriteInput) {
    const publishFrom = input.publishFrom ? new Date(input.publishFrom) : null;
    const publishUntil = input.publishUntil ? new Date(input.publishUntil) : null;
    const pinnedUntil = input.pinnedUntil ? new Date(input.pinnedUntil) : null;

    if (publishFrom && publishUntil && publishUntil <= publishFrom) {
      throw new BadRequestError('publishUntil must be after publishFrom');
    }
    // A pin that expires before the announcement is even visible is a
    // configuration nobody meant.
    if (pinnedUntil && publishFrom && pinnedUntil <= publishFrom) {
      throw new BadRequestError('pinnedUntil must be after publishFrom');
    }
    return { publishFrom, publishUntil, pinnedUntil };
  }

  private audienceJson(input: AnnouncementWriteInput, ids: string[] | undefined) {
    const field = AUDIENCE_TARGETS[input.audienceType];
    const serialise = (value: string[] | undefined) => (value?.length ? JSON.stringify(value) : null);
    return {
      departmentIds: field === 'departmentIds' ? serialise(ids) : null,
      branchIds: field === 'branchIds' ? serialise(ids) : null,
      positionIds: field === 'positionIds' ? serialise(ids) : null,
      employeeIds: field === 'employeeIds' ? serialise(ids) : null,
    };
  }

  /** Created as a DRAFT: publishing is its own act, with its own permission. */
  async create(companyId: string, input: AnnouncementWriteInput) {
    if (input.audienceType === AnnouncementAudience.ALL) {
      // ALL means every tenant on the platform. That is a platform decision,
      // not a company one, and this endpoint is company-scoped.
      throw new BadRequestError('audienceType ALL is platform-wide and cannot be created from a company context');
    }

    const ids = await this.validateAudience(companyId, input);
    const { publishFrom, publishUntil, pinnedUntil } = this.window(input);

    const announcement = await prisma.announcement.create({
      data: {
        companyId,
        authorId: this.actorUserId(),
        title: input.title,
        content: input.content,
        audienceType: input.audienceType,
        ...this.audienceJson(input, ids),
        coverImageUrl: input.coverImageUrl,
        priority: input.priority ?? 'NORMAL',
        status: AnnouncementStatus.DRAFT,
        publishFrom,
        publishUntil,
        pinnedUntil,
        allowComment: input.allowComment ?? false,
      },
      select: { id: true, title: true, status: true, audienceType: true, publishFrom: true },
    });

    logger.info('Announcement created', { id: announcement.id, companyId, audience: input.audienceType });
    return announcement;
  }

  async update(companyId: string, id: string, input: AnnouncementWriteInput) {
    const existing = await prisma.announcement.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError('Announcement not found in the active company');
    if (existing.status === AnnouncementStatus.ARCHIVED) {
      throw new BadRequestError('An archived announcement cannot be edited; create a new one');
    }

    const ids = await this.validateAudience(companyId, input);
    const { publishFrom, publishUntil, pinnedUntil } = this.window(input);

    return prisma.announcement.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        content: input.content,
        audienceType: input.audienceType,
        ...this.audienceJson(input, ids),
        coverImageUrl: input.coverImageUrl ?? null,
        priority: input.priority ?? 'NORMAL',
        publishFrom,
        publishUntil,
        pinnedUntil,
        allowComment: input.allowComment ?? false,
      },
      select: { id: true, title: true, status: true, audienceType: true },
    });
  }

  /**
   * Publish. Conditional on the row still being a draft, so two people pressing
   * publish do not both succeed and the author of record stays unambiguous.
   */
  async publish(companyId: string, id: string, now = new Date()) {
    const announcement = await prisma.announcement.findFirst({
      where: { id, companyId },
      select: { id: true, status: true, publishFrom: true, publishUntil: true },
    });
    if (!announcement) throw new NotFoundError('Announcement not found in the active company');
    if (announcement.status !== AnnouncementStatus.DRAFT) {
      throw new BadRequestError(`Only a draft can be published; this one is ${announcement.status}`);
    }
    if (announcement.publishUntil && announcement.publishUntil <= now) {
      // Publishing something whose window has already closed produces an
      // announcement nobody will ever see.
      throw new BadRequestError('publishUntil is already in the past; extend the window before publishing');
    }

    const claimed = await prisma.announcement.updateMany({
      where: { id, companyId, status: AnnouncementStatus.DRAFT },
      data: {
        status: AnnouncementStatus.PUBLISHED,
        // No publishFrom means "visible now" to the read side, so stamp it
        // rather than leaving the publication time unrecorded.
        publishFrom: announcement.publishFrom ?? now,
      },
    });
    if (claimed.count !== 1) throw new BadRequestError('This announcement was published by someone else a moment ago');

    logger.info('Announcement published', { id, companyId });
    return { id, status: AnnouncementStatus.PUBLISHED };
  }

  /** Archive rather than delete: read receipts are evidence of who was told what. */
  async archive(companyId: string, id: string) {
    const announcement = await prisma.announcement.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!announcement) throw new NotFoundError('Announcement not found in the active company');
    if (announcement.status === AnnouncementStatus.ARCHIVED) {
      return { id, status: AnnouncementStatus.ARCHIVED };
    }

    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { status: AnnouncementStatus.ARCHIVED },
    });
    return { id, status: AnnouncementStatus.ARCHIVED };
  }

  /**
   * The author's view: every announcement of this company whatever its status,
   * with how many people have read it.
   */
  async list(companyId: string, filters: { status?: AnnouncementStatus } = {}) {
    const rows = await prisma.announcement.findMany({
      where: { companyId, ...(filters.status ? { status: filters.status } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, audienceType: true, priority: true, status: true,
        publishFrom: true, publishUntil: true, pinnedUntil: true, totalViews: true,
        createdAt: true,
        author: { select: { id: true, email: true } },
        _count: { select: { reads: true } },
      },
    });

    return rows.map((row) => ({
      ...row,
      readCount: row._count.reads,
      _count: undefined as unknown as Prisma.AnnouncementCountOutputType | undefined,
    }));
  }

  /** Who has read it and who has not — the question HR actually asks. */
  async readers(companyId: string, id: string) {
    const announcement = await prisma.announcement.findFirst({
      where: { id, companyId },
      select: { id: true, title: true, status: true },
    });
    if (!announcement) throw new NotFoundError('Announcement not found in the active company');

    const reads = await prisma.announcementRead.findMany({
      where: { announcementId: id },
      orderBy: { readAt: 'desc' },
      select: {
        readAt: true,
        user: { select: { id: true, email: true, employee: { select: { employeeNumber: true, fullName: true } } } },
      },
    });

    return {
      announcement,
      readCount: reads.length,
      readers: reads.map((read) => ({
        userId: read.user.id,
        email: read.user.email,
        employeeNumber: read.user.employee?.employeeNumber ?? null,
        fullName: read.user.employee?.fullName ?? null,
        readAt: read.readAt,
      })),
    };
  }
}

export const announcementAdminService = new AnnouncementAdminService();
