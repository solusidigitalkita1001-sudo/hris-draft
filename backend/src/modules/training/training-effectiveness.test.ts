let enrollmentFindMany: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  enrollmentFindMany = jest.fn();
  const client = { trainingEnrollment: { findMany: enrollmentFindMany } };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

import { trainingEvaluationService } from './training-evaluation.service';

const course = { id: 'k9', title: 'K3 Dasar', code: 'K3-01' };
const feedback = (over: Record<string, unknown> = {}) => ({
  contentRating: 4, trainerRating: 5, relevanceRating: 3,
  facilityRating: null, wouldRecommend: true, ...over,
});
const enrolment = (over: Record<string, unknown> = {}) => ({
  courseId: 'k9', status: 'COMPLETED', score: 80, course, feedback: feedback(), ...over,
});

describe('per-course training effectiveness', () => {
  beforeEach(() => jest.clearAllMocks());

  it('averages both Kirkpatrick levels and the recommendation rate', async () => {
    enrollmentFindMany.mockResolvedValueOnce([
      enrolment(),
      enrolment({ score: 90, feedback: feedback({ contentRating: 2, wouldRecommend: false }) }),
    ]);

    const [row] = await trainingEvaluationService.courseEffectiveness('c1');

    expect(row).toMatchObject({
      courseId: 'k9', courseCode: 'K3-01', enrolled: 2, completed: 2, completionRate: 100,
      averageScore: 85,            // learning
      averageContentRating: 3,     // reaction
      averageTrainerRating: 5,
      responses: 2,
      recommendPercent: 50,
    });
  });

  it('reports a course nobody rated instead of omitting it', async () => {
    enrollmentFindMany.mockResolvedValueOnce([enrolment({ feedback: null, score: null })]);

    const [row] = await trainingEvaluationService.courseEffectiveness('c1');

    // "Nobody rated it" and "it rated badly" are different findings, and
    // dropping the first hides a course nobody is evaluating.
    expect(row).toMatchObject({ enrolled: 1, responses: 0, averageContentRating: null, recommendPercent: null, averageScore: null });
  });

  it('counts completion separately from enrolment', async () => {
    enrollmentFindMany.mockResolvedValueOnce([
      enrolment({ status: 'ENROLLED' }), enrolment({ status: 'COMPLETED' }),
    ]);

    const [row] = await trainingEvaluationService.courseEffectiveness('c1');

    expect(row).toMatchObject({ enrolled: 2, completed: 1, completionRate: 50 });
  });

  it('ignores a null facility rating rather than averaging it as zero', async () => {
    enrollmentFindMany.mockResolvedValueOnce([
      enrolment({ feedback: feedback({ facilityRating: 4 }) }),
      enrolment({ feedback: feedback({ facilityRating: null }) }),
    ]);

    const [row] = await trainingEvaluationService.courseEffectiveness('c1');

    // Averaging the absent one as zero would report a 2 and condemn the venue.
    expect(row.averageFacilityRating).toBe(4);
  });

  it('orders the busiest course first', async () => {
    enrollmentFindMany.mockResolvedValueOnce([
      enrolment({ courseId: 'quiet', course: { id: 'quiet', title: 'Sepi', code: 'Q' } }),
      enrolment(), enrolment(),
    ]);

    const rows = await trainingEvaluationService.courseEffectiveness('c1');

    expect(rows.map((row) => row.courseId)).toEqual(['k9', 'quiet']);
  });
});
