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
  /**
   * Per-course effectiveness (GAP-25). Both Kirkpatrick levels were already
   * captured — the participant's reaction in TrainingFeedback and the learning
   * score on the enrollment — but only ever readable one enrollment at a time.
   * Nobody could answer "is this course worth running again", which is the
   * only question the ratings were collected to answer.
   *
   * Courses with no feedback at all are reported with null averages rather
   * than omitted: "nobody rated it" and "it rated badly" are different
   * findings, and dropping the first hides a course nobody is evaluating.
   */
  async courseEffectiveness(companyId: string, courseId?: string) {
    const enrollments = await prisma.trainingEnrollment.findMany({
      where: { companyId, deletedAt: null, ...(courseId ? { courseId } : {}) },
      select: {
        courseId: true, status: true, score: true,
        course: { select: { id: true, title: true, code: true } },
        feedback: {
          select: {
            contentRating: true, trainerRating: true, relevanceRating: true,
            facilityRating: true, wouldRecommend: true,
          },
        },
      },
    });

    const byCourse = new Map<string, {
      courseId: string; courseTitle: string; courseCode: string;
      enrolled: number; completed: number;
      scores: number[]; content: number[]; trainer: number[];
      relevance: number[]; facility: number[]; recommend: number;
      responses: number;
    }>();

    for (const row of enrollments) {
      const bucket = byCourse.get(row.courseId) ?? {
        courseId: row.courseId,
        courseTitle: row.course?.title ?? 'Tidak diketahui',
        courseCode: row.course?.code ?? '-',
        enrolled: 0, completed: 0,
        scores: [], content: [], trainer: [], relevance: [], facility: [],
        recommend: 0, responses: 0,
      };
      bucket.enrolled += 1;
      if (row.status === 'COMPLETED') bucket.completed += 1;
      if (row.score !== null) bucket.scores.push(Number(row.score));
      if (row.feedback) {
        bucket.responses += 1;
        bucket.content.push(row.feedback.contentRating);
        bucket.trainer.push(row.feedback.trainerRating);
        bucket.relevance.push(row.feedback.relevanceRating);
        if (row.feedback.facilityRating !== null) bucket.facility.push(row.feedback.facilityRating);
        if (row.feedback.wouldRecommend) bucket.recommend += 1;
      }
      byCourse.set(row.courseId, bucket);
    }

    const mean = (values: number[]) =>
      values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;

    return [...byCourse.values()]
      .map((bucket) => ({
        courseId: bucket.courseId,
        courseTitle: bucket.courseTitle,
        courseCode: bucket.courseCode,
        enrolled: bucket.enrolled,
        completed: bucket.completed,
        completionRate: bucket.enrolled ? Math.round((bucket.completed / bucket.enrolled) * 100) : 0,
        /// Kirkpatrick level 2 — did they learn anything.
        averageScore: mean(bucket.scores),
        /// Kirkpatrick level 1 — what the participants thought.
        responses: bucket.responses,
        averageContentRating: mean(bucket.content),
        averageTrainerRating: mean(bucket.trainer),
        averageRelevanceRating: mean(bucket.relevance),
        averageFacilityRating: mean(bucket.facility),
        recommendPercent: bucket.responses
          ? Math.round((bucket.recommend / bucket.responses) * 100)
          : null,
      }))
      .sort((a, b) => b.enrolled - a.enrolled);
  }

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
