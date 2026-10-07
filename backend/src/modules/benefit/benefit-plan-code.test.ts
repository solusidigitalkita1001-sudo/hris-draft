jest.mock('./benefit.repository', () => ({
  benefitRepository: {
    findPlanByCode: jest.fn(),
    createPlan: jest.fn(),
  },
}));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn(async () => undefined) } }));
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ConflictError } from '@/shared/exceptions/AppError';
import { benefitRepository } from './benefit.repository';
import { benefitService } from './benefit.service';

const repo = benefitRepository as unknown as {
  findPlanByCode: jest.Mock;
  createPlan: jest.Mock;
};

const payload = (over: Record<string, unknown> = {}) => ({
  companyId: 'company-1',
  name: 'BPJS Kesehatan',
  type: 'INSURANCE',
  isTaxable: false,
  employeeContribution: 1,
  employerContribution: 4,
  ...over,
}) as never;

beforeEach(() => {
  jest.clearAllMocks();
  repo.findPlanByCode.mockResolvedValue(null);
  repo.createPlan.mockImplementation(async (data: unknown) => ({ id: 'plan-1', ...(data as object) }));
});

describe('benefit plan code on create', () => {
  it('keeps the code the customer sent', async () => {
    await benefitService.createPlan(payload({ code: 'BPJS-KES' }));

    expect(repo.createPlan).toHaveBeenCalledWith(expect.objectContaining({ code: 'BPJS-KES' }));
  });

  it('still generates one when none is given', async () => {
    await benefitService.createPlan(payload());

    const saved = repo.createPlan.mock.calls[0][0] as { code: string };
    expect(saved.code.startsWith('BEN-')).toBe(true);
  });

  it('generates one when the field is sent blank', async () => {
    await benefitService.createPlan(payload({ code: '   ' }));

    const saved = repo.createPlan.mock.calls[0][0] as { code: string };
    expect(saved.code.startsWith('BEN-')).toBe(true);
  });

  it('refuses a code a retired plan still holds', async () => {
    // findPlanByCode no longer filters deletedAt: the unique index counts the
    // retired row, so filtering it out gave a false "free" and a 500.
    repo.findPlanByCode.mockResolvedValue({ id: 'soft-deleted' });

    await expect(benefitService.createPlan(payload({ code: 'BPJS-KES' })))
      .rejects.toThrow(ConflictError);
  });
});
