import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';

export interface RecordScoreInput {
  score: number;
  notes?: string;
}

export interface SubmitFeedbackInput {
  contentRating: number;
  trainerRating: number;
  relevanceRating: number;
  facilityRating?: number;
  wouldRecommend: boolean;
  comment?: string;
}

/**
 * Post-training evaluation (GAP-25), on the two levels the decision asked for.
 *
 * **Level 2, the trainer's score**, was already in the schema as
 * `TrainingEnrollment.score` and used by nothing at all — a column recording
 * whether anyone learned anything, that no endpoint could write. It is writable
 * now, and only for an enrollment that actually completed: a score for training
 * someone did not finish measures nothing.
 *
 * **Level 1, the participant's reaction**, is new. Without it there is no way to
 * know whether a course was any use — only whether people passed it, which a
 * bad course can still produce.
 *
 * Deliberately not built: the per-course effectiveness roll-up. Building a
 * report before the data exists produces an empty chart, and an empty chart
 * gets read as "nothing wrong here".
 */
export class TrainingEvaluationService {
  /** The trainer's score. HR or the trainer records it; the participant cannot. */
  async recordScore(companyId: string, enrollmentId: string, input: RecordScoreInput) {
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
      throw new BadRequestError('Score must be between 0 and 100');
    }

    const enrollment = await prisma.trainingEnrollment.findFirst({
      where: { id: enrollmentId, companyId, deletedAt: null },
      select: { id: true, status: true, employeeId: true },
    });
    if (!enrollment) throw new NotFoundError('Training enrollment not found in the active company');
    if (enrollment.status !== 'COMPLETED') {
      // A score for training somebody did not finish measures nothing.
      throw new BadRequestError('Nilai hanya bisa diisi untuk pelatihan yang sudah selesai');
    }

    const updated = await prisma.trainingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        score: new Prisma.Decimal(input.score),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      select: { id: true, score: true, status: true },
    });

    logger.info('Training score recorded', { enrollmentId, companyId, score: input.score });
    return updated;
  }

  /**
   * The participant's own reaction. Only they can submit it, and only once —
   * a reaction form that anyone could file on someone else's behalf, or refile,
   * would not be evidence of anything.
   */
  async submitFeedback(companyId: string, enrollmentId: string, input: SubmitFeedbackInput) {
    const actor = getCurrentUser();
    if (!actor?.id) throw new ForbiddenError('A signed-in user is required');

    for (const [field, value] of Object.entries({
      contentRating: input.contentRating,
      trainerRating: input.trainerRating,
      relevanceRating: input.relevanceRating,
      ...(input.facilityRating !== undefined ? { facilityRating: input.facilityRating } : {}),
    })) {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new BadRequestError(`${field} must be a whole number from 1 to 5`);
      }
    }

    const enrollment = await prisma.trainingEnrollment.findFirst({
      where: { id: enrollmentId, companyId, deletedAt: null },
      select: { id: true, status: true, employeeId: true, feedback: { select: { id: true } } },
    });
    if (!enrollment) throw new NotFoundError('Training enrollment not found in the active company');
    if (enrollment.status !== 'COMPLETED') {
      throw new BadRequestError('Form reaksi diisi setelah pelatihan selesai');
    }
    if (enrollment.feedback) throw new BadRequestError('Form reaksi untuk pelatihan ini sudah diisi');

    // The reaction must come from the person who attended.
    if (actor.employeeId !== enrollment.employeeId) {
      throw new ForbiddenError('Hanya peserta pelatihan itu yang bisa mengisi form reaksinya');
    }

    const feedback = await prisma.trainingFeedback.create({
      data: {
        enrollmentId: enrollment.id,
        companyId,
        contentRating: input.contentRating,
        trainerRating: input.trainerRating,
        relevanceRating: input.relevanceRating,
        facilityRating: input.facilityRating ?? null,
        wouldRecommend: input.wouldRecommend,
        comment: input.comment,
      },
      select: { id: true, submittedAt: true },
    });

    logger.info('Training feedback submitted', { enrollmentId, companyId });
    return feedback;
  }

  /** One employee's evaluation record: score and their own reaction. */
  async findByEnrollment(companyId: string, enrollmentId: string) {
    const enrollment = await prisma.trainingEnrollment.findFirst({
      where: { id: enrollmentId, companyId, deletedAt: null },
      select: {
        id: true, status: true, score: true, completedAt: true, employeeId: true,
        course: { select: { id: true, title: true } },
        feedback: true,
      },
    });
    if (!enrollment) throw new NotFoundError('Training enrollment not found in the active company');
    await assertEmployeeInScope(enrollment.employeeId, 'training');
    return enrollment;
  }
}

export const trainingEvaluationService = new TrainingEvaluationService();
