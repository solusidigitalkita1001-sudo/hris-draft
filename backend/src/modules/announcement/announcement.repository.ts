import prisma from '@/shared/database/prisma';
import { runInSystemContext } from '@/shared/context/RequestContext';

export interface AnnouncementAudienceContext {
  companyId: string;
  departmentId: string | null;
  branchId: string | null;
  positionId: string | null;
  employeeId: string | null;
}

export interface AnnouncementCandidate {
  id: string;
  companyId: string | null;
  audienceType: string;
  departmentIds: string | null;
  branchIds: string | null;
  positionIds: string | null;
  employeeIds: string | null;
  title: string;
  content: string;
  coverImageUrl: string | null;
  priority: string;
  status: string;
  publishFrom: Date | null;
  publishUntil: Date | null;
  pinnedUntil: Date | null;
  allowComment: boolean;
  totalViews: number;
  createdAt: Date;
  author: { id: string; employee: { fullName: string } | null };
  reads: Array<{ readAt: Date }>;
}

const candidateSelect = {
  id: true,
  companyId: true,
  audienceType: true,
  departmentIds: true,
  branchIds: true,
  positionIds: true,
  employeeIds: true,
  title: true,
  content: true,
  coverImageUrl: true,
  priority: true,
  status: true,
  publishFrom: true,
  publishUntil: true,
  pinnedUntil: true,
  allowComment: true,
  totalViews: true,
  createdAt: true,
  author: { select: { id: true, employee: { select: { fullName: true } } } },
} as const;

function audienceWhere(context: AnnouncementAudienceContext) {
  const conditions: Array<Record<string, unknown>> = [
    { audienceType: 'ALL' },
    { audienceType: 'COMPANY_WIDE' },
  ];
  if (context.departmentId) {
    conditions.push({ audienceType: 'DEPARTMENT_ONLY', departmentIds: { contains: `"${context.departmentId}"` } });
  }
  if (context.branchId) {
    conditions.push({ audienceType: 'BRANCH_ONLY', branchIds: { contains: `"${context.branchId}"` } });
  }
  if (context.positionId) {
    conditions.push({ audienceType: 'POSITION_ONLY', positionIds: { contains: `"${context.positionId}"` } });
  }
  if (context.employeeId) {
    conditions.push({ audienceType: 'EMPLOYEE_SPECIFIC', employeeIds: { contains: `"${context.employeeId}"` } });
  }
  return conditions;
}

export class AnnouncementRepository {
  async audienceContext(companyId: string, employeeId?: string): Promise<AnnouncementAudienceContext> {
    if (!employeeId) {
      return { companyId, employeeId: null, departmentId: null, branchId: null, positionId: null };
    }
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, departmentId: true, branchId: true, positionId: true },
    });
    return {
      companyId,
      employeeId: employee?.id ?? null,
      departmentId: employee?.departmentId ?? null,
      branchId: employee?.branchId ?? null,
      positionId: employee?.positionId ?? null,
    };
  }

  async findVisibleCandidates(context: AnnouncementAudienceContext, userId: string, now: Date): Promise<AnnouncementCandidate[]> {
    return prisma.announcement.findMany({
      where: {
        status: 'PUBLISHED',
        priority: { not: 'HIDDEN' },
        AND: [
          { OR: [{ publishFrom: null }, { publishFrom: { lte: now } }] },
          { OR: [{ publishUntil: null }, { publishUntil: { gte: now } }] },
        ],
        OR: audienceWhere(context),
      },
      select: {
        ...candidateSelect,
        reads: { where: { userId }, select: { readAt: true }, take: 1 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }) as Promise<AnnouncementCandidate[]>;
  }

  async findCandidateById(id: string, userId: string): Promise<AnnouncementCandidate | null> {
    return prisma.announcement.findFirst({
      where: { id },
      select: {
        ...candidateSelect,
        reads: { where: { userId }, select: { readAt: true }, take: 1 },
      },
    }) as Promise<AnnouncementCandidate | null>;
  }

  async markRead(announcementId: string, userId: string, announcementCompanyId: string | null) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.announcementRead.createMany({
        data: [{ announcementId, userId }],
        skipDuplicates: true,
      });
      if (created.count === 1) {
        const incrementView = () => tx.announcement.updateMany({
          where: { id: announcementId, companyId: announcementCompanyId },
          data: { totalViews: { increment: 1 } },
        });
        if (announcementCompanyId === null) {
          await runInSystemContext('increment validated platform announcement view', incrementView);
        } else {
          await incrementView();
        }
      }
      const read = await tx.announcementRead.findUnique({
        where: { announcementId_userId: { announcementId, userId } },
        select: { readAt: true },
      });
      if (!read) throw new Error('Announcement read state was not persisted');
      return { readAt: read.readAt, alreadyRead: created.count === 0 };
    });
  }
}

export const announcementRepository = new AnnouncementRepository();
