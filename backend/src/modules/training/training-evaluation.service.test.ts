import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

const state: { enrollment: Row | null; actor: Row | null; updates: Row[]; created: Row[] } = {
  enrollment: null, actor: null, updates: [], created: [],
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    trainingEnrollment: {
      findFirst: jest.fn(async () => state.enrollment),
      update: jest.fn(async ({ data }: { data: Row }) => {
        state.updates.push(data);
        return { id: 'enrollment-1', status: 'COMPLETED', ...data };
      }),
    },
    trainingFeedback: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push(data);
        return { id: 'feedback-1', submittedAt: new Date('2026-09-30T00:00:00Z') };
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => state.actor ?? undefined }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { TrainingEvaluationService } from './training-evaluation.service';

const service = new TrainingEvaluationService();
const COMPANY = 'company-a';
const ENROLLMENT = 'enrollment-1';

const validFeedback = {
  contentRating: 4, trainerRating: 5, relevanceRating: 4, facilityRating: 3,
  wouldRecommend: true, comment: 'Materinya terpakai langsung di pekerjaan.',
};

beforeEach(() => {
  jest.clearAllMocks();
  state.enrollment = {
    id: ENROLLMENT, status: 'COMPLETED', employeeId: 'employee-1', feedback: null,
    score: null, completedAt: new Date('2026-09-20T00:00:00Z'),
    course: { id: 'course-1', title: 'Keselamatan Kerja' },
  };
  state.actor = { id: 'user-employee', employeeId: 'employee-1' };
  state.updates = [];
  state.created = [];
});

/**
 * `TrainingEnrollment.score` sat in the schema with no code able to write it —
 * a column recording whether anyone learned anything that no endpoint could
 * fill. Level 2 of the decision is simply making it writable, carefully.
 */
describe("the trainer's score (level 2)", () => {
  it('records a score on a completed enrollment', async () => {
    await service.recordScore(COMPANY, ENROLLMENT, { score: 87.5 });
    expect(String(state.updates[0].score)).toBe('87.5');
  });

  /** A score for training somebody did not finish measures nothing. */
  it.each([['ENROLLED'], ['IN_PROGRESS'], ['CANCELLED']])('refuses a score while the status is %s', async (status) => {
    state.enrollment = { ...state.enrollment, status };
    await expect(service.recordScore(COMPANY, ENROLLMENT, { score: 80 })).rejects.toThrow(/sudah selesai/i);
    expect(state.updates).toEqual([]);
  });

  it.each([[-1], [101], [Number.NaN]])('refuses %p as a score', async (score) => {
    await expect(service.recordScore(COMPANY, ENROLLMENT, { score })).rejects.toThrow(/between 0 and 100/i);
  });

  it.each([[0], [100]])('accepts the boundary score %i', async (score) => {
    await expect(service.recordScore(COMPANY, ENROLLMENT, { score })).resolves.toBeDefined();
  });

  it('refuses an enrollment outside the active company', async () => {
    state.enrollment = null;
    await expect(service.recordScore(COMPANY, ENROLLMENT, { score: 80 })).rejects.toThrow(/not found/i);
  });
});

/**
 * Level 1 is the part that was missing entirely. Without it there is no way to
 * know whether a course was any use — only whether people passed it, which a
 * bad course can still produce.
 */
describe("the participant's reaction (level 1)", () => {
  it('records the reaction with its ratings', async () => {
    await service.submitFeedback(COMPANY, ENROLLMENT, validFeedback);
    expect(state.created[0]).toMatchObject({
      enrollmentId: ENROLLMENT, companyId: COMPANY,
      contentRating: 4, trainerRating: 5, relevanceRating: 4, facilityRating: 3, wouldRecommend: true,
    });
  });

  it('treats the facility rating as optional', async () => {
    const withoutFacility = { ...validFeedback };
    delete (withoutFacility as { facilityRating?: number }).facilityRating;
    await service.submitFeedback(COMPANY, ENROLLMENT, withoutFacility);
    expect(state.created[0].facilityRating).toBeNull();
  });

  /** A form anyone could file on someone else's behalf is not evidence. */
  it('refuses a reaction filed by somebody else', async () => {
    state.actor = { id: 'user-hr', employeeId: 'employee-hr' };
    await expect(service.submitFeedback(COMPANY, ENROLLMENT, validFeedback))
      .rejects.toThrow(/Hanya peserta pelatihan itu/i);
  });

  it('refuses a reaction from a user with no employee record', async () => {
    state.actor = { id: 'user-admin' };
    await expect(service.submitFeedback(COMPANY, ENROLLMENT, validFeedback)).rejects.toThrow(/Hanya peserta/i);
  });

  /** Refiling would let someone rewrite their own verdict. */
  it('refuses a second reaction for the same enrollment', async () => {
    state.enrollment = { ...state.enrollment, feedback: { id: 'feedback-existing' } };
    await expect(service.submitFeedback(COMPANY, ENROLLMENT, validFeedback)).rejects.toThrow(/sudah diisi/i);
  });

  it('refuses a reaction before the training finished', async () => {
    state.enrollment = { ...state.enrollment, status: 'IN_PROGRESS' };
    await expect(service.submitFeedback(COMPANY, ENROLLMENT, validFeedback)).rejects.toThrow(/setelah pelatihan selesai/i);
  });

  it.each([
    ['contentRating', 0],
    ['contentRating', 6],
    ['trainerRating', 0],
    ['relevanceRating', 6],
    ['facilityRating', 9],
    ['contentRating', 3.5],
  ])('refuses %s = %p', async (field, value) => {
    await expect(service.submitFeedback(COMPANY, ENROLLMENT, { ...validFeedback, [field]: value }))
      .rejects.toThrow(/from 1 to 5/i);
    expect(state.created).toEqual([]);
  });

  it('requires a signed-in user', async () => {
    state.actor = null;
    await expect(service.submitFeedback(COMPANY, ENROLLMENT, validFeedback)).rejects.toThrow(/signed-in user/i);
  });
});

describe('reading the evaluation', () => {
  it('returns the score and the reaction together', async () => {
    state.enrollment = {
      ...state.enrollment,
      score: new Prisma.Decimal('87.50'),
      feedback: { id: 'feedback-1', contentRating: 4, wouldRecommend: true },
    };

    const evaluation = await service.findByEnrollment(COMPANY, ENROLLMENT);

    expect(String(evaluation.score)).toBe('87.5');
    expect(evaluation.feedback).toMatchObject({ wouldRecommend: true });
    expect(evaluation.course).toMatchObject({ title: 'Keselamatan Kerja' });
  });

  it('refuses an enrollment outside the active company', async () => {
    state.enrollment = null;
    await expect(service.findByEnrollment(COMPANY, ENROLLMENT)).rejects.toThrow(/not found/i);
  });
});
