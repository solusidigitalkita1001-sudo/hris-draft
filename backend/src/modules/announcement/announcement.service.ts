import { NotFoundError } from '@/shared/exceptions/AppError';
import {
  isAnnouncementVisibleTo,
  sortAnnouncementsForDashboard,
  type AnnouncementViewContext,
} from '@/shared/engagement/announcement';
import {
  announcementRepository,
  type AnnouncementCandidate,
  type AnnouncementRepository,
} from './announcement.repository';
import type { AnnouncementListQuery } from './announcement.dto';

interface Actor {
  userId: string;
  companyId: string;
  employeeId?: string;
}

function viewContext(
  context: Awaited<ReturnType<AnnouncementRepository['audienceContext']>>,
  now: Date,
): AnnouncementViewContext {
  return {
    companyId: context.companyId,
    departmentId: context.departmentId,
    branchId: context.branchId,
    positionId: context.positionId,
    employeeId: context.employeeId,
    currentDate: now,
  };
}

function listItem(candidate: AnnouncementCandidate) {
  const readAt = candidate.reads[0]?.readAt ?? null;
  return {
    id: candidate.id,
    audienceType: candidate.audienceType,
    title: candidate.title,
    contentPreview: candidate.content.length > 280
      ? `${candidate.content.slice(0, 277)}...`
      : candidate.content,
    coverImageUrl: candidate.coverImageUrl,
    priority: candidate.priority,
    publishFrom: candidate.publishFrom,
    publishUntil: candidate.publishUntil,
    pinnedUntil: candidate.pinnedUntil,
    author: { id: candidate.author.id, name: candidate.author.employee?.fullName ?? null },
    isRead: Boolean(readAt),
    readAt,
    createdAt: candidate.createdAt,
  };
}

export class AnnouncementService {
  constructor(private readonly repository: AnnouncementRepository = announcementRepository) {}

  private async context(actor: Actor) {
    return this.repository.audienceContext(actor.companyId, actor.employeeId);
  }

  private async visibleCandidate(actor: Actor, id: string, now: Date) {
    const [context, candidate] = await Promise.all([
      this.context(actor),
      this.repository.findCandidateById(id, actor.userId),
    ]);
    if (!candidate || !isAnnouncementVisibleTo(candidate, viewContext(context, now))) {
      throw new NotFoundError('Announcement not found');
    }
    return candidate;
  }

  async list(actor: Actor, query: AnnouncementListQuery, now = new Date()) {
    const context = await this.context(actor);
    const candidates = await this.repository.findVisibleCandidates(context, actor.userId, now);
    const audience = viewContext(context, now);
    const visible = sortAnnouncementsForDashboard(
      candidates.filter((candidate) => isAnnouncementVisibleTo(candidate, audience)),
      now,
    );
    const filtered = query.unreadOnly === 'true'
      ? visible.filter((candidate) => candidate.reads.length === 0)
      : visible;
    const start = (query.page - 1) * query.limit;
    return {
      items: filtered.slice(start, start + query.limit).map(listItem),
      total: filtered.length,
      page: query.page,
      limit: query.limit,
    };
  }

  async unreadCount(actor: Actor, now = new Date()) {
    const context = await this.context(actor);
    const candidates = await this.repository.findVisibleCandidates(context, actor.userId, now);
    const audience = viewContext(context, now);
    return candidates.filter((candidate) =>
      candidate.reads.length === 0 && isAnnouncementVisibleTo(candidate, audience),
    ).length;
  }

  async detail(actor: Actor, id: string, now = new Date()) {
    const candidate = await this.visibleCandidate(actor, id, now);
    return {
      ...listItem(candidate),
      content: candidate.content,
      allowComment: candidate.allowComment,
      totalViews: candidate.totalViews,
    };
  }

  async markRead(actor: Actor, id: string, now = new Date()) {
    const candidate = await this.visibleCandidate(actor, id, now);
    const result = await this.repository.markRead(id, actor.userId, candidate.companyId);
    return { announcementId: id, ...result };
  }
}

export const announcementService = new AnnouncementService();
