import { performanceRepository } from './performance.repository';
import { CreateReviewCycleDTO, CreateReviewDTO, UpdateReviewDTO, CreateGoalDTO, UpdateGoalProgressDTO, CreateFeedbackRequestDTO, CreateFeedbackResponseDTO } from './performance.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { logger } from '@/shared/logger/WinstonLogger';
import { v4 as uuidv4 } from 'uuid';

export class PerformanceService {
  async findAllCycles(companyId: string) {
    return performanceRepository.findAllCycles(companyId);
  }

  async createCycle(data: CreateReviewCycleDTO) {
    return performanceRepository.createCycle(data);
  }

  async findAllReviews(companyId: string, filters?: { employeeId?: string; cycleId?: string; status?: string }) {
    return performanceRepository.findAllReviews(companyId, filters);
  }

  async findReviewById(id: string) {
    const review = await performanceRepository.findReviewById(id);
    if (!review) throw new NotFoundError('Review not found');
    return review;
  }

  async createReview(data: CreateReviewDTO) {
    const review = await performanceRepository.createReview(data);
    logger.info('Performance review created', { reviewId: review.id });
    return review;
  }

  async submitReview(id: string) {
    await this.findReviewById(id);
    return performanceRepository.updateReview(id, { status: 'SUBMITTED' as any, submittedAt: new Date() });
  }

  async approveReview(id: string) {
    await this.findReviewById(id);
    return performanceRepository.updateReview(id, { status: 'APPROVED' as any, completedAt: new Date() });
  }

  async findAllGoals(companyId: string, employeeId?: string) {
    return performanceRepository.findAllGoals(companyId, employeeId);
  }

  async createGoal(data: CreateGoalDTO) {
    return performanceRepository.createGoal(data);
  }

  async updateGoalProgress(id: string, data: UpdateGoalProgressDTO) {
    return performanceRepository.addGoalUpdate(id, data.progress, data.note);
  }

  async getFeedbackRequests(companyId: string, recipientId?: string) {
    return performanceRepository.findAllFeedbackRequests(companyId, recipientId);
  }

  async requestFeedback(data: CreateFeedbackRequestDTO) {
    return performanceRepository.createFeedbackRequest(data);
  }

  async submitFeedback(data: CreateFeedbackResponseDTO) {
    const request = await performanceRepository.createFeedbackResponse(data);
    await performanceRepository.createFeedbackRequest({ ...data as any, requesterId: data.requestId, recipientId: data.requestId });
    return request;
  }
}

export const performanceService = new PerformanceService();
