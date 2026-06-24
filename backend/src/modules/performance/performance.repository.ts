import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateReviewCycleDTO, CreateReviewDTO, CreateGoalDTO, CreateFeedbackRequestDTO } from './performance.dto';

export class PerformanceRepository {
  // ==================== Review Cycles ====================
  async findAllCycles(companyId: string) {
    return prisma.reviewCycle.findMany({
      where: { companyId, deletedAt: null },
      include: { _count: { select: { reviews: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async findCycleById(id: string) {
    return prisma.reviewCycle.findFirst({ where: { id, deletedAt: null } });
  }

  async createCycle(data: CreateReviewCycleDTO) {
    return prisma.reviewCycle.create({
      data: { ...data, type: data.type as any, startDate: new Date(data.startDate), endDate: new Date(data.endDate), reviewDeadline: data.reviewDeadline ? new Date(data.reviewDeadline) : undefined },
    });
  }

  // ==================== Reviews ====================
  async findAllReviews(companyId: string, filters?: { employeeId?: string; cycleId?: string; status?: string }) {
    const where: Prisma.PerformanceReviewWhereInput = { companyId, deletedAt: null };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.cycleId) where.cycleId = filters.cycleId;
    if (filters?.status) where.status = filters.status as any;

    return prisma.performanceReview.findMany({
      where, include: { employee: { select: { id: true, fullName: true, employeeNumber: true } }, reviewer: { select: { id: true, fullName: true } }, cycle: { select: { id: true, name: true } }, sections: { include: { scores: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReviewById(id: string) {
    return prisma.performanceReview.findFirst({
      where: { id, deletedAt: null },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } }, reviewer: { select: { id: true, fullName: true } }, cycle: true, sections: { include: { scores: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createReview(data: CreateReviewDTO) {
    return prisma.performanceReview.create({ data: { ...data, type: data.type as any } });
  }

  async updateReview(id: string, data: Prisma.PerformanceReviewUpdateInput) {
    return prisma.performanceReview.update({ where: { id }, data });
  }

  // ==================== Goals ====================
  async findAllGoals(companyId: string, employeeId?: string) {
    const where: Prisma.GoalWhereInput = { companyId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;
    return prisma.goal.findMany({ where, include: { employee: { select: { id: true, fullName: true } }, updates: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
  }

  async createGoal(data: CreateGoalDTO) {
    return prisma.goal.create({ data: { ...data, type: data.type as any, priority: data.priority as any, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : undefined } });
  }

  async addGoalUpdate(goalId: string, progress: number, note?: string) {
    await prisma.goal.update({ where: { id: goalId }, data: { progress } });
    return prisma.goalUpdate.create({ data: { goalId, progress, note } });
  }

  // ==================== Feedback ====================
  async findAllFeedbackRequests(companyId: string, recipientId?: string) {
    const where: Prisma.FeedbackRequestWhereInput = { companyId };
    if (recipientId) where.recipientId = recipientId;
    return prisma.feedbackRequest.findMany({ where, include: { requester: { select: { id: true, fullName: true } }, recipient: { select: { id: true, fullName: true } }, responses: true } });
  }

  async createFeedbackRequest(data: CreateFeedbackRequestDTO) {
    return prisma.feedbackRequest.create({ data });
  }

  async createFeedbackResponse(data: { requestId: string; rating?: number; strengths?: string; improvements?: string; notes?: string; isAnonymous: boolean }) {
    return prisma.feedbackResponse.create({ data });
  }
}

export const performanceRepository = new PerformanceRepository();
